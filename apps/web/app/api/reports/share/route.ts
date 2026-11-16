// 성과 리포트를 고객에게 공유 (기능명세 6-1). 공유한 순간의 숫자가 고객 화면에 남는다.

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (req: NextRequest) => proxy(req, "/reports/share");
