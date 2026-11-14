// 서버에 저장한 내 알림 — 최근 30일 (정책서 17.2).

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = (req: NextRequest) => proxy(req, "/notifications");
