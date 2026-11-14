// 월간 계획 목록 (기능 12-1). ?brandProfileId=&month= 를 그대로 넘긴다.

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = (req: NextRequest) => proxy(req, "/plans");
