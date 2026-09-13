import { randomUUID } from "node:crypto"
import { getSupabaseServer } from "@shared/lib/supabase/server"

type Kind = "image" | "video"

const SPECS = {
  image: { maxBytes: 8 * 1024 * 1024, mime: new Set(["image/jpeg", "image/png", "image/webp"]) },
  video: { maxBytes: 100 * 1024 * 1024, mime: new Set(["video/mp4", "video/quicktime", "video/webm"]) },
} as const

type PrepareResult =
  | { ok: true; uploadUrl: string; url: string }
  | { ok: false; status: number; error: string }

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

  const extension = mime === "image/jpeg" ? "jpg" : mime === "video/quicktime" ? "mov" : mime.split("/")[1]
  const name = `${randomUUID()}.${extension}`
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const sb = getSupabaseServer()
  if (!base || !sb) return { ok: false, status: 503, error: "파일 저장소가 설정되지 않았어요." }
  const bucket = "published-media"
  const path = `${bucket}/${name}`
  const signed = await sb.storage.from(bucket).createSignedUploadUrl(name)
  if (signed.error) return { ok: false, status: 503, error: "파일 업로드 주소를 만들지 못했어요." }
  const encodedPath = path.split("/").map(encodeURIComponent).join("/")
  return { ok: true, uploadUrl: `${base}/storage/v1/object/upload/sign/${encodedPath}?token=${encodeURIComponent(signed.data.token)}`, url: sb.storage.from(bucket).getPublicUrl(name).data.publicUrl }
}
