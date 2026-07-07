// TEMP 진단 — NextAuth secret 배포/런타임 상태 확인용. 확인 후 제거.
import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { getAuthOptionsForNextAuth } from "@/lib/auth"

function fp(v?: string | null): string | null {
  return v ? createHash("sha256").update(v).digest("hex").slice(0, 8) : null
}

export async function GET() {
  const opts = await getAuthOptionsForNextAuth()
  const env = process.env.NEXTAUTH_SECRET
  return NextResponse.json({
    envSecretPresent: !!env,
    envSecretLen: env?.length ?? 0,
    envSecretFp: fp(env),
    optionsSecretPresent: !!opts.secret,
    optionsSecretFp: fp(opts.secret as string | undefined),
    match: !!env && !!opts.secret && fp(env) === fp(opts.secret as string),
    nextauthUrl: process.env.NEXTAUTH_URL ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  })
}
