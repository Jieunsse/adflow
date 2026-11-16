// 월간 계획 승인 요청(request)·요청 취소(cancel)·다시 만들기(reopen). 역할 검사는 서버가 한다.

import { NextResponse, type NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ brandId: string; month: string; action: string }> };

const ACTIONS = ["request", "cancel", "reopen"];

export async function POST(req: NextRequest, ctx: Ctx) {
  const { brandId, month, action } = await ctx.params;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 404 });
  }
  return proxy(req, `/plans/${encodeURIComponent(brandId)}/${encodeURIComponent(month)}/${action}`);
}
