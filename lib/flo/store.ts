// 플로(Flo) Briefing 영속 — Supabase flo_briefings (ADR-045). server-side only.
// (user_key, ad_account_id) 복합 PK → upsert 로 활성 계정당 최신 1건만 유지. notion-store 패턴.

import { getSupabaseServer } from "@shared/lib/supabase-server";
import type { Briefing, FloModel } from "./types";

const TABLE = "flo_briefings";

export async function getLatestBriefing(
  userKey: string,
  adAccountId: string,
): Promise<Briefing | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, model, headline, findings, created_at")
    .eq("user_key", userKey)
    .eq("ad_account_id", adAccountId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    adAccountId,
    model: data.model as FloModel,
    headline: data.headline,
    findings: Array.isArray(data.findings) ? data.findings : [],
    createdAt: data.created_at,
  };
}

export async function saveBriefing(userKey: string, b: Briefing): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).upsert({
    user_key: userKey,
    ad_account_id: b.adAccountId,
    id: b.id,
    model: b.model,
    headline: b.headline,
    findings: b.findings,
    created_at: b.createdAt,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("[flo-store] saveBriefing 실패", error.message);
}
