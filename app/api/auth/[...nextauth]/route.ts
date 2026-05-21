import NextAuth from "next-auth"
import { getAuthOptionsForNextAuth } from "@/lib/auth"

// NextAuth 핸들러는 요청마다 동적으로 빌드 — Meta 자격증명이 마법사로 교체되면 5분 캐시 후 자동 반영.
async function handler(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> },
): Promise<Response> {
  const authOptions = await getAuthOptionsForNextAuth()
  return NextAuth(authOptions)(req, ctx)
}

export { handler as GET, handler as POST }
