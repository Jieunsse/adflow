// 브랜드의 광고 계정·페이지·담당 직원 (기능 10). 404 = 아직 연결이 없는 브랜드.

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxy(req, `/brands/${encodeURIComponent(id)}`);
}
