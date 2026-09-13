// ADR-042 관측성 1겹 — 폴러 자기기록 store. cron 1회 실행 = cron_runs 1행(집계 only).
// recordCronRun = 핸들러 try/finally 끝에서 best-effort INSERT(로그 쓰기 실패가 본업을 깨지 않게 내부에서 삼킨다).
// getLastSuccessfulRun = health 라우트(2겹)가 마지막 ok=true 나이로 dead-man's switch 판정.

import { getSupabaseServer } from "@shared/lib/supabase-server";

const TABLE = "cron_runs";

export type CronRunSummary = {
  job: string;
  ok: boolean;
  scanned?: number;
  settled?: number;
  advanced?: number;
  errors?: string[];
  startedAt: string;
};

export type CronRun = {
  id: number;
  job: string;
  ok: boolean;
  scanned: number;
  settled: number;
  advanced: number;
  error_count: number;
  errors: string[];
  started_at: string;
  finished_at: string;
};

export async function acquireCronLock(job: string): Promise<boolean> {
  const c = getSupabaseServer();
  if (!c) return false;
  await c.from("cron_locks").delete().eq("job", job).lt("locked_at", new Date(Date.now() - 30 * 60_000).toISOString());
  const { error } = await c.from("cron_locks").insert({ job });
  return !error;
}

export async function releaseCronLock(job: string): Promise<void> {
  const c = getSupabaseServer();
  if (c) await c.from("cron_locks").delete().eq("job", job);
}

export async function recordCronRun(run: CronRunSummary): Promise<void> {
  try {
    const c = getSupabaseServer();
    if (!c) return;
    const errors = run.errors ?? [];
    await c.from(TABLE).insert({
      job: run.job,
      ok: run.ok,
      scanned: run.scanned ?? 0,
      settled: run.settled ?? 0,
      advanced: run.advanced ?? 0,
      error_count: errors.length,
      errors,
      started_at: run.startedAt,
      finished_at: new Date().toISOString(),
    });
  } catch {
    // best-effort — 관측 로그 실패가 폴러 본업을 500 내지 않는다
  }
}

export async function getLastSuccessfulRun(job: string): Promise<CronRun | null> {
  const c = getSupabaseServer();
  if (!c) return null;
  const { data, error } = await c
    .from(TABLE)
    .select("*")
    .eq("job", job)
    .eq("ok", true)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CronRun | null) ?? null;
}
