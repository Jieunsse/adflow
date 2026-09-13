// ADR-046 Synced Store API(auto_relaunch_states) — 단계 3 에서 레거시 미러를 Tier 1 으로 승격하며 신설.
// 계약(GET → {items}, POST {item}, DELETE ?id=)은 그대로라 createSyncedStore 는 바뀌지 않는다.

import { createStoreRoute } from "@shared/lib/supabase/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handlers = createStoreRoute("/stores/auto-relaunch");

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
