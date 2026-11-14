import type { NextRequest } from "next/server";
import { proxy } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (req: NextRequest) => proxy(req, "/notifications/read-all");
