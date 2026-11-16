// 온보딩 완료 표시 — 단계 4 에서 Supabase 직접 접근을 Spring 으로 갈아끼웠다.
// 외부 계약 동결: {ok, onboarded}. Meta 광고 계정 백필 분기는 이관과 무관한 도메인 규칙이라 남긴다.

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callBackend } from "@shared/lib/backend/call";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GRAPH = "https://graph.facebook.com/v20.0";

async function hasMetaAdAccounts(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/me/adaccounts?limit=1&access_token=${accessToken}`, {
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { data?: unknown[] };
    return Array.isArray(data.data) && data.data.length > 0;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, onboarded: false }, { status: 401 });
  }

  const call = await callBackend(req, "/stores/onboarding");
  if (!call.ok) return NextResponse.json({ ok: false, onboarded: false }, { status: call.status });
  if (!call.res.ok) {
    console.error("[onboarding/status] 조회 실패", call.res.status);
    return NextResponse.json({ ok: false, onboarded: false }, { status: call.res.status });
  }

  const { onboarded } = (await call.res.json()) as { onboarded: boolean };
  if (onboarded) return NextResponse.json({ ok: true, onboarded: true });

  // Backfill: 활성 사용자라면(Meta 광고 계정 보유) 자동 등록.
  if (session.accessToken && !session.browseMode) {
    if (await hasMetaAdAccounts(session.accessToken)) {
      await callBackend(req, "/stores/onboarding", { method: "POST" });
      return NextResponse.json({ ok: true, onboarded: true });
    }
  }

  return NextResponse.json({ ok: true, onboarded: false });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const call = await callBackend(req, "/stores/onboarding", { method: "POST" });
  if (!call.ok) return NextResponse.json({ ok: false }, { status: call.status });
  if (!call.res.ok) {
    console.error("[onboarding/status] 등록 실패", call.res.status);
    return NextResponse.json({ ok: false }, { status: call.res.status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const call = await callBackend(req, "/stores/onboarding", { method: "DELETE" });
  if (!call.ok) return NextResponse.json({ ok: false }, { status: call.status });
  return NextResponse.json({ ok: true });
}
