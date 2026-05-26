-- AdFlow dual-write 미러용 스키마.
-- localStorage 가 primary, 아래 테이블은 fire-and-forget 백그라운드 미러.
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여서 실행하세요.

create table if not exists library_items (
  id text primary key,
  saved_at bigint not null,
  data jsonb not null,
  synced_at timestamptz default now()
);

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
