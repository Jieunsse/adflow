-- AdFlow Supabase schema. Apply to a new project before enabling persistence.

create table if not exists brand_profiles (
  id text primary key,
  user_email text not null,
  data jsonb not null,
  synced_at timestamptz not null default now()
);
create index if not exists brand_profiles_user_email on brand_profiles (user_email);

create table if not exists library_items (
  id text primary key,
  user_email text not null,
  saved_at bigint not null,
  data jsonb not null,
  synced_at timestamptz not null default now()
);
create index if not exists library_items_user_email on library_items (user_email);

create table if not exists creators (
  id text primary key,
  user_email text not null,
  data jsonb not null,
  synced_at timestamptz not null default now()
);
create index if not exists creators_user_email on creators (user_email);

create table if not exists influencer_campaigns (
  id text primary key,
  user_email text not null,
  data jsonb not null,
  synced_at timestamptz not null default now()
);
create index if not exists influencer_campaigns_user_email on influencer_campaigns (user_email);

create table if not exists sops (
  id text primary key,
  user_email text not null,
  name text not null,
  description text,
  sections jsonb not null default '[]',
  created_at text not null,
  updated_at text not null
);
create index if not exists sops_user_email on sops (user_email);

create table if not exists personas (
  id text primary key,
  user_email text not null,
  brand_profile_id text not null,
  name text not null,
  age_min int,
  age_max int,
  genders int[],
  location text[],
  interests text[],
  customer_description text
);
create index if not exists personas_user_email on personas (user_email);

create table if not exists campaign_launches (
  campaign_id text primary key,
  user_email text not null,
  data jsonb not null,
  synced_at timestamptz not null default now()
);
create table if not exists auto_relaunch_states (
  campaign_id text primary key,
  user_email text not null,
  data jsonb not null,
  updated_at text not null,
  synced_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  user_email text not null,
  brand_profile_id text not null,
  name text not null,
  description text,
  image_url text,
  price text,
  target_url text,
  created_at bigint not null
);
create index if not exists products_user_profile_created on products (user_email, brand_profile_id, created_at);

create table if not exists reference_materials (
  id text primary key,
  user_email text not null,
  brand_profile_id text not null,
  name text not null,
  type text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_url text not null,
  uploaded_at bigint not null
);
create index if not exists reference_materials_user_profile_uploaded on reference_materials (user_email, brand_profile_id, uploaded_at desc);

create table if not exists onboarded_users (
  user_email text primary key,
  onboarded_at timestamptz not null default now()
);

create table if not exists ig_messages (
  id text primary key,
  user_email text,
  ig_user_id text not null,
  conversation_id text not null,
  participant_id text not null,
  participant_handle text,
  from_me boolean not null,
  text text,
  attachment_url text,
  created_at timestamptz not null
);
create index if not exists ig_messages_user_conv_created on ig_messages (user_email, conversation_id, created_at desc);

create table if not exists notion_connections (
  user_key text primary key,
  access_token text not null,
  bot_id text,
  workspace_id text,
  workspace_name text,
  workspace_icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_notion_settings (
  user_email text primary key,
  owner_key text not null,
  updated_at timestamptz not null default now()
);
create table if not exists workspace_notion_audits (
  id bigint generated always as identity primary key,
  user_email text not null,
  actor text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_meta_targets (
  user_email text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists workspace_meta_target_audits (
  id bigint generated always as identity primary key,
  user_email text not null,
  actor text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tournaments (
  id text primary key,
  user_email text,
  brand_profile_id text,
  status text not null,
  mode text not null,
  data jsonb not null,
  created_at text not null,
  updated_at timestamptz not null default now()
);
create index if not exists tournaments_user_status on tournaments (user_email, status);

create table if not exists cron_runs (
  job text not null,
  ok boolean not null,
  scanned int not null default 0,
  settled int not null default 0,
  advanced int not null default 0,
  error_count int not null default 0,
  errors jsonb not null default '[]',
  started_at timestamptz not null,
  finished_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true), ('reference-materials', 'reference-materials', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('published-media', 'published-media', true)
on conflict (id) do nothing;

-- All application reads and writes use the server-only service-role client.
alter table brand_profiles enable row level security;
alter table library_items enable row level security;
alter table creators enable row level security;
alter table influencer_campaigns enable row level security;
alter table sops enable row level security;
alter table personas enable row level security;
alter table campaign_launches enable row level security;
alter table auto_relaunch_states enable row level security;
alter table products enable row level security;
alter table reference_materials enable row level security;
alter table onboarded_users enable row level security;
alter table ig_messages enable row level security;
alter table notion_connections enable row level security;
alter table workspace_meta_targets enable row level security;
alter table workspace_meta_target_audits enable row level security;
alter table tournaments enable row level security;
alter table cron_runs enable row level security;
