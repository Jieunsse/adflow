-- ADR-042 트리거 스왑 — Vercel cron → Supabase pg_cron + pg_net
-- 작업은 Next.js 라우트에 잔존(in-process SSE Map 때문에 Edge 이관 불가). 이 SQL 은 "트리거"만 옮긴다:
-- 6h 마다 Supabase 내부 pg_cron 이 pg_net 으로 폴러 라우트를 fire-and-forget 호출.
--
-- 실행 위치: Supabase Dashboard → SQL Editor (마이그레이션 도구 없음, 수동 1회 실행).
-- 선행 1) Dashboard → Database → Extensions 에서 pg_cron, pg_net 활성화(또는 아래 create extension).
-- 선행 2) Vault 에 두 시크릿 등록(아래 블록). app_base_url = 운영 도메인(끝 슬래시 없이), cron_secret = CRON_SECRET 와 동일 값.
--
-- 검증 후 컷오버: cron.job_run_details + cron_runs 에 행이 쌓이는지 확인 → 그 다음 vercel.json 의 crons 제거.

-- ── 확장 ────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Vault 시크릿(최초 1회. 값 교체 시 vault.update_secret 사용) ──────────
-- select vault.create_secret('https://your-prod-domain', 'app_base_url');
-- select vault.create_secret('<CRON_SECRET 값>', 'cron_secret');

-- ── 잡 등록: 6h 마다 폴러 GET 호출, Vault 에서 URL/시크릿 읽어 Bearer 인증 ──
-- 폴러는 GET 핸들러(authorization: Bearer ${CRON_SECRET}). 같은 이름으로 재실행하면 cron.schedule 이 갱신.
select cron.schedule(
  'tournament-poller',
  '0 */6 * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url')
           || '/api/cron/tournament-poller',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- ── 검증 쿼리 ────────────────────────────────────────────────────────────
-- 잡 등록 확인:   select jobid, schedule, jobname, active from cron.job where jobname = 'tournament-poller';
-- 발화 이력:      select * from cron.job_run_details where jobname = 'tournament-poller' order by start_time desc limit 5;
-- pg_net 응답:    select * from net._http_response order by created desc limit 5;
-- 폴러 자기기록:  select * from cron_runs where job = 'tournament-poller' order by finished_at desc limit 5;
-- 헬스(외부에서): GET /api/cron/health → status: ok

-- ── 롤백(컷오버 실패 시) ─────────────────────────────────────────────────
-- select cron.unschedule('tournament-poller');   -- pg_cron 잡 제거 → vercel.json crons 가 다시 유일 트리거
