// ADR-038 결정 2 — 실 유저 토너먼트의 진실의 원천. 데모(localStorage)와 달리 미러가 아니라 primary.
// 서버 cron 폴러(섬2)와 클라 UI 양쪽이 같은 테이블을 읽고 쓴다. 전체 Tournament 를 data jsonb 로 직렬화하고,
// 폴러가 필터링할 컬럼(status·mode)은 상단으로 승격한다. user_email 소유 매칭(Meta 토큰)으로 listByOwner.
// 실 유저 UI·cron·ad_studies 게재가 모두 배선돼 연결 유저에게 노출된다(전체 ON).

import { getSupabaseServer } from "@shared/lib/supabase-server";
import type { Tournament } from "./engine";
import type { TournamentStore } from "./adapters";

const TABLE = "tournaments";

type Row = { data: Tournament };

function client() {
  const c = getSupabaseServer();
  if (!c) throw new Error("Supabase not configured — tournaments require persistence");
  return c;
}

export const supabaseTournamentStore: TournamentStore = {
  async list() {
    const { data, error } = await client().from(TABLE).select("data").order("created_at", { ascending: false });
    if (error) throw error;
    return ((data as Row[]) ?? []).map((r) => r.data);
  },

  async listByOwner(ownerKey) {
    const { data, error } = await client()
      .from(TABLE)
      .select("data")
      .eq("user_email", ownerKey)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data as Row[]) ?? []).map((r) => r.data);
  },

  async get(id) {
    const { data, error } = await client().from(TABLE).select("data").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as Row | null)?.data ?? null;
  },

  async upsert(t) {
    const { error } = await client()
      .from(TABLE)
      .upsert({
        id: t.id,
        user_email: t.delivery?.ownerEmail ?? null, // 소유 매칭 키 (listByOwner). 데모는 delivery 없음
        brand_profile_id: t.brandProfileId,
        status: t.status,
        mode: t.mode,
        data: t,
        created_at: t.createdAt,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  },

  async remove(id) {
    const { error } = await client().from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },
};
