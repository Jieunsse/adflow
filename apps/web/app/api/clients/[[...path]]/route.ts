// 고객사 영업·계약·청구 기록 (기능 14). /api/clients/... 를 그대로 /clients/... 로 넘긴다. 권한 검사는 서버가 한다.

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, ["/clients", ...path.map(encodeURIComponent)].join("/"));
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
