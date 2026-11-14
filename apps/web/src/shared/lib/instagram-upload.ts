const SPECS = {
  image: {
    maxBytes: 8 * 1024 * 1024,
    mime: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
    message: "JPG/PNG/WebP 만 지원해요.",
  },
  video: {
    maxBytes: 100 * 1024 * 1024,
    mime: { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" },
    message: "영상 파일만 업로드할 수 있어요.",
  },
} as const

type Kind = keyof typeof SPECS
type UploadValidation =
  | { ok: true; bytes: Uint8Array; extension: string }
  | { ok: false; error: string }

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value)
}

function matchesSource(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff])
  if (mime === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (mime === "image/webp") return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  if (mime === "video/webm") return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])
  return startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)
}

export async function validateInstagramUpload(file: File, kind: Kind): Promise<UploadValidation> {
  const spec = SPECS[kind]
  const mime = file.type.toLowerCase()
  const extension = spec.mime[mime as keyof typeof spec.mime]
  if (!extension) return { ok: false, error: spec.message }
  if (file.size > spec.maxBytes) {
    return { ok: false, error: kind === "image" ? "파일이 8MB 를 넘었어요." : "100MB 이하 영상만 올릴 수 있어요." }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength !== file.size || !matchesSource(bytes, mime)) {
    return { ok: false, error: "파일 내용이 MIME 형식과 맞지 않아요." }
  }
  return { ok: true, bytes, extension }
}

type PrepareResponse = { ok: true; uploadUrl: string; url: string } | { ok: false; error: string }

export async function uploadInstagramFile(file: File, kind: Kind, endpoint: string): Promise<string> {
  const validation = await validateInstagramUpload(file, kind)
  if (!validation.ok) throw new Error(validation.error)

  const prepareRes = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType: file.type, size: file.size }),
  })
  const prepared = (await prepareRes.json()) as PrepareResponse
  if (!prepareRes.ok || !prepared.ok) throw new Error(prepared.ok ? "업로드 준비에 실패했어요." : prepared.error)

  const uploadRes = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  })
  if (!uploadRes.ok) {
    let message = "파일 저장 서버가 업로드를 거절했어요."
    try {
      const body = (await uploadRes.json()) as { message?: string; error?: string }
      message = body.message ?? body.error ?? message
    } catch {}
    throw new Error(message)
  }
  return prepared.url
}
