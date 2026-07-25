# Supabase 새 프로젝트로 이사

기존 프로젝트를 버리고 새로 파는 절차예요. 순서대로.

## 0. 이사 전 실측 — 뭐가 얼마나 있는지

새 프로젝트를 만들기 전에 **기존** 프로젝트 SQL Editor 에서 돌려요. 결과에 따라 아래 단계가 달라져요.

```sql
select 'brand_profiles' t, count(*) from brand_profiles
union all select 'products',             count(*) from products
union all select 'reference_materials',  count(*) from reference_materials
union all select 'library_items',        count(*) from library_items
union all select 'creators',             count(*) from creators
union all select 'influencer_campaigns', count(*) from influencer_campaigns
union all select 'tournaments',          count(*) from tournaments
union all select 'sops',                 count(*) from sops
union all select 'campaign_launches',    count(*) from campaign_launches
union all select 'auto_relaunch_states', count(*) from auto_relaunch_states
union all select 'ig_messages',          count(*) from ig_messages
union all select 'notion_connections',   count(*) from notion_connections
union all select 'onboarded_users',      count(*) from onboarded_users
order by 2 desc;
```

**스토리지 파일이 있는지 따로 확인해요** — 이게 제일 중요해요 (§4 참고):

```sql
select count(*) filter (where image_url   is not null) as product_images
     , (select count(*) from reference_materials where storage_url not like 'data:%') as ref_files
from products;
```

## 1. 새 프로젝트 + 스키마

1. Supabase Dashboard → New project. **리전은 기존과 같게** (레이턴시).
2. SQL Editor → [`schema.sql`](./schema.sql) 통째로 붙여서 1회 실행.
   - 테이블 15개 + 인덱스 + storage 버킷 2개(`product-images`·`reference-materials`) + 서버 전용 7개 테이블 RLS 가 한 번에 들어가요.
3. Project Settings → API 에서 3개 값 복사 → `.env.local` 의 `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` 교체.

> `SUPABASE_SERVICE_ROLE_KEY` 를 빼먹으면 `supabase-server` 가 anon 키로 폴백해요. RLS 켜진 7개 테이블이 **에러 없이 빈 결과**를 반환하니 증상이 "데이터가 안 보임"으로만 나타나요.

## 2. 데이터 이사 (테이블)

`pg_dump` 로 데이터만 옮겨요. 연결 문자열은 Dashboard → Project Settings → Database → Connection string (URI), **포트 5432 직접 연결** (pooler 6543 아님).

```bash
pg_dump "postgresql://postgres:[OLD_PW]@db.[OLD_REF].supabase.co:5432/postgres" \
  --data-only --no-owner --no-privileges \
  -t public.brand_profiles -t public.products -t public.reference_materials \
  -t public.library_items -t public.creators -t public.influencer_campaigns \
  -t public.tournaments -t public.sops -t public.campaign_launches \
  -t public.auto_relaunch_states -t public.ig_messages \
  -t public.notion_connections -t public.onboarded_users \
  > data.sql
```

```bash
psql "postgresql://postgres:[NEW_PW]@db.[NEW_REF].supabase.co:5432/postgres" -f data.sql
```

빠진 테이블 2개는 의도예요 — `cron_runs` 는 실행 로그(버려도 됨), `personas` 는 기존 프로젝트에 아예 없던 테이블이에요 (아래 §5).

### 그린루틴만 골라 옮기려면

owner 컬럼이 있는 테이블만 필터가 가능해요. `user_email` = Owner Key(로그인 이메일), 자식 테이블은 `brand_profile_id`.

```sql
-- 먼저 그린루틴 brand profile id 확인
select id, user_email, data->>'brandName' from brand_profiles where data::text ilike '%그린루틴%';
```

| 테이블 | 필터 키 |
|---|---|
| `brand_profiles` | `id` / `user_email` |
| `products` · `reference_materials` | `brand_profile_id` |
| `library_items` · `creators` · `influencer_campaigns` | `user_email` |
| `tournaments` | `user_email` · `brand_profile_id` |
| `notion_connections` · `onboarded_users` | `user_key` / `user_email` |
| `ig_messages` | `ig_user_id` |

**`sops` · `campaign_launches` · `auto_relaunch_states` 는 owner 컬럼이 없어요** — 브랜드로 구분할 방법이 없으니 전량 이사 아니면 포기예요. (같은 이유로 이 3개는 RLS 도 못 켜요.)

## 3. cron (쓰고 있다면)

토너먼트 폴러를 Supabase pg_cron 으로 돌리고 있었다면 [`pg-cron.sql`](./pg-cron.sql) 을 새 프로젝트에서 다시 실행해요. Vault 시크릿 2개(`app_base_url`·`cron_secret`)는 **프로젝트마다 새로 등록**해야 해요 — dump 에 안 따라와요.

## 4. ⚠️ 스토리지 파일은 `pg_dump` 로 안 옮겨져요

`products.image_url` 과 `reference_materials.storage_url` 은 **기존 프로젝트를 가리키는 public URL 문자열**이에요. 테이블만 옮기면 URL 은 그대로 남고, 기존 프로젝트를 지우는 순간 제품 이미지와 참고 자료가 전부 깨져요.

§0 의 스토리지 카운트가 0이면 이 단계는 건너뛰어요. 아니면 버킷이 public 이라 URL 로 받아서 새 프로젝트에 다시 올릴 수 있어요:

```js
// node migrate-storage.mjs  — 새 프로젝트 기준 env 3개 필요
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const JOBS = [
  { table: "products",            col: "image_url",   bucket: "product-images" },
  { table: "reference_materials", col: "storage_url", bucket: "reference-materials" },
];

for (const { table, col, bucket } of JOBS) {
  const { data: rows, error } = await sb.from(table).select(`id, ${col}`).not(col, "is", null);
  if (error) throw error;

  for (const row of rows) {
    const url = row[col];
    if (!url || url.startsWith("data:")) continue;      // 인라인 data URL 은 이사 불필요
    const path = new URL(url).pathname.split(`/${bucket}/`)[1];
    if (!path) { console.warn(`경로 파싱 실패 — ${table}/${row.id}`); continue; }

    const res = await fetch(url);                        // 기존 프로젝트에서 받기
    if (!res.ok) { console.warn(`다운로드 실패 ${res.status} — ${url}`); continue; }
    const body = Buffer.from(await res.arrayBuffer());

    const { error: upErr } = await sb.storage.from(bucket)
      .upload(path, body, { contentType: res.headers.get("content-type") ?? undefined, upsert: true });
    if (upErr) { console.warn(`업로드 실패 — ${path}: ${upErr.message}`); continue; }

    const next = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    await sb.from(table).update({ [col]: next }).eq("id", row.id);
    console.log(`ok ${table}/${row.id} → ${path}`);
  }
}
```

**기존 프로젝트를 지우기 전에** 돌려야 해요 — 소스 URL 이 살아 있어야 받을 수 있어요.

## 5. `personas` 는 새 테이블이에요

`personas` 는 기존 프로젝트에 없었어요. 코드가 `syncUpsert("persona", …)` 로 camelCase 를 던지고 있었고, 테이블도 없고 컬럼명 규약도 안 맞아서 [`supabase-sync`](../src/shared/lib/supabase-sync.ts) 가 에러를 삼킨 채 조용히 실패해 왔어요.

`schema.sql` 에 `personas` 를 만들고 [`usePersonasStorage`](../src/features/brand-profile/model/usePersonasStorage.ts) 의 `personaRow` 가 snake_case 로 매핑하도록 고쳤어요. 페르소나는 localStorage 가 primary 라 **이사할 데이터는 없고**, 새 프로젝트에서 저장하는 순간부터 미러가 쌓이기 시작해요.

## 6. 검증

```bash
npm run dev
```

- 브랜드 프로필 목록이 뜨는지 (`brand_profiles` 읽기 = 서버 라우트 + service-role)
- 제품 이미지·참고 자료 파일이 깨지지 않았는지 (§4 성공 여부)
- 라이브러리·인플루언서 목록 (`/api/stores/*`)
- cron 쓰면 `GET /api/cron/health` → `status: ok`

anon 키로 서버 전용 테이블이 막혔는지 확인 (빈 배열이 정상):

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/notion_connections?select=access_token" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" | head -c 200
```
