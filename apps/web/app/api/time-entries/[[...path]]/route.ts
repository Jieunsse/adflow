// 작업 시간 기록 (기능 15). /api/time-entries/... 를 그대로 /time-entries/... 로 넘긴다.

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, ["/time-entries", ...path.map(encodeURIComponent)].join("/"));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
