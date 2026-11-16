// 오늘의 결정 1·2순위 (기능 5). GET /today?brandProfileId=, POST /today/dismiss.

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, ["/today", ...path.map(encodeURIComponent)].join("/"));
}

export const GET = handle;
export const POST = handle;
