import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { getNotionConnection } from "@shared/lib/notion-store"
import { fetchResourceText, type NotionResource } from "@/lib/notion"
import { geminiNotion } from "@/lib/gemini-notion"
import { geminiSop } from "@/lib/gemini-sop"
import type { SopSection } from "@features/sop/model/useSopStorage"

// ADR-043 — 선택 자원 합쳐 1회 Gemini. 스타일5필드+proofPoints(gemini-notion) + 정책(deriveFromMarketing).
export async function POST(req: NextRequest) {
  const jwt = await getToken({ req })
  const userKey = (jwt?.sub ?? jwt?.email ?? jwt?.jti) as string | undefined
  if (!userKey) return NextResponse.json({ error: "no_session" }, { status: 401 })

  const conn = await getNotionConnection(userKey)
  if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 403 })

  if (!geminiNotion.isConfigured) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY 가 설정되지 않았어요." }, { status: 503 })
  }

  const body = (await req.json()) as { resources?: NotionResource[] }
  const resources = (body.resources ?? []).filter(
    (r) => r && typeof r.id === "string" && (r.type === "page" || r.type === "data_source"),
  )
  if (resources.length === 0) {
    return NextResponse.json({ error: "가져올 자원을 선택해주세요." }, { status: 400 })
  }

  try {
    const texts = await Promise.all(
      resources.map((r) => fetchResourceText(conn.accessToken, r).catch(() => "")),
    )
    const raw = texts.filter(Boolean).join("\n\n").slice(0, 30000)
    if (raw.trim().length < 20) {
      return NextResponse.json({ error: "선택한 자원에서 텍스트를 추출하지 못했어요." }, { status: 422 })
    }

    const [style, classify] = await Promise.all([
      geminiNotion.mapToBrandProfile(raw),
      geminiSop.deriveFromMarketing({ raw }),
    ])

    const policy: SopSection[] = classify.sections.map(
      (s) => ({ ...s, source: "ai-classified" }) as SopSection,
    )

    return NextResponse.json({
      style: {
        tone: style.tone,
        brandDescription: style.brandDescription,
        brandVoice: style.brandVoice,
        customerVoiceSummary: style.customerVoiceSummary,
        imageGuide: style.imageGuide,
      },
      proofPoints: style.proofPoints,
      policy,
    })
  } catch (e) {
    console.error("[Notion import] failed:", e)
    return NextResponse.json({ error: "가져오기에 실패했어요. 다시 시도해주세요." }, { status: 502 })
  }
}
