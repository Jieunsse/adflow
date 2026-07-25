# Supabase → Java/Spring Boot 백엔드 모노레포 전환 설계

작성일 2026-07-25 · 상태: 승인됨 (구현 계획 미작성)

## 1. 배경

Supabase 무료 티어 한계에 걸려 영속 레이어를 옮긴다. 다만 전환의 실제 동기는 비용이 아니라 **Java/Spring 역량 확보와 팀 표준(Java) 부합**이다. 이 동기가 경계 설정을 지배한다 — 얇은 CRUD 프록시는 포트폴리오 가치도 낮고 "Java 팀이 유지보수한다"는 주장도 못 하므로, 도메인 로직이 실제로 Java 쪽에 있어야 한다.

무료 티어 한계의 실제 원인은 **조직당 활성 프로젝트 2개 제한**일 가능성이 높다(신규 프로젝트 생성 직후 발생, 데이터는 수십 행 규모). 즉 이 전환은 비용 문제 해결책이 아니라 의도된 아키텍처 선택이다.

### 현 상태 실측

| 영역 | 규모 | 성격 |
|---|---|---|
| API 라우트 | 82개 / 4,018줄 | — |
| ㄴ DB 접촉 | **25개** | 이관 대상 |
| ㄴ Meta·AI·OAuth·SSE | 57개 | 이관해도 이득 없음 |
| `lib/` Meta·AI 클라이언트 | 7,809줄 | 일부만 Java 재작성 |
| `src/` 도메인 + UI | 28,624줄 | 토너먼트 엔진 2,553줄 포함 |
| Vitest | 64파일 / 674 tests | 일부 JUnit 이관 |
| Supabase 테이블 | 15개 | → 약 30개로 정규화 |
| Storage 버킷 | 2개 (`product-images`·`reference-materials`) | Spring 이 인수 |

Supabase 가 제공하던 것은 네 가지다 — Postgres, PostgREST(자동 REST), Storage, pg_cron. **Spring Boot 은 이 중 REST 계층만 대체한다.** 나머지 세 개는 각각 대체물이 필요하다.

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 경계 | Spring 이 영속 + 토너먼트 도메인 + 스케줄러를 소유 |
| 디렉토리 | `apps/web` + `apps/api` + `packages/contracts` |
| 계약 | OpenAPI → TypeScript 타입 자동생성 |
| 인증 | Spring Security + 자체 JWT 발급. JWT 는 Next.js 서버만 보유 |
| 인가 | `role` 을 `@PreAuthorize` 로 서버에서 강제 |
| Meta 토큰 | `meta_connections` 테이블 분리 + 컬럼 암호화 |
| 데이터 모델 | 전면 정규화 (한 번에). 도메인 타입 소유권 TS → Java |
| Meta 클라이언트 | Java 로 재작성 (~1,500줄) |
| TS 엔진 | 둘러보기 전용으로 존치 (이중화 감수) |
| DB | 로컬 Docker Postgres 로 시작. 호스팅은 추후 |
| 마이그레이션 도구 | 로컬 동안 `ddl-auto`. 배포 전 Flyway 필수 |
| 둘러보기 모드 | Spring 을 호출하지 않고 자립 |
| 데이터 이사 | Node 스크립트 → Spring API POST |

## 3. 아키텍처

### 런타임

JDK 21 (Temurin 21.0.10 설치 확인) + Spring Boot 3.5.x + Gradle Kotlin DSL(wrapper). JDK 21 의 virtual threads 는 계정별 Meta API 병렬 호출에 그대로 이득.

### 디렉토리

```
apps/
  web/                  Next.js 16 (이동)
  api/                  Spring Boot
packages/
  contracts/
    openapi.yaml        Spring 이 생성
    types/              openapi-typescript 산출물
    fixtures/           엔진 동등성 검증용 골든 JSON
docker-compose.yml      Postgres (+ 선택적 api)
```

이동 비용: `@shared/*`·`@entities/*`·`@features/*`·`@widgets/*` 4개 경로 별칭과 `next.config`·`eslint`·`vitest` 설정 경로 수정. 기여자가 혼자이고 CI 가 없는 지금이 이 이동의 최저 비용 시점이다.

### 책임 분담

| Next.js (`apps/web`) | Spring (`apps/api`) |
|---|---|
| UI 전체 | 영속 (약 30 테이블) |
| Meta Graph 프록시 57 라우트 | 토너먼트 도메인 (순수 엔진 + 어댑터) |
| AI 생성 (Gemini·Claude) | 스케줄러 (`@Scheduled` 폴러) |
| OAuth 콜백 (Facebook·Instagram·Notion) | Meta 게재·인사이트 (폴러용, Java 재작성) |
| SSE 2개 (`dm-stream`·`notifications`) | 파일 스토리지 |
| 둘러보기 mock 21 라우트 + TS 클라 러너 | 인증 토큰 발급·인가 |

### 계약

Spring 이 `springdoc-openapi` 로 OpenAPI 3 스펙을 내고, `openapi-typescript` 가 TS 타입을 생성한다. DTO 를 Java·TS 양쪽에 손으로 쓰면 드리프트가 시작되므로 생성으로 못박는다. 전면 정규화 결정에 따라 **도메인 타입의 진실은 Java 엔티티**이고 프론트는 생성된 타입을 소비한다.

### 백엔드 호출 격리

Spring 을 호출하는 코드는 `apps/web/src/shared/lib/backend/` 한 모듈에만 둔다. 현재 `getSupabaseServer()` 가 있던 자리다. 기존 `isRealOwner()` 게이트를 그대로 물려 게스트면 호출이 발생하지 않게 한다.

## 4. 인증·인가

로그인은 NextAuth 가 계속 담당한다 — Meta OAuth 는 Facebook provider 가 처리하고 Meta 액세스 토큰은 거기서만 나온다. 따라서 Spring 이 토큰을 발급하려면 교환 단계가 필요하다.

```
1. Facebook 로그인 → NextAuth 세션 성립 (Meta 토큰 확보)
2. Next.js(서버) ──▶ POST /auth/exchange   [내부 시크릿 + Owner Key + Meta 토큰]
   Spring: meta_connections 에 암호화 저장, 자체 JWT(access + refresh) 발급
3. Spring JWT 를 NextAuth 세션에 보관 (브라우저에 노출하지 않음)
4. 이후 호출: Authorization: Bearer <springJwt>
```

Spring 은 정통 JWT 리소스 서버로 구성한다 — `SecurityFilterChain`, `JwtDecoder`, `@PreAuthorize`.

### NextAuth JWT 를 Spring 이 직접 검증하지 않는다

NextAuth v4 세션 토큰은 JWE(A256GCM + HKDF)로 암호화돼 있고 그 형식은 공개 계약이 아니다. Java 로 복호화를 재현할 수는 있으나 NextAuth 버전을 올리면 조용히 깨진다. 교환 방식은 이 결합을 만들지 않는다.

### JWT 를 브라우저에 내리지 않는 이유

Spring Security 구성(리소스 서버·인가·메서드 시큐리티)은 그대로 얻으면서 백엔드 토큰을 XSS 사정거리에서 빼고 CORS 를 열지 않는다. Spring 을 인터넷에 노출할 필요도 없어진다. 추후 브라우저 직접 호출로 전환하려면 CORS 만 열면 되므로 문을 닫는 결정이 아니다.

### 인가

현재 `role`(`팀장`·`팀원·게재`·`팀원·검토`)은 세션에만 있고 **어디서도 강제되지 않는다.** 이를 Spring authorities 로 승격해 `@PreAuthorize` 로 실제 인가를 건다. 자격증명 교체·삭제 같은 팀장 전용 작업이 처음으로 서버에서 막힌다.

### Owner Key 가 두 가지 의미로 쓰이고 있다 (이관 시 함정)

현재 코드에 소유자 식별 키가 **세 종류** 있다. 이관 전에 하나로 정리해야 한다.

| 출처 | 값 | 쓰는 곳 |
|---|---|---|
| ADR-046 Owner Key (`ownerKey.ts`) | `session.user.email` | Synced Store 4개의 `user_email` 컬럼 |
| `ownerKeyFrom(email, accessToken)` (`real.ts`) | email 우선, 없으면 **액세스 토큰 SHA-256 앞 24자** | `tournaments.user_email` |
| `hashToken(ownerToken)` (`registry.ts`) | 액세스 토큰 해시 | SSE 커넥션 registry 키 |

두 번째의 폴백이 문제다. Facebook provider 가 email scope 를 못 받은 계정은 `tournaments.user_email` 에 **email 이 아니라 토큰 해시**가 들어가 있다. Spring 이 email 로 표준화하면 그런 기존 행은 소유자를 잃는다.

**결정**: Spring 은 `owner_key` 를 단일 컬럼으로 갖고 값은 email 로 표준화한다. 토큰 해시로 저장된 기존 행은 단계 7 의 ETL 에서 식별해 매핑하거나(해당 계정의 현재 토큰으로 해시를 재계산해 대조) 폐기 대상으로 분류한다. 데이터가 수십 행 규모이므로 실측 후 판단한다.

### Meta 토큰 저장

현재 폴러는 토큰을 `tournaments.data` jsonb 안의 delivery 봉투에서 읽는다(코드 주석에 명시). 이를 `meta_connections` 테이블(Owner Key 기준)로 분리하고 JPA `AttributeConverter` + AES-GCM 으로 컬럼 암호화한다. 키는 환경변수.

부수 효과로 "다음 로그인 시 Meta 연결 자동 복원"이 되살아난다. 이는 axhub 정리(`4a60f78`)에서 삭제한 `lib/user-store.ts` 가 풀려던 문제이며, 이번에는 axhub 신원이 아니라 email(Owner Key) 기준으로 구현한다.

## 5. 데이터 모델

### 현 store 패턴 (4:4 로 갈림)

| 패턴 | store | 상태 |
|---|---|---|
| Tier 1 `createSyncedStore`<br/>서버=진실의 원천, localStorage=오프라인 캐시 | `brand_profiles` `library_items`<br/>`creators` `influencer_campaigns` | 건강함. RLS 가 걸린 4개와 일치 |
| 레거시 미러 `syncUpsert`<br/>localStorage=primary, 서버=fire-and-forget | `sops` `personas`<br/>`auto_relaunch_states` `campaign_launches` | 에러를 삼킴 |

레거시 4개는 anon 키로 브라우저에서 직접 write 하므로 Supabase 제거와 함께 **Tier 1 승격이 강제된다.**

`src/shared/lib/supabase-sync.ts` 의 `.then(() => {}, () => {})` 는 제거한다. 이 에러 삼킴이 persona 미러 실패(테이블 부재 + camelCase payload)를 몇 달간 숨긴 원인이다. Spring 클라이언트에 같은 함정을 만들지 않는 것이 이 섹션의 원칙이다.

### 전면 정규화

테이블 15개 → 약 30개.

| 애그리거트 | 펼쳐지는 테이블 |
|---|---|
| Tournament | `tournaments` `tour_rounds` `tour_variants` `hypotheses` `tournament_delivery` + `envelope` 임베디드 |
| BrandProfile | `brand_profiles` `copy_references` `goals` `policy_sections` |
| Creator · InfluencerCampaign · LibraryItem | 각 1~3개 |
| 이미 정규화됨 | `products` `reference_materials` `personas` `sops` `ig_messages` `onboarded_users` `notion_connections` `cron_runs` `campaign_launches` `auto_relaunch_states` |

`Tournament` 는 29개 필드에 중첩 타입 6개(`TourEnvelope`·`TourVariant`·`TourRound`·`Hypothesis`·`TournamentDelivery`·`VariationIntensity`)를 가지며 `TourRound` 자체가 복합 객체 배열이다. JPA 학습 재료로 적합하다 — `@OneToMany` 캐스케이드, `@Embedded`, enum 매핑, 낙관적 락.

정규화 결과 프론트의 Synced Store 계약 `{ id, user_email, data }` 는 전부 제대로 된 DTO 로 바뀐다. 이는 "백엔드 추가"가 아니라 **도메인 소유권 이전**이며 의도된 선택이다.

### 스토리지

버킷 2개를 Spring 이 인수한다. 로컬은 파일시스템 볼륨, 배포 시 S3 호환(R2·MinIO)으로 갈아끼울 수 있게 인터페이스 하나만 둔다.

`products.image_url`·`reference_materials.storage_url` 이 절대 URL 이라 호스팅이 바뀌면 DB 를 고쳐야 한다. **API 응답에서 조립하도록 바꾼다** — 저장은 상대 경로, 노출은 조립. 그러면 호스팅 변경이 DB 마이그레이션을 유발하지 않는다.

## 6. 토너먼트 도메인 이관

### Java 로 옮길 순수 엔진 (I/O 없음, 1:1 포팅)

`engine.ts` · `hypothesis.ts` · `ledger.ts` · `transitions.ts` · `lever.ts` · `objective-metric.ts` · `report.ts`

### 포트와 어댑터

이미 헥사고날 구조다. `createServerRunner({ store, launcher, kpiSource })`.

| TS 포트 | Java 어댑터 |
|---|---|
| `TournamentStore` | JPA 리포지토리 |
| `RoundLauncher` | Meta 게재 (`meta-launcher.ts` 68줄) |
| `KpiSource` | Meta KPI (`meta-kpi-source.ts` 57줄) |

### Meta 클라이언트 Java 재작성 (~1,500줄)

어댑터 자체는 125줄이지만 그 밑의 `lib/meta-ads-campaign.ts`(729줄)와 `lib/meta-ads-insights.ts`(738줄)를 Java 로 다시 써야 한다. **이 전환의 최고 위험 조각이다** — Meta API 예외 처리와 스플릿 테스트 파라미터가 TS 쪽에서 이미 실전 검증된 코드다. WebClient + 재시도 + 레이트 리밋을 Java 로 구현한다.

### 스케줄러와 동시성

`@Scheduled` 6시간 주기. 폴러와 UI 가 같은 토너먼트를 동시에 수정할 수 있어 `@Version` 낙관적 락이 실제로 필요하다. 현재는 `data jsonb` 통짜 덮어쓰기라 이 경합이 조용히 유실될 수 있으며, 정규화로 해결된다.

### SSE 알림 다리 (필수)

`lib/notifications/registry.ts` 의 `const registry = new Map<string, UserEntry>()` 는 Next.js **프로세스 내 메모리**에 열린 SSE 커넥션을 보관한다. Spring 폴러는 다른 프로세스라 여기에 닿을 수 없다.

```
Spring 폴러 ──▶ POST /api/internal/notify/tournament-concluded ──▶ Next.js 가 SSE fanout
              (내부 시크릿)
```

주의: 이 registry 는 email 이 아니라 **Meta 액세스 토큰의 해시**로 키를 잡는다(`hashToken(ownerToken)`). Spring 이 토큰을 복호화해 해시를 계산하는 대신 **Owner Key 를 넘겨 Next.js 가 해석**하게 한다 — 토큰을 프로세스 경계 밖으로 덜 옮기는 쪽이 안전하다.

## 7. 둘러보기 모드 (제약)

**둘러보기는 Spring 을 절대 호출하지 않는다.** 이는 요구사항이며 설계 제약이다.

현재 둘러보기는 백엔드 없이 돌지 않는다 — `browseMode` 분기가 73개 파일에 있고 그중 21개가 API 라우트로, mock 이 서버측(`lib/mock-*.ts`·`lib/demo/`)에 있다. 게스트 세션도 NextAuth `CredentialsProvider`(`id: "guest"`)라 JWT 서명에 서버가 필요하다.

"백엔드 없이"의 범위는 **Spring 만 호출하지 않는 것**으로 확정했다. Next.js 라우트는 계속 쓴다. 따라서:

- 둘러보기 mock 21 라우트는 Next.js 에 그대로 남는다
- TS 클라이언트 러너(`runner.ts`, `"use client"`)를 존치해 둘러보기가 엔진을 계속 돌린다
- 게스트는 `/auth/exchange` 를 타지 않으므로 Spring JWT 를 발급받지 않는다
- `isRealOwner()` 게이트가 게스트의 백엔드 호출을 원천 차단한다

**대가**: 순수 엔진이 TS·Java 양쪽에 상시 이중화된다. 규칙 변경 시 양쪽을 고쳐야 하고, 드리프트하면 둘러보기와 실사용의 판정이 갈린다. 이를 §8 의 골든 픽스처로 방어한다.

## 8. 테스트 전략

### 골든 픽스처 공유 검증 (이중화의 안전장치)

기존 TS 테스트 10파일 1,342줄(`tournament.test.ts`·`hypothesis.test.ts`·`cascade.test.ts`·`server-runner.test.ts` 등)의 케이스를 `packages/contracts/fixtures/` 아래 JSON 으로 추출한다. TS 테스트와 JUnit 테스트가 **같은 픽스처를 읽어 같은 결과를 요구**한다. 한쪽 엔진이 어긋나면 CI 에서 즉시 드러난다.

| 대상 | 전략 |
|---|---|
| 순수 엔진 (TS·Java 양쪽) | 공유 JSON 픽스처 동등성 검증 |
| 나머지 54개 TS 테스트파일 | 그대로 유지 |
| Spring 영속·리포지토리 | Testcontainers Postgres 통합 테스트 |
| Spring Security 인가 | `@WithMockUser` + `@PreAuthorize` 역할별 검증 |
| OpenAPI 계약 | 생성 타입 변경 시 프론트 컴파일 실패 → 드리프트 즉시 발견 |

`ddl-auto` 를 쓰는 동안 Testcontainers 가 엔티티 매핑 오류를 잡는 역할도 겸한다.

## 9. 실행 순서

각 단계가 끝난 시점에 앱이 동작하는 상태로 둔다. 중간에 멈춰도 안전해야 한다.

| 단계 | 내용 | 끝난 뒤 상태 |
|---|---|---|
| 0 | 모노레포 재배치, Docker Postgres, Spring 스켈레톤 | 프론트는 여전히 Supabase. 동작 유지 |
| 1 | 인증 — `/auth/exchange`, JWT 리소스 서버, `meta_connections` 암호화 | Spring 이 신원을 알지만 데이터는 Supabase |
| 2 | Synced Store 4개 정규화 + 엔드포인트, 프론트 어댑터 교체 | Supabase 의존 4개 제거 |
| 3 | 레거시 미러 4개 Tier 1 승격 | 브라우저 직접 write 소멸 |
| 4 | 나머지 테이블 + 스토리지 버킷 2개 | 토너먼트만 Supabase 에 남음 |
| 5 | 토너먼트 정규화 + 순수 엔진 Java 포팅 + 골든 픽스처 | 도메인 판정은 Java. 트리거·Meta I/O 는 아직 TS |
| 6 | Meta 클라이언트 Java 재작성 + `@Scheduled` 폴러 + SSE 다리 | 폴러가 Spring 에서 무인 동작 |
| 7 | Supabase 제거 + 그린루틴 데이터 이사 | 전환 완료 |

단계 5 와 6 의 경계를 명확히 한다. 단계 5 를 마친 시점에 Java 엔진이 판정을 소유하지만 Meta 호출은 아직 TS 에 있다. 따라서 기존 `app/api/cron/tournament-poller` 는 **얇은 트리거로 남아** Spring 의 라운드 진행 엔드포인트를 호출하고, Meta 게재·KPI 조회는 Spring 이 Next.js 내부 엔드포인트에 역위임한다. 단계 6 에서 그 역위임을 없애고 트리거를 `@Scheduled` 로 흡수한다.

이 중간 상태는 왕복이 생겨 지저분하지만 **단계 5 를 독립적으로 검증 가능하게 만드는 값을 준다** — 엔진 포팅의 정합성을 Meta 클라이언트 재작성 위험과 분리해서 확인할 수 있다.

### 그린루틴 데이터 이사

전면 정규화 때문에 `pg_dump` 로 안 된다 — jsonb 를 펼쳐 새 구조에 넣어야 하므로 일회성 ETL 이 필요하다.

**Node 스크립트가 Supabase 에서 읽어 Spring 엔드포인트로 POST 한다.** 직접 DB 인서트보다 나은 이유 세 가지:

1. Spring 의 검증·엔티티 매핑을 타므로 데이터가 스키마에 맞는지 자동 검증된다
2. 같은 스크립트로 스토리지 파일까지 옮길 수 있다
3. 이사 스크립트가 곧 API 통합 테스트 역할을 겸한다

스토리지 파일은 **기존 Supabase 프로젝트를 살려둔 상태에서** 옮겨야 한다. `image_url`·`storage_url` 이 기존 프로젝트를 가리키는 public URL 이므로 소스가 살아 있어야 받을 수 있다.

### 구현 계획의 단위

이 설계 전체는 단일 구현 계획으로 다루기에 너무 크다. **단계마다 별도 계획을 세운다.** 각 단계가 끝난 시점에 앱이 동작하므로 계획 단위로 쪼개도 정합성이 유지된다.

첫 계획의 범위는 **단계 0(모노레포 재배치 + Docker Postgres + Spring 스켈레톤)** 으로 한다. 이 단계는 프론트 동작을 바꾸지 않으므로 실패 시 되돌리기가 쉽고, 이후 모든 단계의 전제가 된다.

## 10. 알려진 부채·리스크

| 항목 | 내용 | 해소 시점 |
|---|---|---|
| Flyway 미도입 | 로컬 동안 `ddl-auto`. 운영에 `ddl-auto` 로 나가면 데이터 유실 | **배포 결정 시점에 필수** |
| 엔진 이중화 | 순수 엔진이 TS·Java 양쪽에 존재 | 상시. 골든 픽스처로 방어 |
| Meta 클라이언트 재작성 | ~1,500줄. 실전 검증된 예외 처리를 다시 만듦 | 단계 6. 최고 위험 |
| 호스팅 미결정 | 무료 플랜은 대체로 슬립하며 JVM cold start 가 길다. 슬립하면 `@Scheduled` 폴러가 안 돈다 | 별도 논의. Oracle Cloud Always Free 또는 외부 cron 으로 기동 |
| 토큰 두 개 | NextAuth 세션 + Spring JWT. 갱신 경로 필요 | 단계 1 |
| jsonb → 정규화 파급 | `src/` 28,624줄이 현재 TS 타입에 의존 | 단계 2~5 에 분산 |
| Owner Key 3종 혼재 | 토큰 해시로 저장된 `tournaments` 행은 email 표준화 시 소유자 상실 | 단계 7 ETL 에서 실측 후 매핑 또는 폐기 |

## 11. 기각된 선택지

| 선택지 | 기각 이유 |
|---|---|
| 얇은 데이터 서비스 (CRUD 만) | PostgREST 재구현에 가까워 역량·팀표준 목적에 미달 |
| 풀 백엔드 (82 라우트 전부) | 둘러보기 때문에 Next.js 서버가 어차피 남아 "완전 분리" 이점이 반감. Meta OAuth·SSE 재구현 위험이 이득을 초과 |
| Spring 이 NextAuth JWT 직접 검증 | JWE 형식이 공개 계약이 아니라 NextAuth 업그레이드에 조용히 깨짐 |
| Spring JWT 를 브라우저에 노출 | XSS 사정거리 확대 + CORS 개방. 학습 가치는 서버 보유로도 확보됨 |
| 토너먼트만 정규화 (절충안) | 도메인 소유권을 Java 로 넘기기로 확정했으므로 일관성 부족 |
| `pg_dump` 데이터 이사 | 전면 정규화로 스키마가 달라져 성립하지 않음 |
| 둘러보기 정적 분리 (서버 호출 0) | 범위를 "Spring 만 미호출"로 확정. 추후 옵션으로 남김 |
