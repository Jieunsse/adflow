import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const MAX_BYTES = 8 * 1024 * 1024 // IG photo upload 한도와 동일
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"])
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
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
    return NextResponse.json({ ok: false, error: "JPG/PNG/WebP 만 지원해요." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "파일이 8MB 를 넘었어요." }, { status: 400 })
  }

  const base = process.env.NEXTAUTH_URL?.trim()
  if (!base) {
    return NextResponse.json({ ok: false, error: "NEXTAUTH_URL 이 설정돼 있지 않아요." }, { status: 500 })
  }

  const ext = EXT_BY_MIME[file.type]
  const filename = `${randomUUID()}.${ext}`
  const dir = path.join(process.cwd(), "public", "uploads")
  await mkdir(dir, { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(dir, filename), buf)

  const url = `${base.replace(/\/$/, "")}/uploads/${filename}`
  return NextResponse.json({ ok: true, url })
}
