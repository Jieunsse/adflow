// 배운 것 문장 고치기(PUT sentence)·확정(POST confirm)·보관(POST archive). 역할 검사는 서버가 한다.

import { NextResponse, type NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; action: string }> };

const ALLOWED: Record<string, string> = { PUT: "sentence", POST: "confirm|archive" };

async function handle(req: NextRequest, ctx: Ctx) {
  const { id, action } = await ctx.params;
  if (!ALLOWED[req.method]?.split("|").includes(action)) {
    return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 404 });
  }
  return proxy(req, `/learnings/${encodeURIComponent(id)}/${action}`);
}

export const PUT = handle;
export const POST = handle;
