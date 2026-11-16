// 인스타그램 게시용 사진·영상 올리기 준비. 파일은 Spring 의 미디어 저장소(/media)에 두고, Meta 는 공개 주소
// (/public/media)에서 가져간다. 화면은 받은 uploadUrl 로 파일을 PUT 하고, url 을 게시 요청에 넣는다.
import { randomUUID } from "node:crypto"
import { backendBaseUrl } from "@shared/lib/backend/client"

type Kind = "image" | "video"

const SPECS = {
  image: { maxBytes: 8 * 1024 * 1024, mime: new Set(["image/jpeg", "image/png", "image/webp"]) },
  video: { maxBytes: 100 * 1024 * 1024, mime: new Set(["video/mp4", "video/quicktime", "video/webm"]) },
} as const

type PrepareResult =
  | { ok: true; uploadUrl: string; url: string }
  | { ok: false; status: number; error: string }

/** Meta 가 가져갈 수 있는 Spring 의 공개 주소. 로컬처럼 내부 주소뿐이면 ADFLOW_BACKEND_URL 을 쓴다. */
function publicApiBase(): string | null {
  const raw = process.env.ADFLOW_PUBLIC_API_URL ?? backendBaseUrl()
  return raw ? raw.replace(/\/+$/, "") : null
}

export async function prepareInstagramMedia(
  kind: Kind,
  mimeType: unknown,
  size: unknown,
): Promise<PrepareResult> {
  const spec = SPECS[kind]
  const mime = typeof mimeType === "string" ? mimeType.toLowerCase() : ""
  const bytes = typeof size === "number" ? size : NaN
  if (!spec.mime.has(mime)) return { ok: false, status: 400, error: kind === "image" ? "JPG/PNG/WebP 만 지원해요." : "영상 파일만 업로드할 수 있어요." }
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > spec.maxBytes) {
    return { ok: false, status: 400, error: kind === "image" ? "파일이 8MB 를 넘었거나 비어 있어요." : "100MB 이하 영상만 올릴 수 있어요." }
  }

  const base = publicApiBase()
  if (!base) return { ok: false, status: 503, error: "파일 저장소가 설정되지 않았어요." }
  const extension = mime === "image/jpeg" ? "jpg" : mime === "video/quicktime" ? "mov" : mime.split("/")[1]
  const name = `${randomUUID()}.${extension}`
  return { ok: true, uploadUrl: `/api/instagram/media/${name}`, url: `${base}/public/media/${name}` }
}
