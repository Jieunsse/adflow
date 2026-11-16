// 로그인 전 화면(가입·이메일 인증·비밀번호 재설정)이 부르는 통로. 로그인은 NextAuth(client-email)가 따로 한다.

import { NextResponse, type NextRequest } from "next/server";
import { callAccount, type AccountAction } from "@shared/lib/backend/account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 로그인·고객 확인은 여기로 열지 않는다 — 비밀번호를 무작정 넣어 보는 통로가 되면 안 된다.
const PUBLIC: AccountAction[] = ["signup", "verify", "reset-request", "reset"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (!PUBLIC.includes(action as AccountAction)) {
    return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const r = await callAccount(action as AccountAction, body);
  return NextResponse.json(r.data, { status: r.status });
}
