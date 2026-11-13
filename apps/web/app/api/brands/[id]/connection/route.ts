// 브랜드에 광고 계정 연결 (기능명세 10-3).
// 서버에는 직원의 Meta 토큰이 없어서, 저장 전에 이 직원의 토큰으로 계정에 접근할 수 있는지 여기서 확인한다.

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAccessToken, resolveAdAccountId } from "@/lib/env";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GRAPH = "https://graph.facebook.com/v20.0";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getServerSession(authOptions);
  const body = (await req.clone().json().catch(() => ({}))) as { adAccountId?: string };
  if (!session?.accessToken || !body.adAccountId) {
    return NextResponse.json({ error: "광고 계정과 페이지를 모두 골라 주세요." }, { status: 400 });
  }

  const check = await fetch(
    // 개발 모드의 시험 계정 치환을 실제 게재 경로(meta-session)와 똑같이 적용한다.
    `${GRAPH}/${encodeURIComponent(resolveAdAccountId(body.adAccountId))}?fields=id&access_token=${resolveAccessToken(session.accessToken)}`,
  ).catch(() => null);
  if (!check?.ok) {
    return NextResponse.json(
      { error: "이 광고 계정에 접근할 수 없어요. 고객이 파트너 공유를 마쳤는지 확인해 주세요." },
      { status: 403 },
    );
  }

  return proxy(req, `/brands/${encodeURIComponent(id)}/connection`);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return proxy(req, `/brands/${encodeURIComponent(id)}/connection`);
}
