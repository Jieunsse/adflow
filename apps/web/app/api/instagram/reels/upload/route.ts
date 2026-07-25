import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

// ponytail: 로컬 FS 저장, 프로덕션 규모 시 외부 스토리지로
const MAX_BYTES = 100 * 1024 * 1024
const ALLOWED = new Set(["video/mp4", "video/quicktime", "video/webm"])
const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "multipart/form-data 가 아니에요." }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file 필드가 필요해요." }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ ok: false, error: "영상 파일만 업로드할 수 있어요." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "100MB 이하 영상만 올릴 수 있어요." }, { status: 400 })
  }

  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const ext = EXT_BY_MIME[file.type]
  const filename = `${randomUUID()}.${ext}`
  const dir = path.join(process.cwd(), "public", "uploads")
  await mkdir(dir, { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(dir, filename), buf)

  const url = `${origin}/uploads/${filename}`
  return NextResponse.json({ ok: true, url })
}
