// 월간 계획 한 건 읽기(GET)·임시 저장(PUT). 역할 검사는 서버가 한다.

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ brandId: string; month: string }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { brandId, month } = await ctx.params;
  return proxy(req, `/plans/${encodeURIComponent(brandId)}/${encodeURIComponent(month)}`);
}

export const GET = handle;
export const PUT = handle;
