// ADR-046 Synced Store API(influencer_campaigns) — 단계 2 에서 Supabase 직결을 Spring 프록시로 교체.
// 계약(GET → {items}, POST {item}, DELETE ?id=)은 그대로라 createSyncedStore 는 바뀌지 않는다.

import { createStoreRoute } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handlers = createStoreRoute("/stores/influencer-campaigns");

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
