// ADR-038 결정 2 — 실 유저 토너먼트의 진실의 원천. 데모(localStorage)와 달리 미러가 아니라 primary.
// 서버 cron 폴러(섬2)와 클라 UI 양쪽이 같은 테이블을 읽고 쓴다. 전체 Tournament 를 data jsonb 로 직렬화하고,
// 폴러가 필터링할 컬럼(status·mode)은 상단으로 승격한다. user_email 소유 매칭(Meta 토큰)으로 listByOwner.
// 실 유저 UI·cron·ad_studies 게재가 모두 배선돼 연결 유저에게 노출된다(전체 ON).

import { getSupabaseServer } from "@shared/lib/supabase-server";
import type { Tournament } from "./engine";
import type { TournamentStore } from "./adapters";

const TABLE = "tournaments";

type Row = { data: Tournament };

// ADR-054 데이터 패치 — 레거시 manual-n 행을 auto 로 흡수(읽기 경계). 폴러가 mode==="auto" 만 진행하므로
// 패치하지 않으면 옛 토너먼트가 자동 진행에서 누락돼 멈춘다. maxRounds 등 죽은 필드는 무시.
function normalize(t: Tournament): Tournament {
  return (t.mode as string) === "auto" ? t : { ...t, mode: "auto" };
}
function normalizeRows(rows: Row[] | null): Tournament[] {
  return (rows ?? []).map((r) => normalize(r.data));
}

function client() {
  const c = getSupabaseServer();
  if (!c) throw new Error("Supabase not configured — tournaments require persistence");
  return c;
}

export const supabaseTournamentStore: TournamentStore = {
  async list() {
    const { data, error } = await client().from(TABLE).select("data").order("created_at", { ascending: false });
    if (error) throw error;
    return normalizeRows(data as Row[] | null);
  },

  async listByOwner(ownerKey) {
    const { data, error } = await client()
      .from(TABLE)
      .select("data")
      .eq("user_email", ownerKey)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return normalizeRows(data as Row[] | null);
  },

  // ADR-047 — Ledger 투영 입력. brand_profile_id·user_email 컬럼으로 좁혀 소유 유저의 같은 브랜드 토너먼트만.
  async listByBrandOwner(brandProfileId, ownerKey) {
    const { data, error } = await client()
      .from(TABLE)
      .select("data")
      .eq("brand_profile_id", brandProfileId)
      .eq("user_email", ownerKey)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return normalizeRows(data as Row[] | null);
  },

  async get(id) {
    const { data, error } = await client().from(TABLE).select("data").eq("id", id).maybeSingle();
    if (error) throw error;
    { const d = (data as Row | null)?.data; return d ? normalize(d) : null; }
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
