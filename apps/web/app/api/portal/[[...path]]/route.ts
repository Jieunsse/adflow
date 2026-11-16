// 고객 화면 API (기능 11). /api/portal/... 를 그대로 /portal/... 로 넘긴다. 고객 역할 검사는 서버가 한다.

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, ["/portal", ...path.map(encodeURIComponent)].join("/"));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
