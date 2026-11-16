// ADR-042 관측성 1겹 — 폴러 자기기록 store. cron 1회 실행 = cron_runs 1행(집계 only).
// recordCronRun = 핸들러 try/finally 끝에서 best-effort 기록(로그 쓰기 실패가 본업을 깨지 않게 내부에서 삼킨다).
// getLastSuccessfulRun = health 라우트(2겹)가 마지막 ok=true 나이로 dead-man's switch 판정.
//
// 단계 4 — Supabase 대신 Spring 을 쓴다. cron 은 사용자 세션 없이 돌아 JWT 를 실을 수 없으므로
// 다른 라우트가 쓰는 callBackend(사용자 토큰) 대신 내부 시크릿으로 직접 부른다.

import { backendBaseUrl, internalSecret } from "@shared/lib/backend/client";

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

function internalCall(path: string, init?: { method: string; body: string }): Promise<Response> | null {
  const base = backendBaseUrl();
  const secret = internalSecret();
  // 미설정이면 조용히 건너뛴다 — 배포 환경(백엔드 미배포)의 자동 휴면 계약.
  if (!base || !secret) return null;

  return fetch(`${base}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "X-Internal-Secret": secret,
      ...(init ? { "Content-Type": "application/json" } : {}),
    },
    ...(init ? { body: init.body } : {}),
    cache: "no-store",
  });
}

export async function recordCronRun(run: CronRunSummary): Promise<void> {
  try {
    const call = internalCall("/internal/cron-runs", {
      method: "POST",
      body: JSON.stringify({
        job: run.job,
        ok: run.ok,
        scanned: run.scanned ?? 0,
        settled: run.settled ?? 0,
        advanced: run.advanced ?? 0,
        errors: run.errors ?? [],
        started_at: run.startedAt,
      }),
    });
    if (call) await call;
  } catch {
    // best-effort — 관측 로그 실패가 폴러 본업을 500 내지 않는다
  }
}

export async function getLastSuccessfulRun(job: string): Promise<CronRun | null> {
  const call = internalCall(`/internal/cron-runs/last-success?job=${encodeURIComponent(job)}`);
  if (!call) return null;

  const res = await call;
  // 기록이 없으면 204 다. health 라우트는 이걸 "아직 한 번도 안 돌았다" 로 읽는다.
  if (res.status === 204) return null;
  // 여기서는 삼키지 않는다 — health 라우트가 조회 실패와 미실행을 구분해야 한다.
  if (!res.ok) throw new Error(`cron-runs 조회 실패 (${res.status})`);

  return (await res.json()) as CronRun;
}
