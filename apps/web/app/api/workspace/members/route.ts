// 구성원 목록·추가·역할 바꾸기·내보내기 (정책서 5.3). 권한 검사는 서버가 한다(팀장만 바꾼다).

import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handle = (req: NextRequest) => proxy(req, "/workspace/members");

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
