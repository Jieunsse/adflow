import { createHmac, randomUUID } from "node:crypto"
import { backendBaseUrl, internalSecret } from "@shared/lib/backend/client"

type Kind = "image" | "video"

const SPECS = {
  image: { maxBytes: 8 * 1024 * 1024, mime: new Set(["image/jpeg", "image/png", "image/webp"]) },
  video: { maxBytes: 100 * 1024 * 1024, mime: new Set(["video/mp4", "video/quicktime", "video/webm"]) },
} as const

type PrepareResult =
  | { ok: true; uploadUrl: string; url: string }
  | { ok: false; status: number; error: string }

export function prepareInstagramMedia(
  kind: Kind,
  mimeType: unknown,
  size: unknown,
): PrepareResult {
  const spec = SPECS[kind]
  const mime = typeof mimeType === "string" ? mimeType.toLowerCase() : ""
  const bytes = typeof size === "number" ? size : NaN
  if (!spec.mime.has(mime)) return { ok: false, status: 400, error: kind === "image" ? "JPG/PNG/WebP 만 지원해요." : "영상 파일만 업로드할 수 있어요." }
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > spec.maxBytes) {
    return { ok: false, status: 400, error: kind === "image" ? "파일이 8MB 를 넘었거나 비어 있어요." : "100MB 이하 영상만 올릴 수 있어요." }
  }

  const base = backendBaseUrl()
  const secret = internalSecret()
  if (!base || !secret) return { ok: false, status: 503, error: "파일 저장 서버가 설정되지 않았어요." }

  const extension = mime === "image/jpeg" ? "jpg" : mime === "video/quicktime" ? "mov" : mime.split("/")[1]
  const name = `${randomUUID()}.${extension}`
  const path = `/files/published-media/${name}`
  const expires = Math.floor(Date.now() / 1000) + 300
  const signature = createHmac("sha256", secret).update(`PUT\n${path}\n${expires}`).digest("hex")
  const query = `expires=${expires}&signature=${signature}`
  return { ok: true, uploadUrl: `${base}${path}?${query}`, url: `${base}${path}` }
}
