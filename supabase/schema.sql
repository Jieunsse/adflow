-- AdFlow dual-write 미러용 스키마.
-- localStorage 가 primary, 아래 테이블은 fire-and-forget 백그라운드 미러.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여서 실행하세요.

create table if not exists ig_messages (
  id                text        primary key,
  ig_user_id        text        not null,
  conversation_id   text        not null,
  participant_id    text        not null,
  participant_handle text,
  from_me           boolean     not null,
  text              text,
  attachment_url    text,
  created_at        timestamptz not null
);

create index if not exists ig_messages_ig_user_id_conv_created
  on ig_messages (ig_user_id, conversation_id, created_at desc);

-- ADR-046 — Synced Store 파일럿. 미러 → source-of-truth(read-back) 승격. user_email = Owner Key(NextAuth email).
create table if not exists library_items (
  id text primary key,
  user_email text,
  saved_at bigint not null,
  data jsonb not null,
  synced_at timestamptz default now()
);
-- 소급 보강(create table if not exists 는 컬럼 추가 안 함). 기존 owner-blind 행은 null(데모, 폐기 대상).
alter table library_items add column if not exists user_email text;
create index if not exists library_items_user_email on library_items (user_email);
-- 결정 6 — RLS 방어 심층. 쓰기·읽기는 service-role 서버가 수행(RLS 우회), 공개 anon-key 직접 접근만 차단(정책 없음 = anon 전면 거부).
alter table library_items enable row level security;

-- ADR-046 — Synced Store 린치핀(brand_profiles). 미러 → source-of-truth(read-back). data = BrandProfileEntry jsonb.
-- /api/stores/brand-profiles 가 user_email(Owner Key) 스코핑으로 R/W. 자식(persona·product·reference·sop)은 후속.
create table if not exists brand_profiles (
  id text primary key,
  user_email text,
  data jsonb not null,
  synced_at timestamptz default now()
);
create index if not exists brand_profiles_user_email on brand_profiles (user_email);
alter table brand_profiles enable row level security;

create table if not exists campaign_launches (
  campaign_id text primary key,
  data jsonb not null,
  synced_at timestamptz default now()
);

create table if not exists auto_relaunch_states (
  campaign_id text primary key,
  data jsonb not null,
  updated_at text not null,
  synced_at timestamptz default now()
);

create table if not exists sops (
  id text primary key,
  name text not null,
  description text,
  sections jsonb not null default '[]',
  created_at text not null,
  updated_at text not null,
  synced_at timestamptz default now()
);

create table if not exists onboarded_users (
  user_email   text primary key,
  onboarded_at timestamptz not null default now()
);

-- ADR-038 — A/B 토너먼트 실 유저 이관. 다른 테이블과 달리 미러가 아니라 source-of-truth(primary):
-- 서버 cron 폴러가 브라우저 없이 라운드를 진행하므로 Supabase 가 진실의 원천이다. 전체 Tournament 는
-- data jsonb, 폴러가 필터링하는 status 는 컬럼으로 승격. user_email = 소유 유저(섬2 가 Meta 토큰 매칭).
create table if not exists tournaments (
  id               text primary key,
  user_email       text,
  brand_profile_id text,
  status           text not null,
  mode             text not null,
  data             jsonb not null,
  created_at       text not null,
  updated_at       timestamptz default now()
);

create index if not exists tournaments_status on tournaments (status);
-- ADR-047 — Hypothesis Ledger 투영 조회(소유 유저의 같은 Brand Profile 토너먼트 평탄화).
create index if not exists tournaments_brand_profile_id on tournaments (brand_profile_id);

-- axhub(Google) 신원에 매달리는 사용자 + Meta 연결 영속 (lib/user-store.ts).
-- 신원=앵커, meta_connection=최초 Facebook 연결로 받은 토큰 묶음(2회차+ 자동 복원), role/workspace=자체 관리.
create table if not exists app_users (
  axhub_id        text primary key,
  email           text not null,
  name            text,
  image           text,
  role            text not null default '팀장',
  workspace_id    text,
  meta_connection jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists app_users_email_idx on app_users (email);
create index if not exists app_users_workspace_idx on app_users (workspace_id);

-- ADR-042 — 토너먼트 폴러 자기기록 관측성 1겹. cron 1회 호출 = 1행(집계 only, PK 없음).
-- pg_net(트리거 스왑 후)은 fire-and-forget 이라 "요청 보냄"까지만 안다 — 핸들러가 try/finally 끝에서
-- 직접 실행 요약을 남긴다. health 라우트(2겹)가 마지막 ok=true 의 finished_at 나이로 dead-man's switch 를 건다.
create table if not exists cron_runs (
  job          text        not null,
  ok           boolean     not null,
  scanned      int         not null default 0,
  settled      int         not null default 0,
  advanced     int         not null default 0,
  error_count  int         not null default 0,
  errors       jsonb       not null default '[]',
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now()
);

create index if not exists cron_runs_job_ok_finished
  on cron_runs (job, ok, finished_at desc);

-- ADR-024 — Product. Brand Profile 1:N. 라우트가 진실의 원천(localStorage 미러 아님):
-- /api/brand-profile/[id]/products 가 직접 읽고 쓴다. created_at = epoch ms(클라 entry.createdAt) → bigint.
-- 이미지는 storage 버킷 product-images, image_url 은 public URL.
create table if not exists products (
  id               text   primary key,
  brand_profile_id text   not null,
  name             text   not null,
  description      text,
  image_url        text,
  price            text,
  target_url       text,
  created_at       bigint not null
);

create index if not exists products_brand_profile_created
  on products (brand_profile_id, created_at);

-- ADR-023 — Reference Material. Brand Profile 1:N 참고 자료(PDF·이미지·TXT).
-- /api/brand-profile/[id]/reference-materials 가 직접 읽고 쓴다. uploaded_at = epoch ms(Date.now()) → bigint.
-- 파일은 storage 버킷 reference-materials, storage_url 은 public URL.
create table if not exists reference_materials (
  id               text   primary key,
  brand_profile_id text   not null,
  name             text   not null,
  type             text   not null,
  mime_type        text   not null,
  size_bytes       bigint not null,
  storage_url      text   not null,
  uploaded_at      bigint not null
);

create index if not exists reference_materials_brand_profile_uploaded
  on reference_materials (brand_profile_id, uploaded_at desc);

-- ADR-043 — Notion Connection. 노션 OAuth(public integration) 토큰 영속.
-- 다른 OAuth(meta_connection JSONB)와 달리 별도 테이블: server-side only, 광고 세션(JWT)과 무관하게
-- import 시에만 server 가 읽는다. user_key = NextAuth sub/email (callback 에서 getToken 으로 해석).
-- 토큰 만료·refresh 없음(결정 9), 연결=지속, 동기화 X(1회 import).
create table if not exists notion_connections (
  user_key       text primary key,
  access_token   text not null,
  bot_id         text,
  workspace_id   text,
  workspace_name text,
  workspace_icon text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ADR-045 — 플로(Flo) Briefing 영속. 활성 광고 계정당 최신 1건만 보관(on-demand 캐시).
-- user_key = 소유 유저(ownerKeyFrom: email 우선·토큰 해시 폴백, 토너먼트와 동일). browse 게스트는
-- ad_account_id='browse'. findings = Finding[] jsonb. (user_key, ad_account_id) 복합 PK → upsert 로 최신 1건 유지.
create table if not exists flo_briefings (
  user_key      text not null,
  ad_account_id text not null,
  id            text not null,
  model         text not null,
  headline      text not null,
  findings      jsonb not null default '[]',
  created_at    text not null,
  updated_at    timestamptz default now(),
  primary key (user_key, ad_account_id)
);

-- 위 두 테이블이 쓰는 public storage 버킷. getPublicUrl 로 서빙하므로 public = true.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true),
       ('reference-materials', 'reference-materials', true)
on conflict (id) do nothing;
