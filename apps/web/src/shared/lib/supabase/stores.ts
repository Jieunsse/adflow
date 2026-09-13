// Next API 라우트가 Supabase를 감싸는 공통 저장소 핸들러.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase/server";
import { getSupabaseOwner } from "@shared/lib/supabase/auth";

type StoreConfig = { table: string; idColumn?: string; orderColumn?: string };

const STORES: Record<string, StoreConfig> = {
  "/stores/brand-profiles": { table: "brand_profiles", orderColumn: "synced_at" },
  "/stores/library": { table: "library_items", orderColumn: "saved_at" },
  "/stores/creators": { table: "creators", orderColumn: "synced_at" },
  "/stores/influencer-campaigns": { table: "influencer_campaigns", orderColumn: "synced_at" },
  "/stores/personas": { table: "personas", orderColumn: "id" },
  "/stores/campaign-launches": { table: "campaign_launches", idColumn: "campaign_id", orderColumn: "synced_at" },
  "/stores/auto-relaunch": { table: "auto_relaunch_states", idColumn: "campaign_id", orderColumn: "updated_at" },
};

type StoreItem = Record<string, unknown>;

async function context(req: NextRequest, path: string): Promise<
  | { error: NextResponse }
  | { owner: string; config: StoreConfig; supabase: NonNullable<ReturnType<typeof getSupabaseServer>> }
> {
  const owner = await getSupabaseOwner(req);
  const config = STORES[path];
  const supabase = getSupabaseServer();
  if (!config || !owner || !supabase) {
    return { error: NextResponse.json({ error: "저장 기능을 사용할 수 없어요." }, { status: 401 }) };
  }
  return { owner: owner as string, config, supabase };
}

async function handle(req: NextRequest, path: string): Promise<NextResponse> {
  const c = await context(req, path);
  if ("error" in c) return c.error;
  const { owner, config, supabase } = c;
  const idColumn = config.idColumn ?? "id";

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from(config.table)
      .select("*")
      .eq("user_email", owner)
      .order(config.orderColumn ?? "id", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: (data ?? []).map((row: StoreItem) => row.data ?? row) });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (req.method === "DELETE") {
    if (!id) return NextResponse.json({ error: "id가 필요해요." }, { status: 400 });
    const { error } = await supabase.from(config.table).delete().eq("user_email", owner).eq(idColumn, id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  }

  const body = (await req.json()) as { item?: StoreItem };
  const item = body.item;
  const itemId = item && typeof item[idColumn] === "string" ? item[idColumn] as string : undefined;
  if (!item || !itemId) return NextResponse.json({ error: "저장할 항목이 올바르지 않아요." }, { status: 400 });

  const row: StoreItem = { user_email: owner, data: item };
  row[idColumn] = itemId;
  if (config.table === "library_items") row.saved_at = item.savedAt ?? Date.now();
  if (config.table === "auto_relaunch_states") row.updated_at = item.updatedAt ?? new Date().toISOString();
  if (config.table === "personas") {
    Object.assign(row, {
      brand_profile_id: item.brandProfileId,
      name: item.name,
      age_min: item.ageMin,
      age_max: item.ageMax,
      genders: item.genders,
      location: item.location,
      interests: item.interests,
      customer_description: item.customerDescription,
    });
  }
  const { error } = await supabase.from(config.table).upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export function createStoreRoute(path: string) {
  const handler = (req: NextRequest) => handle(req, path);
  return { GET: handler, POST: handler, DELETE: handler };
}
