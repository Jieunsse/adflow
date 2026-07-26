# 단계 3 — 레거시 미러 4개 Tier 1 승격 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sops`·`personas`·`auto_relaunch_states`·`campaign_launches` 4개를 레거시 미러(localStorage=primary, 서버=fire-and-forget)에서 Tier 1(서버=진실의 원천)으로 승격한다. 끝나면 **브라우저가 Supabase 에 직접 쓰는 코드가 저장소에서 사라진다.**

**Architecture:** 단계 2 가 만든 골격을 그대로 쓴다 — Spring 의 `OwnerScoped`·`StoreController` 위에 엔티티 4개를 얹고, Next 의 `createStoreRoute` 로 프록시 라우트 4개를 낸다. 프론트는 `createSyncedStore` 로 갈아타되 **도메인 훅의 표면과 동기 리더(`readPersonas()`·`loadLaunchedCampaign()`·`useAutoRelaunch().get()`)를 그대로 유지**해 컴포넌트를 건드리지 않는다. 마지막에 `supabase-sync.ts` 와 브라우저 anon 클라이언트 `supabase.ts` 를 삭제한다.

**Tech Stack:** 단계 2 와 동일 — Spring Boot 4.1.0 · Jackson 3 · Hibernate 7 · Testcontainers 2.0.5 · JDK 21 · H2(단위) / PostgreSQL 16(통합) · Next.js 16 · Vitest

## Global Constraints

- **와이어 형태 동결.** 4개 도메인 타입(`Sop`·`PersonaEntry`·`AutoRelaunchEntry`·`LaunchedCampaign`)의 선언을 **한 줄도 바꾸지 않는다.** 안 맞으면 Java 쪽을 고친다.
- **도메인 훅의 표면 동결.** `usePersonasStorage()`·`useSopStorage()`·`useAutoRelaunch()` 의 반환 형태와 `readPersonas()`·`loadLaunchedCampaign()` 의 **동기 시그니처**가 그대로여야 한다. 이걸 지키면 컴포넌트 수정이 0이다.
- `./gradlew test` 는 **Docker 없이** green (H2). Testcontainers 는 `./gradlew integrationTest` 로만.
- **회귀 기준선**: `npm test` **691 tests / 66 files**, `./gradlew test` **39건**, `./gradlew integrationTest` **11건**. 이 숫자가 줄면 회귀다.
- `npm run build` · `npx tsc --noEmit --project apps/web/tsconfig.json` 성공 유지.
- **둘러보기는 Spring 을 호출하지 않는다.** `isRealOwner()` 게이트 유지 (설계 §7, 요구사항).
- 새 의존성 **없음** (Gradle·npm 모두).
- 커밋 메시지는 `type(scope): 한국어 설명`. **`Co-Authored-By:` 트레일러 금지.** `git push` 금지.
- **단계 3 시작 전 롤백 태그**: `git tag pre-phase3` (이미 찍혀 있다).

## 이 단계의 성과 지표

끝났을 때 아래가 참이어야 한다. 이게 "브라우저 직접 write 소멸"의 정의다.

```bash
# 둘 다 0 이어야 한다
grep -rn "syncUpsert\|syncDelete" apps/web/src apps/web/app apps/web/lib | wc -l
grep -rn "NEXT_PUBLIC_SUPABASE" apps/web/src apps/web/app apps/web/lib | wc -l
```

`apps/web/src/shared/lib/supabase-sync.ts` 와 `apps/web/src/shared/lib/supabase.ts` 는 **삭제**된다.

## 실측으로 확인된 사실

계획을 쓰기 전 코드를 읽고 탐침 컴파일·실행으로 확인했다. 추정이 아니다.

| 확인 항목 | 결과 |
|---|---|
| `getSupabase()`(브라우저 anon 클라이언트) 사용처 | **`supabase-sync.ts` 하나뿐.** 그것만 지우면 브라우저 직접 write 가 통째로 사라진다 |
| `syncUpsert`/`syncDelete` 사용처 | 실제 호출은 4파일 7곳. 그 외 2곳은 **테스트의 `vi.mock`** (`usePersonasStorage.test.ts`, `useGoalsStorage.test.ts`) — `useGoalsStorage.ts` 자체는 쓰지 않는다(방어적 mock) |
| `readPersonas()` | **동기 리더.** `create/page.tsx` 3곳·`brand-profile/page.tsx`·`instagram/posts/page.tsx` 등에서 렌더 중 직접 호출 |
| `loadLaunchedCampaign(id)` | **동기 리더.** `campaigns/[id]/page.tsx` 의 `useState(() => …)` 초기화자에서 호출 |
| `useAutoRelaunch().get(id)` | **동기 리더.** `presenter-fast-forward`·`campaigns/[id]` 에서 호출 |
| `auto-relaunch:{id}` · `adflow:launched:{id}` | **인덱스 키가 없다.** 기존 로컬 데이터를 흡수하려면 `localStorage` 키를 접두사로 스캔해야 한다 |
| `adflow:sop-index` + `adflow:sop:{id}` | 인덱스 키가 있다. 흡수가 쉽다 |
| `brandProfileStore.removeProfile` | **`adflow:personas` localStorage 를 직접 조작한다**(프로필 삭제 시 딸린 페르소나 제거). personas 가 store 로 옮겨가면 여기도 같이 고쳐야 한다 |
| `@JsonIgnoreProperties("id")` + `@JsonProperty("campaignId")` 접근자 쌍 | **동작함.** 탐침 결과 와이어가 `{"campaignId":"c_1","dailyBudget":5000}` — `id`·`ownerKey` 미노출. `campaignId` 를 PK 로 쓰는 두 엔티티가 `OwnerScoped` 를 그대로 상속할 수 있다 |
| 기존 테스트 | `usePersonasStorage.test.ts` 만 이 4개를 덮는다. `sops`·`autoRelaunch`·`launched-storage` 테스트는 **없다** |

## 설계 문서와 다르게 가는 2가지 (검토 요청)

**1. `campaign_launches` 는 얕게 다룬다.** 설계 §5 는 이 테이블을 "이미 정규화됨"으로 분류했고 단계 3 의 목표는 정규화가 아니라 **브라우저 직접 write 제거**다. `LaunchedCampaign` 의 필드 중 셋은 OpenAPI 로 표현할 수 없다 — `adIds?: [string, string]`(TS 튜플), `abTestVariantB`(판별 유니온), `goalId?: ObjectivePhase1Id`(const 배열에서 파생된 유니온). 스칼라는 컬럼으로 펼치고 이 셋은 각각 `List<String>`·JSON 컬럼·`String` 으로 둔다. **계약이 못 지키는 필드가 셋 생기고, 이것이 단계 3 에서 가장 약한 계약이다.** 이 사실을 `contract-compat.ts` 에 적어 남긴다.

**2. `sops` 의 `runVersionReset()` 을 유지한다.** v1/v0.5 로컬 데이터를 폐기하는 멱등 리셋이다(ADR-020). 서버로 승격하면서 이걸 없애면 옛 모양의 로컬 데이터가 서버로 올라간다. **흡수 직전에 그대로 돌린다.**

## 계약이 지켜주지 못하는 필드 (기록)

와이어를 동결했으므로 나머지는 전부 컴파일러가 지킨다. 아래 넷만 예외이고 이유가 있다.

| 필드 | 이유 | 대신 지키는 것 |
|---|---|---|
| `Sop.sections` | `SopSection` 이 판별 유니온 (단계 2 의 `BrandProfile.policy` 와 같은 부류) | 왕복 단위·통합 테스트 |
| `LaunchedCampaign.adIds` | TS 튜플 `[string, string]`. OpenAPI 3.1 의 `prefixItems` 를 springdoc 이 내지 않는다 | 길이 2 왕복 테스트 |
| `LaunchedCampaign.abTestVariantB` | 판별 유니온 | 왕복 테스트 |
| `LaunchedCampaign.goalId` | `(typeof OBJECTIVES_PHASE1)[number]['id']` — const 배열 파생 유니온. Java 에 옮기면 목록이 두 곳에 살아 드리프트한다 | `String` 으로 두고 값 왕복만 |

---

## File Structure

**apps/api — 신규**

| 경로 | 책임 |
|---|---|
| `store/sop/Sop.java` · `SopRepository.java` · `SopController.java` | `/stores/sops` |
| `store/persona/Persona.java` · `PersonaRepository.java` · `PersonaController.java` | `/stores/personas` |
| `store/relaunch/AutoRelaunchState.java` · `AutoRelaunchStateRepository.java` · `AutoRelaunchController.java` | `/stores/auto-relaunch` |
| `store/launch/CampaignLaunch.java` · `LaunchStatus.java` · `CampaignLaunchRepository.java` · `CampaignLaunchController.java` | `/stores/campaign-launches` |
| `src/test/java/.../store/{sop,persona,relaunch,launch}/*ControllerTest.java` | 와이어 형태 검증 |
| `src/integrationTest/java/.../store/{sop,launch}/*PostgresIT.java` | 정규화·JSON 컬럼 실측 |

**apps/web — 수정**

| 경로 | 책임 |
|---|---|
| `src/shared/lib/store/createSyncedStore.ts` | `idOf`·`migrate` 옵션 추가 (도메인 타입을 안 건드리기 위한 확장) |
| `app/api/stores/{sops,personas,auto-relaunch,campaign-launches}/route.ts` (신규 4) | Spring 프록시 |
| `src/features/sop/model/useSopStorage.ts` | Tier 1 승격 (훅 표면 유지) |
| `src/features/brand-profile/model/usePersonasStorage.ts` | Tier 1 승격 (`readPersonas()` 동기 유지) |
| `src/features/brand-profile/model/brandProfileStore.ts` | personas localStorage 직접 조작 제거 |
| `src/shared/lib/autoRelaunch.ts` | Tier 1 승격 (`get()` 동기 유지) |
| `src/entities/campaign/launched-storage.ts` | Tier 1 승격 (`loadLaunchedCampaign()` 동기 유지) |
| `src/shared/lib/supabase-sync.ts` · `src/shared/lib/supabase.ts` | **삭제** |
| `src/shared/lib/backend/contract-compat.ts` | 신규 4종 호환성 단언 |

---

## Task 1: `createSyncedStore` 확장 — `idOf` 와 레거시 키 흡수

승격 대상 4개는 단계 2 의 4개와 두 가지가 다르다.

1. `AutoRelaunchEntry`·`LaunchedCampaign` 의 식별자는 `id` 가 아니라 **`campaignId`** 다. 도메인 타입을 못 바꾸므로 팩토리가 id 추출을 위임받아야 한다.
2. 넷 다 **기존 localStorage 키가 persist 봉투와 다르다.** 최초 1회 흡수 경로가 필요하다. `brandProfileStore` 가 이미 손으로 하고 있는 일을 옵션으로 끌어올린다.

**Files:**
- Modify: `apps/web/src/shared/lib/store/createSyncedStore.ts`
- Modify: `apps/web/src/shared/lib/store/createSyncedStore.test.ts`

**Interfaces:**
- Consumes: 단계 2 의 `SyncedState`·`useSyncErrorToast`
- Produces:
  - `SyncedStoreConfig` 에 옵션 2개 추가 — `idOf?: (item: T) => string` (기본 `(i) => i.id`), `migrate?: () => T[]` (persist 캐시가 비었을 때 1회 호출)
  - `SyncedItem` 제약 완화 — `id` 가 있는 타입만이 아니라 `idOf` 로 식별 가능한 임의 객체를 받는다
  - `SyncedStore<T>` 에 `snapshot(): T[]` 추가 — 동기 리더의 공통 구현 (지금은 도메인마다 손으로 쓰고 있다)

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/web/src/shared/lib/store/createSyncedStore.test.ts` 의 `describe("createSyncedStore", …)` 안 끝에 붙인다.

```ts
  it("idOf 로 id 가 아닌 키를 쓸 수 있어요", async () => {
    interface KeyedItem {
      campaignId: string;
      enabled: boolean;
    }
    const { useStore } = createSyncedStore<KeyedItem>({
      name: "test_keyed_" + Math.random().toString(36).slice(2),
      endpoint: "/api/test-keyed",
      idOf: (i) => i.campaignId,
    });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await useStore.getState().hydrate("real@x.com");

    useStore.getState().add({ campaignId: "c1", enabled: true });
    useStore.getState().add({ campaignId: "c1", enabled: false });
    // 같은 campaignId 는 중복되지 않고 교체돼야 한다.
    expect(useStore.getState().items).toHaveLength(1);
    expect(useStore.getState().items[0].enabled).toBe(false);

    useStore.getState().removeById("c1");
    expect(useStore.getState().items).toHaveLength(0);
    // DELETE 쿼리도 campaignId 로 나가야 한다.
    const deleteCall = fetchMock.mock.calls.find((c) => c[1]?.method === "DELETE");
    expect(deleteCall?.[0]).toBe("/api/test-keyed?id=c1");
  });

  it("persist 캐시가 비면 migrate 로 레거시 데이터를 한 번 흡수해요", () => {
    const migrate = vi.fn(() => [{ id: "legacy1", v: 9 }]);
    const { useStore, rehydrate } = createSyncedStore<TItem>({
      name: "test_migrate_" + Math.random().toString(36).slice(2),
      endpoint: "/api/test",
      migrate,
    });
    rehydrate();
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(useStore.getState().items).toEqual([{ id: "legacy1", v: 9 }]);

    // 두 번째 rehydrate 에서는 캐시가 차 있으므로 다시 흡수하지 않는다.
    rehydrate();
    expect(migrate).toHaveBeenCalledTimes(1);
  });

  it("snapshot 은 워밍된 items 를 동기로 돌려줘요", () => {
    const { useStore, snapshot } = createSyncedStore<TItem>({
      name: "test_snapshot_" + Math.random().toString(36).slice(2),
      endpoint: "/api/test",
    });
    expect(snapshot()).toEqual([]);
    useStore.getState().setAll([{ id: "a", v: 1 }]);
    expect(snapshot()).toEqual([{ id: "a", v: 1 }]);
  });
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/store/createSyncedStore.test.ts
```

기대: FAIL — `idOf`·`migrate`·`snapshot` 이 없어 타입 에러 또는 런타임 실패.

- [ ] **Step 3: 팩토리를 확장한다**

`apps/web/src/shared/lib/store/createSyncedStore.ts` 를 아래대로 고친다.

`SyncedItem` 제약과 설정 인터페이스를 바꾼다.

```ts
// idOf 로 식별자를 뽑을 수 있으면 되므로 id 필드를 강제하지 않는다.
// 기본값이 (i) => i.id 라 기존 store 4개는 그대로 동작한다.
export type SyncedItem = Record<string, unknown> | { id: string };

export interface SyncedStoreConfig<T = unknown> {
  // persist 키(localStorage). 도메인 store 의 기존 키를 유지하면 오프라인 캐시 승계.
  name: string;
  // per-entity API 라우트. GET→{items}, POST {item}, DELETE ?id=.
  endpoint: string;
  // 식별자 추출. campaignId 처럼 id 가 아닌 키를 쓰는 도메인 타입을 위해 위임받는다.
  idOf?: (item: T) => string;
  // persist 캐시가 비었을 때 1회 호출. 레거시 localStorage 키에서 데이터를 건져 올린다.
  // 반환값이 비어 있으면 아무 일도 하지 않는다.
  migrate?: () => T[];
}
```

`SyncedStore` 인터페이스에 `snapshot` 을 더한다.

```ts
export interface SyncedStore<T extends SyncedItem> {
  useStore: UseBoundStore<StoreApi<SyncedState<T>>>;
  useSync: () => void;
  rehydrate: () => void;
  // 훅 밖 동기 리더용. 워밍된 items 를 그대로 준다. 서버에서는 빈 배열.
  snapshot: () => T[];
}
```

시그니처와 본문 앞부분을 바꾼다.

```ts
export function createSyncedStore<T extends SyncedItem>(
  config: SyncedStoreConfig<T>,
): SyncedStore<T> {
  const idOf = config.idOf ?? ((item: T) => (item as { id: string }).id);

  const useStore = create<SyncedState<T>>()(
```

`add`·`upsert`·`removeById` 의 id 비교를 `idOf` 로 바꾼다.

```ts
        add: (item) => {
          // optimistic — 로컬 즉시 반영(id 중복 제거 후 prepend) 뒤 서버 확정.
          set((s) => ({ items: [item, ...s.items.filter((x) => idOf(x) !== idOf(item))] }));
          postItem(item);
        },

        upsert: (item) => {
          // add 와 달리 기존 위치 보존(편집·플래그 토글용) — id 있으면 제자리 교체, 없으면 prepend.
          set((s) => {
            const idx = s.items.findIndex((x) => idOf(x) === idOf(item));
            if (idx < 0) return { items: [item, ...s.items] };
            const next = s.items.slice();
            next[idx] = item;
            return { items: next };
          });
          postItem(item);
        },

        removeById: (id) => {
          set((s) => ({ items: s.items.filter((x) => idOf(x) !== id) }));
```

반환부를 바꾼다. `rehydrate` 가 흡수를 겸한다.

```ts
  // persist 캐시 복원 + 최초 1회 레거시 흡수. 캐시가 이미 차 있으면 흡수하지 않는다.
  function rehydrate(): void {
    void useStore.persist.rehydrate();
    if (!config.migrate) return;
    if (useStore.getState().items.length > 0) return;
    const legacy = config.migrate();
    if (legacy.length > 0) useStore.getState().setAll(legacy);
  }

  return {
    useStore,
    useSync,
    rehydrate,
    snapshot: () => (typeof window === "undefined" ? [] : useStore.getState().items),
  };
}
```

`useSync` 안의 `useStore.persist.rehydrate()` 직접 호출도 새 `rehydrate()` 로 바꾼다.

```ts
    useEffect(() => {
      // persist 캐시 먼저 복원(+ 레거시 흡수) → 그 위에 서버 하이드레이션.
      rehydrate();
      void useStore.getState().hydrate(owner);
    }, [owner]);
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/store/createSyncedStore.test.ts
```

기대: PASS. 기존 15건 + 신규 3건 = 18건.

- [ ] **Step 5: 기존 store 4개가 안 깨졌는지 확인한다**

`SyncedItem` 제약을 푼 것이 기존 사용처에 번지는지 본다.

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
```

기대: tsc 에러 0 · `Tests 694 passed` (691 + 3).

타입 에러가 나면 `SyncedItem` 완화가 과했다는 뜻이다. 그 경우 `Record<string, unknown> | { id: string }` 대신 제네릭 제약을 지우고 `T` 를 자유롭게 두되 `idOf` 를 필수로 만드는 쪽을 검토한다.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git branch --show-current   # dev 확인
git add apps/web
git commit -m "refactor(web): createSyncedStore 에 idOf · migrate · snapshot 추가 — 레거시 store 승격 준비"
```

---

## Task 2: Spring `/stores/sops`

`Sop` 의 `sections` 는 `SopSection[]` — 단계 2 의 `BrandProfile.policy` 와 같은 판별 유니온이다. 같은 처방(JSON 텍스트 컬럼 + `JsonNodeConverter`)을 쓴다.

**주의 — 이름 충돌:** TS `Sop.updatedAt` 은 도메인 값인데 `OwnerScoped.updatedAt` 은 서버 전용 정렬 키다. 자바 필드명을 `domainUpdatedAt` 으로 달리하고 `@JsonProperty("updatedAt")` 으로 와이어 이름만 맞춘다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/sop/Sop.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/sop/SopRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/sop/SopController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/sop/SopControllerTest.java`
- Test: `apps/api/src/integrationTest/java/ai/adflow/api/store/sop/SopPostgresIT.java`

**Interfaces:**
- Consumes: 단계 2 의 `OwnerScoped`·`OwnerScopedRepository`·`StoreController`·`JsonNodeConverter`
- Produces: `GET/POST/DELETE /stores/sops`, 항목이 TS `Sop`(`id`·`name`·`description?`·`sections`·`createdAt`·`updatedAt`)와 1:1

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/store/sop/SopControllerTest.java`:

```java
package ai.adflow.api.store.sop;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SopControllerTest {

  // TS Sop 와 1:1. sections 는 type 마다 data 형태가 다른 판별 유니온이다.
  private static final String ITEM =
      """
      {
        "id": "sop_1",
        "name": "광고 정책",
        "description": "여름 캠페인용",
        "sections": [
          {"type": "prohibited_words", "data": {"words": ["최저가", "1위"]}, "source": "user"},
          {"type": "length_limits", "data": {"headline": 40, "body": 125}},
          {"type": "cta_restrictions", "data": {"blacklist": ["지금 클릭"], "note": "과장 금지"}}
        ],
        "createdAt": "2026-07-01T00:00:00Z",
        "updatedAt": "2026-07-02T00:00:00Z"
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/sops")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/sops")).andExpect(status().isUnauthorized());
  }

  @Test
  void 판별유니온_sections_가_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/sops").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value("sop_1"))
        .andExpect(jsonPath("$.items[0].name").value("광고 정책"))
        .andExpect(jsonPath("$.items[0].sections").isArray())
        .andExpect(jsonPath("$.items[0].sections[0].type").value("prohibited_words"))
        .andExpect(jsonPath("$.items[0].sections[0].data.words[1]").value("1위"))
        .andExpect(jsonPath("$.items[0].sections[1].data.headline").value(40))
        .andExpect(jsonPath("$.items[0].sections[2].data.note").value("과장 금지"))
        // 두 번째 항목엔 source 가 없다. optional 이 임의로 채워지면 안 된다.
        .andExpect(jsonPath("$.items[0].sections[1].source").doesNotExist())
        // 서버 전용 필드는 새면 안 되고, updatedAt 은 도메인 값이어야 한다(서버 시각 아님).
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist())
        .andExpect(jsonPath("$.items[0].updatedAt").value("2026-07-02T00:00:00Z"));
  }

  @Test
  void description_이_없으면_키가_없다() throws Exception {
    save(
        "d@example.com",
        """
        {
          "id": "sop_nodesc",
          "name": "설명 없음",
          "sections": [],
          "createdAt": "2026-07-01T00:00:00Z",
          "updatedAt": "2026-07-01T00:00:00Z"
        }
        """);

    mockMvc
        .perform(get("/stores/sops").with(owner("d@example.com")))
        .andExpect(jsonPath("$.items[0].description").doesNotExist())
        // sections 는 required 다 — 빈 배열이 null 로 뭉개지면 화면이 .filter 에서 깨진다.
        .andExpect(jsonPath("$.items[0].sections").isArray())
        .andExpect(jsonPath("$.items[0].sections.length()").value(0));
  }

  @Test
  void 남의_SOP_는_보이지_않는다() throws Exception {
    save("b@example.com", ITEM.replace("sop_1", "sop_b"));
    mockMvc
        .perform(get("/stores/sops").with(owner("c@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `/stores/sops` 가 없어 401 또는 404.

- [ ] **Step 3: 엔티티를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/sop/Sop.java`:

```java
package ai.adflow.api.store.sop;

import ai.adflow.api.store.JsonNodeConverter;
import ai.adflow.api.store.OwnerScoped;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import tools.jackson.databind.JsonNode;

/** TS: apps/web/src/features/sop/model/useSopStorage.ts 의 Sop 과 필드 1:1. */
@Entity
@Table(name = "sops")
public class Sop extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Column(length = 2000)
  private String description;

  /**
   * SopSection[] — type 마다 data 형태가 다른 판별 유니온이라 관계형으로 펼치지 않는다.
   * BrandProfile.policy 와 같은 처방이다(단계 2 의 의도된 편차 #1).
   */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @ArraySchema(schema = @Schema(implementation = Object.class))
  @Convert(converter = JsonNodeConverter.class)
  @Column(name = "sections", columnDefinition = "text")
  private JsonNode sections;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "created_at")
  private String createdAt;

  /**
   * 도메인의 updatedAt. OwnerScoped.updatedAt(서버 전용 정렬 키)과 이름이 겹치므로
   * 자바 필드명을 달리하고 와이어 이름만 updatedAt 으로 맞춘다.
   */
  @Column(name = "domain_updated_at")
  private String domainUpdatedAt;

  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getDescription() { return description; }
  public void setDescription(String v) { this.description = v; }
  public JsonNode getSections() { return sections; }
  public void setSections(JsonNode v) { this.sections = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @JsonProperty("updatedAt")
  public String getDomainUpdatedAt() { return domainUpdatedAt; }

  @JsonProperty("updatedAt")
  public void setDomainUpdatedAt(String v) { this.domainUpdatedAt = v; }
}
```

- [ ] **Step 4: 리포지토리와 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/sop/SopRepository.java`:

```java
package ai.adflow.api.store.sop;

import ai.adflow.api.store.OwnerScopedRepository;

public interface SopRepository extends OwnerScopedRepository<Sop> {}
```

`apps/api/src/main/java/ai/adflow/api/store/sop/SopController.java`:

```java
package ai.adflow.api.store.sop;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/sops")
public class SopController extends StoreController<Sop> {

  public SopController(SopRepository repository) {
    super(repository);
  }
}
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 39건 + `SopControllerTest` 4건 = **43건**.

`updatedAt` 이 도메인 값이 아니라 ISO 서버 시각으로 나오면 `OwnerScoped.updatedAt` 의 `@JsonIgnore` 가 풀린 것이다.

- [ ] **Step 6: 실제 Postgres 에서 확인한다**

`apps/api/src/integrationTest/java/ai/adflow/api/store/sop/SopPostgresIT.java`:

```java
package ai.adflow.api.store.sop;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

class SopPostgresIT extends IntegrationTestBase {

  private static final String SECTIONS =
      "[{\"type\":\"prohibited_words\",\"data\":{\"words\":[\"최저가\"]},\"source\":\"user\"}]";

  @Autowired private SopRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void 도메인_updatedAt_이_서버_정렬키와_다른_컬럼이다() {
    List<String> columns =
        jdbc.queryForList(
            "select column_name from information_schema.columns where table_name = 'sops' order by 1",
            String.class);
    assertThat(columns).contains("updated_at", "domain_updated_at", "sections", "owner_key");
  }

  @Test
  void 판별유니온_sections_가_텍스트로_왕복한다() {
    Sop s = new Sop();
    s.setId("sop_pg");
    s.setOwnerKey("pg@example.com");
    s.setUpdatedAt(Instant.now());
    s.setName("정책");
    s.setCreatedAt("2026-07-01T00:00:00Z");
    s.setDomainUpdatedAt("2026-07-02T00:00:00Z");
    s.setSections(JsonMapper.builder().build().readTree(SECTIONS));
    repository.saveAndFlush(s);

    Sop found = repository.findById("sop_pg").orElseThrow();
    assertThat(found.getSections().isArray()).isTrue();
    assertThat(found.getSections().get(0).get("data").get("words").get(0).asText()).isEqualTo("최저가");
    assertThat(found.getDomainUpdatedAt()).isEqualTo("2026-07-02T00:00:00Z");
  }
}
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
```

기대: PASS, 13건 (기존 11 + 신규 2).

- [ ] **Step 7: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/sops — sections 는 판별 유니온이라 JSON 컬럼으로 존치"
```

---

## Task 3: Spring `/stores/personas`

가장 단순하다 — 계약 예외가 하나도 없다. 스칼라 + 원시 배열 3개.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/persona/Persona.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/persona/PersonaRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/persona/PersonaController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/persona/PersonaControllerTest.java`

**Interfaces:**
- Consumes: 단계 2 의 `OwnerScoped`·`StoreController`
- Produces: `GET/POST/DELETE /stores/personas`, 항목이 TS `PersonaEntry` 와 1:1

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/store/persona/PersonaControllerTest.java`:

```java
package ai.adflow.api.store.persona;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PersonaControllerTest {

  // TS PersonaEntry 와 1:1. 원시 배열 셋(genders·location·interests)이 요점이다.
  private static final String ITEM =
      """
      {
        "id": "p_1",
        "brandProfileId": "bp_1",
        "name": "30대 직장인",
        "ageMin": 30,
        "ageMax": 39,
        "genders": [2],
        "location": ["서울", "경기"],
        "interests": ["헬스", "홈카페"],
        "customerDescription": "아침에 바쁜 사람"
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/personas")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/personas")).andExpect(status().isUnauthorized());
  }

  @Test
  void 원시_배열_셋이_순서까지_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/personas").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].brandProfileId").value("bp_1"))
        .andExpect(jsonPath("$.items[0].ageMin").value(30))
        .andExpect(jsonPath("$.items[0].genders[0]").value(2))
        .andExpect(jsonPath("$.items[0].location[0]").value("서울"))
        .andExpect(jsonPath("$.items[0].location[1]").value("경기"))
        .andExpect(jsonPath("$.items[0].interests[1]").value("홈카페"))
        .andExpect(jsonPath("$.items[0].customerDescription").value("아침에 바쁜 사람"))
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void 미설정_optional_은_키가_없다() throws Exception {
    save(
        "m@example.com",
        """
        {"id": "p_min", "brandProfileId": "bp_1", "name": "최소"}
        """);

    // TS 에서 genders·location·interests 는 전부 optional 이다.
    // 빈 배열로 채워 보내면 "타겟팅 미지정"과 "빈 타겟팅"이 구분되지 않는다.
    mockMvc
        .perform(get("/stores/personas").with(owner("m@example.com")))
        .andExpect(jsonPath("$.items[0].name").value("최소"))
        .andExpect(jsonPath("$.items[0].ageMin").doesNotExist())
        .andExpect(jsonPath("$.items[0].genders").doesNotExist())
        .andExpect(jsonPath("$.items[0].location").doesNotExist())
        .andExpect(jsonPath("$.items[0].customerDescription").doesNotExist());
  }

  @Test
  void 재저장하면_배열이_교체된다() throws Exception {
    save("r@example.com", ITEM.replace("p_1", "p_r"));
    save("r@example.com", ITEM.replace("p_1", "p_r").replace("[\"서울\", \"경기\"]", "[\"부산\"]"));

    mockMvc
        .perform(get("/stores/personas").with(owner("r@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].location.length()").value(1))
        .andExpect(jsonPath("$.items[0].location[0]").value("부산"));
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `/stores/personas` 없음.

- [ ] **Step 3: 엔티티를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/persona/Persona.java`:

```java
package ai.adflow.api.store.persona;

import ai.adflow.api.store.OwnerScoped;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;

/**
 * TS: apps/web/src/features/brand-profile/model/usePersonasStorage.ts 의 PersonaEntry.
 *
 * 배열 셋은 전부 optional 이라 null 을 빈 리스트로 바꾸지 않는다 — "타겟팅 미지정"과
 * "빈 타겟팅"이 화면에서 다르게 읽힌다.
 */
@Entity
@Table(name = "personas")
public class Persona extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "brand_profile_id")
  private String brandProfileId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Column(name = "age_min")
  private Integer ageMin;

  @Column(name = "age_max")
  private Integer ageMax;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "persona_genders", joinColumns = @JoinColumn(name = "persona_id"))
  @Column(name = "gender")
  @OrderColumn(name = "position")
  private List<Integer> genders;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "persona_locations", joinColumns = @JoinColumn(name = "persona_id"))
  @Column(name = "location")
  @OrderColumn(name = "position")
  private List<String> location;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "persona_interests", joinColumns = @JoinColumn(name = "persona_id"))
  @Column(name = "interest")
  @OrderColumn(name = "position")
  private List<String> interests;

  @Column(name = "customer_description", length = 2000)
  private String customerDescription;

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public Integer getAgeMin() { return ageMin; }
  public void setAgeMin(Integer v) { this.ageMin = v; }
  public Integer getAgeMax() { return ageMax; }
  public void setAgeMax(Integer v) { this.ageMax = v; }
  public List<Integer> getGenders() { return genders; }
  public void setGenders(List<Integer> v) { this.genders = v; }
  public List<String> getLocation() { return location; }
  public void setLocation(List<String> v) { this.location = v; }
  public List<String> getInterests() { return interests; }
  public void setInterests(List<String> v) { this.interests = v; }
  public String getCustomerDescription() { return customerDescription; }
  public void setCustomerDescription(String v) { this.customerDescription = v; }
}
```

- [ ] **Step 4: 리포지토리와 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/persona/PersonaRepository.java`:

```java
package ai.adflow.api.store.persona;

import ai.adflow.api.store.OwnerScopedRepository;

public interface PersonaRepository extends OwnerScopedRepository<Persona> {}
```

`apps/api/src/main/java/ai/adflow/api/store/persona/PersonaController.java`:

```java
package ai.adflow.api.store.persona;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/personas")
public class PersonaController extends StoreController<Persona> {

  public PersonaController(PersonaRepository repository) {
    super(repository);
  }
}
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 43건 + `PersonaControllerTest` 4건 = **47건**.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/personas — 타겟팅 배열 3종 컬렉션 테이블 분리"
```

---

## Task 4: Spring `/stores/auto-relaunch` — `campaignId` 를 PK 로

여기서 처음으로 **와이어 키가 `id` 가 아닌** 엔티티가 나온다. `AutoRelaunchEntry` 의 식별자는 `campaignId` 다.

탐침으로 확인한 처방: `@JsonIgnoreProperties("id")` 로 부모의 `id` 를 감추고, `@JsonProperty("campaignId")` 접근자 쌍으로 같은 값을 다른 이름으로 노출한다. **저장은 `OwnerScoped.id` 를 그대로 쓴다** — 값을 두 번 들고 있지 않아 어긋날 여지가 없다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/relaunch/AutoRelaunchState.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/relaunch/AutoRelaunchStateRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/relaunch/AutoRelaunchController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/relaunch/AutoRelaunchControllerTest.java`

**Interfaces:**
- Consumes: 단계 2 의 `OwnerScoped`·`StoreController`
- Produces:
  - `GET/POST/DELETE /stores/auto-relaunch`
  - 항목이 TS `AutoRelaunchEntry`(`campaignId`·`enabled`·`cycleCount`·`parentCampaignId?`·`createdAt`·`updatedAt`)와 1:1
  - `DELETE ?id=<campaignId>` — 프론트의 `removeById` 가 `idOf` 로 뽑은 `campaignId` 를 그대로 보낸다

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/store/relaunch/AutoRelaunchControllerTest.java`:

```java
package ai.adflow.api.store.relaunch;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AutoRelaunchControllerTest {

  // TS AutoRelaunchEntry 와 1:1. 식별자가 id 가 아니라 campaignId 인 것이 요점이다.
  private static final String ITEM =
      """
      {
        "campaignId": "camp_1",
        "enabled": true,
        "cycleCount": 3,
        "parentCampaignId": "camp_0",
        "createdAt": "2026-07-01T00:00:00Z",
        "updatedAt": "2026-07-02T00:00:00Z"
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/auto-relaunch")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/auto-relaunch")).andExpect(status().isUnauthorized());
  }

  @Test
  void 와이어는_campaignId_이고_id_는_노출되지_않는다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/auto-relaunch").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].campaignId").value("camp_1"))
        .andExpect(jsonPath("$.items[0].enabled").value(true))
        .andExpect(jsonPath("$.items[0].cycleCount").value(3))
        .andExpect(jsonPath("$.items[0].parentCampaignId").value("camp_0"))
        .andExpect(jsonPath("$.items[0].updatedAt").value("2026-07-02T00:00:00Z"))
        // TS AutoRelaunchEntry 에 id 가 없다. 새어 나가면 계약 위반이다.
        .andExpect(jsonPath("$.items[0].id").doesNotExist())
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void parentCampaignId_가_없으면_키가_없다() throws Exception {
    save(
        "n@example.com",
        """
        {
          "campaignId": "camp_root",
          "enabled": false,
          "cycleCount": 1,
          "createdAt": "2026-07-01T00:00:00Z",
          "updatedAt": "2026-07-01T00:00:00Z"
        }
        """);

    mockMvc
        .perform(get("/stores/auto-relaunch").with(owner("n@example.com")))
        .andExpect(jsonPath("$.items[0].enabled").value(false))
        .andExpect(jsonPath("$.items[0].parentCampaignId").doesNotExist());
  }

  @Test
  void campaignId_로_삭제된다() throws Exception {
    save("d@example.com", ITEM.replace("camp_1", "camp_d"));

    mockMvc
        .perform(delete("/stores/auto-relaunch").param("id", "camp_d").with(owner("d@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/auto-relaunch").with(owner("d@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void campaignId_없이_저장하면_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/auto-relaunch")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"enabled\":true,\"cycleCount\":1}}"))
        .andExpect(status().isBadRequest());
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `/stores/auto-relaunch` 없음.

- [ ] **Step 3: 엔티티를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/relaunch/AutoRelaunchState.java`:

```java
package ai.adflow.api.store.relaunch;

import ai.adflow.api.store.OwnerScoped;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TS: apps/web/src/shared/lib/autoRelaunch.ts 의 AutoRelaunchEntry.
 *
 * 식별자의 와이어 이름이 campaignId 다. 저장은 OwnerScoped.id 를 그대로 쓰고
 * @JsonIgnoreProperties("id") 로 부모 필드를 감춘 뒤 접근자 쌍으로 다른 이름을 붙인다.
 * 값을 두 번 들고 있지 않으므로 어긋날 여지가 없다.
 */
@Entity
@Table(name = "auto_relaunch_states")
@JsonIgnoreProperties("id")
public class AutoRelaunchState extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private Boolean enabled;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "cycle_count")
  private Integer cycleCount;

  @Column(name = "parent_campaign_id")
  private String parentCampaignId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "created_at")
  private String createdAt;

  @Column(name = "domain_updated_at")
  private String domainUpdatedAt;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @JsonProperty("campaignId")
  public String getCampaignId() { return getId(); }

  @JsonProperty("campaignId")
  public void setCampaignId(String v) { setId(v); }

  public Boolean getEnabled() { return enabled; }
  public void setEnabled(Boolean v) { this.enabled = v; }
  public Integer getCycleCount() { return cycleCount; }
  public void setCycleCount(Integer v) { this.cycleCount = v; }
  public String getParentCampaignId() { return parentCampaignId; }
  public void setParentCampaignId(String v) { this.parentCampaignId = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @JsonProperty("updatedAt")
  public String getDomainUpdatedAt() { return domainUpdatedAt; }

  @JsonProperty("updatedAt")
  public void setDomainUpdatedAt(String v) { this.domainUpdatedAt = v; }
}
```

- [ ] **Step 4: 리포지토리와 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/relaunch/AutoRelaunchStateRepository.java`:

```java
package ai.adflow.api.store.relaunch;

import ai.adflow.api.store.OwnerScopedRepository;

public interface AutoRelaunchStateRepository extends OwnerScopedRepository<AutoRelaunchState> {}
```

`apps/api/src/main/java/ai/adflow/api/store/relaunch/AutoRelaunchController.java`:

```java
package ai.adflow.api.store.relaunch;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/auto-relaunch")
public class AutoRelaunchController extends StoreController<AutoRelaunchState> {

  public AutoRelaunchController(AutoRelaunchStateRepository repository) {
    super(repository);
  }
}
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 47건 + `AutoRelaunchControllerTest` 5건 = **52건**.

`campaignId_없이_저장하면_400` 이 500 으로 나오면 `StoreController.upsert` 의 id 검사보다 먼저 다른 곳이 터진 것이다. 스택을 확인하라.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/auto-relaunch — campaignId 를 PK 로 쓰는 첫 엔티티"
```

---

## Task 5: Spring `/stores/campaign-launches`

게재 영수증이다. 서버가 내용을 해석하지 않는다. 스칼라는 컬럼으로 펼치고 **표현할 수 없는 셋은 그대로 둔다** (위 §계약이 지켜주지 못하는 필드).

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/launch/LaunchStatus.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/launch/AbTestAxis.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/launch/CampaignLaunch.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/launch/CampaignLaunchRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/launch/CampaignLaunchController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/launch/CampaignLaunchControllerTest.java`
- Test: `apps/api/src/integrationTest/java/ai/adflow/api/store/launch/CampaignLaunchPostgresIT.java`

**Interfaces:**
- Consumes: 단계 2 의 `OwnerScoped`·`StoreController`·`JsonNodeConverter`, Task 4 의 `campaignId` alias 패턴
- Produces:
  - `enum LaunchStatus { ACTIVE, PAUSED }` · `enum AbTestAxis { headline, primary_text, image }`
  - `GET/POST/DELETE /stores/campaign-launches`, 항목이 TS `LaunchedCampaign` 과 1:1

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/store/launch/CampaignLaunchControllerTest.java`:

```java
package ai.adflow.api.store.launch;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CampaignLaunchControllerTest {

  // TS LaunchedCampaign 과 1:1. adIds 튜플과 abTestVariantB 판별 유니온이 요점이다.
  private static final String ITEM =
      """
      {
        "campaignId": "camp_1",
        "adSetId": "adset_1",
        "adIds": ["ad_a", "ad_b"],
        "dailyBudget": 30000,
        "startDate": "2026-07-01",
        "endDate": "2026-07-31",
        "status": "ACTIVE",
        "objective": "OUTCOME_SALES",
        "goalId": "sales",
        "abTestAxis": "headline",
        "abTestVariantA": "아침을 바꾸는 한 잔",
        "abTestVariantB": {"axis": "headline", "headline": "하루를 여는 한 잔"}
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/campaign-launches")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/campaign-launches")).andExpect(status().isUnauthorized());
  }

  @Test
  void 튜플과_판별유니온이_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/campaign-launches").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].campaignId").value("camp_1"))
        .andExpect(jsonPath("$.items[0].adSetId").value("adset_1"))
        // TS 는 [string, string] 튜플이다 — 길이 2 가 보존돼야 한다.
        .andExpect(jsonPath("$.items[0].adIds.length()").value(2))
        .andExpect(jsonPath("$.items[0].adIds[0]").value("ad_a"))
        .andExpect(jsonPath("$.items[0].adIds[1]").value("ad_b"))
        .andExpect(jsonPath("$.items[0].dailyBudget").value(30000))
        .andExpect(jsonPath("$.items[0].status").value("ACTIVE"))
        .andExpect(jsonPath("$.items[0].objective").value("OUTCOME_SALES"))
        .andExpect(jsonPath("$.items[0].goalId").value("sales"))
        .andExpect(jsonPath("$.items[0].abTestAxis").value("headline"))
        .andExpect(jsonPath("$.items[0].abTestVariantB.axis").value("headline"))
        .andExpect(jsonPath("$.items[0].abTestVariantB.headline").value("하루를 여는 한 잔"))
        .andExpect(jsonPath("$.items[0].id").doesNotExist())
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void 단일광고_게재는_adIds_없이_adId_만_있다() throws Exception {
    save(
        "s@example.com",
        """
        {
          "campaignId": "camp_single",
          "adSetId": "adset_2",
          "adId": "ad_only",
          "dailyBudget": 10000,
          "startDate": "2026-07-01",
          "endDate": "2026-07-07",
          "status": "PAUSED"
        }
        """);

    mockMvc
        .perform(get("/stores/campaign-launches").with(owner("s@example.com")))
        .andExpect(jsonPath("$.items[0].adId").value("ad_only"))
        .andExpect(jsonPath("$.items[0].status").value("PAUSED"))
        .andExpect(jsonPath("$.items[0].adIds").doesNotExist())
        .andExpect(jsonPath("$.items[0].abTestVariantB").doesNotExist())
        .andExpect(jsonPath("$.items[0].skipped").doesNotExist());
  }

  @Test
  void 알_수_없는_status_는_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/campaign-launches")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"item\":{\"campaignId\":\"c\",\"adSetId\":\"a\",\"dailyBudget\":1,"
                        + "\"startDate\":\"2026-07-01\",\"endDate\":\"2026-07-02\",\"status\":\"UNKNOWN\"}}"))
        .andExpect(status().isBadRequest());
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `/stores/campaign-launches` 없음.

- [ ] **Step 3: enum 둘을 만든다**

`apps/api/src/main/java/ai/adflow/api/store/launch/LaunchStatus.java`:

```java
package ai.adflow.api.store.launch;

/** TS: LaunchedCampaign["status"] = "ACTIVE" | "PAUSED". Meta 값이라 대문자다. */
public enum LaunchStatus {
  ACTIVE,
  PAUSED
}
```

`apps/api/src/main/java/ai/adflow/api/store/launch/AbTestAxis.java`:

```java
package ai.adflow.api.store.launch;

/** TS: AbTestAxis = "headline" | "primary_text" | "image". 상수명이 곧 와이어 값이다. */
public enum AbTestAxis {
  headline,
  primary_text,
  image
}
```

- [ ] **Step 4: 엔티티를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/launch/CampaignLaunch.java`:

```java
package ai.adflow.api.store.launch;

import ai.adflow.api.store.JsonNodeConverter;
import ai.adflow.api.store.OwnerScoped;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * TS: apps/web/src/entities/campaign/model.tsx 의 LaunchedCampaign. 게재 영수증이다.
 *
 * 서버는 이 값을 해석하지 않는다. 셋은 OpenAPI 로 표현할 수 없어 계약이 지켜주지 못한다 —
 * adIds(TS 튜플)·abTestVariantB(판별 유니온)·goalId(const 배열 파생 유니온).
 * contract-compat.ts 에 예외로 적어뒀다.
 */
@Entity
@Table(name = "campaign_launches")
@JsonIgnoreProperties("id")
public class CampaignLaunch extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "ad_set_id")
  private String adSetId;

  @Column(name = "ad_id")
  private String adId;

  /** TS 는 [string, string] 튜플이다. springdoc 이 prefixItems 를 내지 않아 string[] 로 나간다. */
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "campaign_launch_ad_ids", joinColumns = @JoinColumn(name = "campaign_id"))
  @Column(name = "ad_id_value")
  @OrderColumn(name = "position")
  private List<String> adIds;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "daily_budget")
  private Double dailyBudget;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "start_date")
  private String startDate;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "end_date")
  private String endDate;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Enumerated(EnumType.STRING)
  private LaunchStatus status;

  /** Meta objective. 값이 늘어나는 축이라 자바 enum 대신 String + 스키마 허용값으로 둔다. */
  @Schema(
      allowableValues = {
        "OUTCOME_TRAFFIC",
        "OUTCOME_AWARENESS",
        "OUTCOME_ENGAGEMENT",
        "OUTCOME_LEADS",
        "OUTCOME_SALES",
        "OUTCOME_APP_PROMOTION"
      })
  private String objective;

  /** ObjectivePhase1Id — const 배열에서 파생된 유니온이라 Java 로 옮기면 목록이 두 곳에 산다. */
  @Column(name = "goal_id")
  private String goalId;

  private Boolean skipped;

  @Enumerated(EnumType.STRING)
  @Column(name = "ab_test_axis")
  private AbTestAxis abTestAxis;

  @Column(name = "ab_test_variant_a", length = 2000)
  private String abTestVariantA;

  /** 판별 유니온 — Sop.sections·BrandProfile.policy 와 같은 처방. */
  @Convert(converter = JsonNodeConverter.class)
  @Column(name = "ab_test_variant_b", columnDefinition = "text")
  private JsonNode abTestVariantB;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @JsonProperty("campaignId")
  public String getCampaignId() { return getId(); }

  @JsonProperty("campaignId")
  public void setCampaignId(String v) { setId(v); }

  public String getAdSetId() { return adSetId; }
  public void setAdSetId(String v) { this.adSetId = v; }
  public String getAdId() { return adId; }
  public void setAdId(String v) { this.adId = v; }
  public List<String> getAdIds() { return adIds; }
  public void setAdIds(List<String> v) { this.adIds = v; }
  public Double getDailyBudget() { return dailyBudget; }
  public void setDailyBudget(Double v) { this.dailyBudget = v; }
  public String getStartDate() { return startDate; }
  public void setStartDate(String v) { this.startDate = v; }
  public String getEndDate() { return endDate; }
  public void setEndDate(String v) { this.endDate = v; }
  public LaunchStatus getStatus() { return status; }
  public void setStatus(LaunchStatus v) { this.status = v; }
  public String getObjective() { return objective; }
  public void setObjective(String v) { this.objective = v; }
  public String getGoalId() { return goalId; }
  public void setGoalId(String v) { this.goalId = v; }
  public Boolean getSkipped() { return skipped; }
  public void setSkipped(Boolean v) { this.skipped = v; }
  public AbTestAxis getAbTestAxis() { return abTestAxis; }
  public void setAbTestAxis(AbTestAxis v) { this.abTestAxis = v; }
  public String getAbTestVariantA() { return abTestVariantA; }
  public void setAbTestVariantA(String v) { this.abTestVariantA = v; }
  public JsonNode getAbTestVariantB() { return abTestVariantB; }
  public void setAbTestVariantB(JsonNode v) { this.abTestVariantB = v; }
}
```

- [ ] **Step 5: 리포지토리와 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/launch/CampaignLaunchRepository.java`:

```java
package ai.adflow.api.store.launch;

import ai.adflow.api.store.OwnerScopedRepository;

public interface CampaignLaunchRepository extends OwnerScopedRepository<CampaignLaunch> {}
```

`apps/api/src/main/java/ai/adflow/api/store/launch/CampaignLaunchController.java`:

```java
package ai.adflow.api.store.launch;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/campaign-launches")
public class CampaignLaunchController extends StoreController<CampaignLaunch> {

  public CampaignLaunchController(CampaignLaunchRepository repository) {
    super(repository);
  }
}
```

- [ ] **Step 6: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 52건 + `CampaignLaunchControllerTest` 4건 = **56건**.

- [ ] **Step 7: 실제 Postgres 에서 확인한다**

`apps/api/src/integrationTest/java/ai/adflow/api/store/launch/CampaignLaunchPostgresIT.java`:

```java
package ai.adflow.api.store.launch;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

class CampaignLaunchPostgresIT extends IntegrationTestBase {

  @Autowired private CampaignLaunchRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void adIds_가_별도_테이블로_펼쳐진다() {
    List<String> tables =
        jdbc.queryForList(
            "select table_name from information_schema.tables where table_schema='public' order by 1",
            String.class);
    assertThat(tables).contains("campaign_launches", "campaign_launch_ad_ids");
  }

  @Test
  void 튜플_순서와_판별유니온이_왕복한다() {
    CampaignLaunch c = new CampaignLaunch();
    c.setCampaignId("camp_pg");
    c.setOwnerKey("pg@example.com");
    c.setUpdatedAt(Instant.now());
    c.setAdSetId("adset_pg");
    c.setAdIds(new ArrayList<>(List.of("ad_a", "ad_b")));
    c.setDailyBudget(30000.0);
    c.setStartDate("2026-07-01");
    c.setEndDate("2026-07-31");
    c.setStatus(LaunchStatus.ACTIVE);
    c.setAbTestAxis(AbTestAxis.headline);
    c.setAbTestVariantB(
        JsonMapper.builder().build().readTree("{\"axis\":\"headline\",\"headline\":\"하루를 여는 한 잔\"}"));
    repository.saveAndFlush(c);

    CampaignLaunch found = repository.findById("camp_pg").orElseThrow();
    assertThat(found.getAdIds()).containsExactly("ad_a", "ad_b");
    assertThat(found.getAbTestVariantB().get("headline").asText()).isEqualTo("하루를 여는 한 잔");
    assertThat(found.getStatus()).isEqualTo(LaunchStatus.ACTIVE);
  }
}
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
```

기대: PASS, 15건 (기존 13 + 신규 2).

- [ ] **Step 8: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/campaign-launches — 게재 영수증 · 튜플·판별 유니온은 계약 예외로 기록"
```

---

## Task 6: 프론트 라우트 4개 + `sops` 승격

Next 라우트 4개는 단계 2 의 `createStoreRoute` 로 4줄씩이면 끝난다. 이 Task 는 그것과 함께 `useSopStorage` 를 Tier 1 으로 올린다.

**훅 표면을 그대로 유지한다** — `{ sops, createSop, updateSop, setSection, clearSection, deleteSop, getSop }`. 그러면 `/sop` 화면들을 건드리지 않는다.

**Files:**
- Create: `apps/web/app/api/stores/sops/route.ts`
- Create: `apps/web/app/api/stores/personas/route.ts`
- Create: `apps/web/app/api/stores/auto-relaunch/route.ts`
- Create: `apps/web/app/api/stores/campaign-launches/route.ts`
- Modify: `apps/web/src/features/sop/model/useSopStorage.ts`
- Test: `apps/web/src/features/sop/model/useSopStorage.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `createSyncedStore(idOf·migrate·snapshot)`, Task 2~5 의 엔드포인트, 단계 2 의 `createStoreRoute`
- Produces:
  - `export const sops = createSyncedStore<Sop>({...})` — 다른 모듈이 스냅샷을 읽을 수 있게 export
  - `useSopStorage()` 반환 형태 불변
  - 레거시 키 흡수: `adflow:sop-index` + `adflow:sop:{id}` → persist 봉투 `adflow:sops:v1`

- [ ] **Step 1: 라우트 4개를 만든다**

`apps/web/app/api/stores/sops/route.ts`:

```ts
// ADR-046 Synced Store API(sops) — 단계 3 에서 레거시 미러를 Tier 1 으로 승격하며 신설.
// 계약(GET → {items}, POST {item}, DELETE ?id=)은 다른 store 와 동일하다.

import { createStoreRoute } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handlers = createStoreRoute("/stores/sops");

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
```

나머지 셋은 첫 줄 주석의 테이블명과 경로만 다르다.

| 파일 | 주석 테이블명 | 경로 |
|---|---|---|
| `app/api/stores/personas/route.ts` | `personas` | `"/stores/personas"` |
| `app/api/stores/auto-relaunch/route.ts` | `auto_relaunch_states` | `"/stores/auto-relaunch"` |
| `app/api/stores/campaign-launches/route.ts` | `campaign_launches` | `"/stores/campaign-launches"` |

- [ ] **Step 2: 실패하는 테스트를 먼저 쓴다**

이 파일에는 테스트가 없었다. 승격의 핵심(레거시 흡수 · 게스트 단락 · 훅 표면 유지)을 처음으로 못 박는다.

`apps/web/src/features/sop/model/useSopStorage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// node 환경에 localStorage 없으므로 Map 기반 스텁 주입(usePersonasStorage.test.ts 패턴).
const ls = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => { ls.set(k, v); },
  removeItem: (k: string) => { ls.delete(k); },
  clear: () => { ls.clear(); },
  get length() { return ls.size; },
  key: (i: number) => [...ls.keys()][i] ?? null,
});

import { absorbLegacySops, sops } from "./useSopStorage";

const fetchMock = vi.fn();

beforeEach(() => {
  ls.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  sops.useStore.getState().setAll([]);
});

function legacySop(id: string, name: string) {
  return {
    id,
    name,
    sections: [{ type: "prohibited_words", data: { words: ["최저가"] } }],
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

describe("absorbLegacySops", () => {
  it("인덱스와 개별 키에서 SOP 을 건져 올려요", () => {
    ls.set("adflow:sop:version", "2");
    ls.set("adflow:sop-index", JSON.stringify(["s1", "s2"]));
    ls.set("adflow:sop:s1", JSON.stringify(legacySop("s1", "정책1")));
    ls.set("adflow:sop:s2", JSON.stringify(legacySop("s2", "정책2")));

    const absorbed = absorbLegacySops();

    expect(absorbed.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(absorbed[0].name).toBe("정책1");
    // 흡수 후 레거시 키는 지워져야 한다 — 남으면 다음 로그인에서 다시 올라온다.
    expect(ls.has("adflow:sop-index")).toBe(false);
    expect(ls.has("adflow:sop:s1")).toBe(false);
  });

  it("인덱스에 있지만 본문이 없는 id 는 건너뛰어요", () => {
    ls.set("adflow:sop:version", "2");
    ls.set("adflow:sop-index", JSON.stringify(["s1", "ghost"]));
    ls.set("adflow:sop:s1", JSON.stringify(legacySop("s1", "정책1")));

    expect(absorbLegacySops().map((s) => s.id)).toEqual(["s1"]);
  });

  it("레거시 데이터가 없으면 빈 배열이에요", () => {
    expect(absorbLegacySops()).toEqual([]);
  });

  it("버전이 낮으면 폐기하고 아무것도 흡수하지 않아요", () => {
    // ADR-020 의 v0.6 리셋. 옛 모양(content: string)이 서버로 올라가면 안 된다.
    ls.set("adflow:sop:version", "1");
    ls.set("adflow:sop-index", JSON.stringify(["old"]));
    ls.set("adflow:sop:old", JSON.stringify({ id: "old", content: "옛 모양" }));

    expect(absorbLegacySops()).toEqual([]);
    expect(ls.has("adflow:sop:old")).toBe(false);
    expect(ls.get("adflow:sop:version")).toBe("2");
  });
});

describe("sops store", () => {
  it("게스트는 서버를 호출하지 않아요", async () => {
    await sops.useStore.getState().hydrate("guest@adflow.local");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("실유저는 서버에서 하이드레이션해요", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [legacySop("s9", "서버")] }),
    });
    await sops.useStore.getState().hydrate("real@x.com");
    expect(fetchMock).toHaveBeenCalledWith("/api/stores/sops", {
      headers: { accept: "application/json" },
    });
    expect(sops.useStore.getState().items[0].name).toBe("서버");
  });
});
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/features/sop/model/useSopStorage.test.ts
```

기대: FAIL — `absorbLegacySops`·`sops` 가 export 되지 않아 import 에러.

- [ ] **Step 4: `useSopStorage` 를 승격한다**

`apps/web/src/features/sop/model/useSopStorage.ts` 에서 아래를 바꾼다. **타입 선언부(`SopItemType`~`Sop`)와 `isSectionFilled`·`sectionSummary` 같은 순수 함수는 건드리지 않는다.**

import 를 바꾼다.

```ts
import { useCallback } from "react";
import { createSyncedStore } from "@shared/lib/store";
```

`INDEX_KEY`·`itemKey`·`readIndex`·`writeIndex`·`readSop`·`writeSop`·`deleteSopFromStorage` 를 **삭제**하고 아래로 바꾼다.

```ts
const LEGACY_INDEX_KEY = "adflow:sop-index";
const legacyItemKey = (id: string) => `adflow:sop:${id}`;
const VERSION_KEY = "adflow:sop:version";
const CURRENT_VERSION = "2";

const SOPS_KEY = "adflow:sops:v1"; // zustand persist 봉투

/**
 * 레거시 localStorage(인덱스 + 개별 키)에서 SOP 을 건져 올린 뒤 옛 키를 지운다.
 *
 * ADR-020 의 버전 리셋을 먼저 돌린다 — 옛 모양(content: string)이 서버로 올라가면
 * 되돌릴 방법이 없다. 버전이 낮으면 전부 폐기하고 빈 배열을 준다.
 */
export function absorbLegacySops(): Sop[] {
  if (typeof window === "undefined") return [];

  let ids: string[] = [];
  try {
    ids = JSON.parse(localStorage.getItem(LEGACY_INDEX_KEY) ?? "[]") as string[];
  } catch {
    ids = [];
  }

  const stale = localStorage.getItem(VERSION_KEY) !== CURRENT_VERSION;

  const absorbed: Sop[] = [];
  for (const id of ids) {
    if (!stale) {
      try {
        const raw = localStorage.getItem(legacyItemKey(id));
        if (raw) absorbed.push(JSON.parse(raw) as Sop);
      } catch {}
    }
    try {
      localStorage.removeItem(legacyItemKey(id));
    } catch {}
  }

  try {
    localStorage.removeItem(LEGACY_INDEX_KEY);
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  } catch {}

  return absorbed;
}

export const sops = createSyncedStore<Sop>({
  name: SOPS_KEY,
  endpoint: "/api/stores/sops",
  migrate: absorbLegacySops,
});

const { useStore } = sops;
```

훅 본문을 바꾼다. **반환 형태는 그대로다.**

```ts
export function useSopStorage() {
  sops.useSync();
  const list = useStore((s) => s.items);
  const upsert = useStore((s) => s.upsert);
  const removeById = useStore((s) => s.removeById);

  const createSop = useCallback(
    (data: Omit<Sop, "id" | "createdAt" | "updatedAt">): Sop => {
      const now = new Date().toISOString();
      const sop: Sop = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...data };
      useStore.getState().add(sop);
      return sop;
    },
    [],
  );

  // 편집 계열은 전부 "현재 항목을 읽어 → 바꾼 뒤 → upsert" 로 같다.
  const patchSop = useCallback(
    (id: string, change: (existing: Sop) => Sop | null): void => {
      const existing = useStore.getState().items.find((s) => s.id === id);
      if (!existing) return;
      const next = change(existing);
      if (next) upsert({ ...next, updatedAt: new Date().toISOString() });
    },
    [upsert],
  );

  const updateSop = useCallback(
    (id: string, patch: Partial<Omit<Sop, "id" | "createdAt">>): void => {
      patchSop(id, (existing) => ({ ...existing, ...patch }));
    },
    [patchSop],
  );

  /** 단일 section upsert. data 가 비어있으면 자동으로 sections 에서 제거. */
  const setSection = useCallback(
    (id: string, section: SopSection): void => {
      patchSop(id, (existing) => {
        const others = existing.sections.filter((s) => s.type !== section.type);
        return { ...existing, sections: isSectionFilled(section) ? [...others, section] : others };
      });
    },
    [patchSop],
  );

  const clearSection = useCallback(
    (id: string, type: SopItemType): void => {
      patchSop(id, (existing) => {
        const next = existing.sections.filter((s) => s.type !== type);
        return next.length === existing.sections.length ? null : { ...existing, sections: next };
      });
    },
    [patchSop],
  );

  const deleteSop = useCallback((id: string): void => removeById(id), [removeById]);

  const getSop = useCallback(
    (id: string): Sop | undefined => useStore.getState().items.find((s) => s.id === id),
    [],
  );

  return { sops: list, createSop, updateSop, setSection, clearSection, deleteSop, getSop };
}
```

`runVersionReset` 은 `absorbLegacySops` 가 흡수했으므로 **삭제한다.**

- [ ] **Step 5: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/features/sop/model/useSopStorage.test.ts
npx tsc --noEmit --project tsconfig.json
```

기대: PASS, 6건 · tsc 에러 0.

`/sop` 화면이 컴파일 에러를 내면 훅 표면이 바뀐 것이다. 반환 키 7개(`sops`·`createSop`·`updateSop`·`setSection`·`clearSection`·`deleteSop`·`getSop`)를 확인하라.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/web
git commit -m "feat(web): /stores 프록시 라우트 4개 · sops Tier 1 승격 — 레거시 키 흡수 포함"
```

---

## Task 7: `personas` 승격 + `brandProfileStore` 결합 제거

`readPersonas()` 는 **동기 리더**이고 6곳 이상에서 렌더 중 호출된다. 시그니처를 지켜야 한다 — Task 1 의 `snapshot()` 이 그 자리를 대신한다.

**함께 고칠 결합:** `brandProfileStore.removeProfile` 이 `adflow:personas` localStorage 를 직접 조작해 딸린 페르소나를 지운다. personas 가 store 로 옮겨가면 이 코드는 아무 일도 하지 않게 되므로(=프로필 삭제 시 페르소나가 남는 버그) 같이 고쳐야 한다.

**Files:**
- Modify: `apps/web/src/features/brand-profile/model/usePersonasStorage.ts`
- Modify: `apps/web/src/features/brand-profile/model/brandProfileStore.ts`
- Modify: `apps/web/src/features/brand-profile/model/usePersonasStorage.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `snapshot`, Task 6 의 `/api/stores/personas`
- Produces:
  - `export const personas = createSyncedStore<PersonaEntry>({...})`
  - `readPersonas(): PersonaEntry[]` — **동기 시그니처 유지**
  - `usePersonasStorage()` · `usePersonasForProfile(id)` 반환 형태 불변
  - `removePersonasForProfile(brandProfileId: string): void` — 프로필 삭제 시 호출

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/web/src/features/brand-profile/model/usePersonasStorage.test.ts` 의 맨 위 `vi.mock("@shared/lib/supabase-sync", …)` 블록을 **삭제**하고(모듈이 사라진다) 파일 끝에 아래를 붙인다.

```ts
describe("personas store 승격", () => {
  it("레거시 배열 키를 흡수하고 지워요", () => {
    localStorage.setItem(
      "adflow:personas",
      JSON.stringify([{ id: "p1", brandProfileId: "bp1", name: "레거시" }]),
    );

    const absorbed = absorbLegacyPersonas();

    expect(absorbed).toHaveLength(1);
    expect(absorbed[0].name).toBe("레거시");
    expect(localStorage.getItem("adflow:personas")).toBeNull();
  });

  it("레거시가 없으면 빈 배열이에요", () => {
    expect(absorbLegacyPersonas()).toEqual([]);
  });

  it("removePersonasForProfile 이 해당 프로필의 페르소나만 지워요", () => {
    personas.useStore.getState().setAll([
      { id: "p1", brandProfileId: "bp1", name: "A" },
      { id: "p2", brandProfileId: "bp2", name: "B" },
      { id: "p3", brandProfileId: "bp1", name: "C" },
    ]);

    removePersonasForProfile("bp1");

    expect(readPersonas().map((p) => p.id)).toEqual(["p2"]);
  });
});
```

파일 상단의 import 를 바꾼다.

```ts
import {
  absorbLegacyPersonas,
  personas,
  readPersonas,
  removePersonasForProfile,
} from "./usePersonasStorage";
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/features/brand-profile/model/usePersonasStorage.test.ts
```

기대: FAIL — `absorbLegacyPersonas`·`personas`·`removePersonasForProfile` 이 없어 import 에러.

- [ ] **Step 3: `usePersonasStorage` 를 승격한다**

`apps/web/src/features/brand-profile/model/usePersonasStorage.ts` 를 아래로 **교체**한다. `PersonaEntry` 선언은 그대로다.

```ts
"use client";

import { useCallback } from "react";
import { createSyncedStore } from "@shared/lib/store";

export interface PersonaEntry {
  id: string;
  brandProfileId: string;
  name: string;
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  location?: string[];
  interests?: string[];
  customerDescription?: string;
}

const LEGACY_KEY = "adflow:personas";
const PERSONAS_KEY = "adflow:personas:v2"; // zustand persist 봉투

/** 레거시 bare-array 키를 1회 흡수하고 지운다. 남기면 다음 로그인에서 다시 올라온다. */
export function absorbLegacyPersonas(): PersonaEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersonaEntry[];
    localStorage.removeItem(LEGACY_KEY);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const personas = createSyncedStore<PersonaEntry>({
  name: PERSONAS_KEY,
  endpoint: "/api/stores/personas",
  migrate: absorbLegacyPersonas,
});

const { useStore } = personas;

// 모듈 로드 시 워밍 — readPersonas 가 훅 밖 동기 리더라 items 가 채워져 있어야 한다.
if (typeof window !== "undefined") personas.rehydrate();

/** 동기 리더. 렌더 중 직접 호출되므로 시그니처를 바꾸지 않는다. */
export function readPersonas(): PersonaEntry[] {
  return personas.snapshot();
}

/** 프로필 삭제 시 딸린 페르소나 정리. 이전에는 brandProfileStore 가 localStorage 를 직접 만졌다. */
export function removePersonasForProfile(brandProfileId: string): void {
  for (const p of readPersonas().filter((p) => p.brandProfileId === brandProfileId)) {
    useStore.getState().removeById(p.id);
  }
}

export function usePersonasStorage() {
  personas.useSync();
  const list = useStore((s) => s.items);
  const upsert = useStore((s) => s.upsert);
  const removeById = useStore((s) => s.removeById);

  const savePersona = useCallback((entry: PersonaEntry): void => upsert(entry), [upsert]);
  const deletePersona = useCallback((id: string): void => removeById(id), [removeById]);

  return { personas: list, savePersona, deletePersona };
}

export function usePersonasForProfile(brandProfileId: string) {
  personas.useSync();
  // 전체 목록에서 걸러 낸다 — 이전 구현이 "필터된 뷰"와 "전체"를 각각 들고 있어
  // 두 상태가 어긋나던 문제를 store 하나로 없앤다.
  const list = useStore((s) => s.items.filter((p) => p.brandProfileId === brandProfileId));
  const upsert = useStore((s) => s.upsert);
  const removeById = useStore((s) => s.removeById);

  const savePersona = useCallback((entry: PersonaEntry): void => upsert(entry), [upsert]);
  const deletePersona = useCallback((id: string): void => removeById(id), [removeById]);

  return { personas: list, savePersona, deletePersona };
}
```

- [ ] **Step 4: `brandProfileStore` 의 직접 조작을 제거한다**

`apps/web/src/features/brand-profile/model/brandProfileStore.ts` 에서 `const PERSONAS_KEY = "adflow:personas";` 줄을 지우고, `removeProfile` 의 localStorage 조작 블록을 바꾼다.

지울 블록:

```ts
  try {
    const raw = localStorage.getItem(PERSONAS_KEY);
    if (raw) {
      const personas = JSON.parse(raw) as { brandProfileId: string }[];
      const next = personas.filter((p) => p.brandProfileId !== id);
      if (next.length !== personas.length) {
        localStorage.setItem(PERSONAS_KEY, JSON.stringify(next));
      }
    }
  } catch {}
```

넣을 코드:

```ts
  // personas 가 Tier 1 store 로 옮겨갔다(단계 3). localStorage 를 직접 만지면
  // store 와 서버가 모르는 채로 지워져 다음 하이드레이션에 되살아난다.
  removePersonasForProfile(id);
```

파일 상단 import 에 한 줄을 더한다.

```ts
import { removePersonasForProfile } from "./usePersonasStorage";
```

`brandProfileStore` ↔ `usePersonasStorage` 순환 import 가 생기지 않는지 확인한다 — `usePersonasStorage` 는 `brandProfileStore` 를 import 하지 않으므로 단방향이다.

- [ ] **Step 5: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/features/brand-profile/model/usePersonasStorage.test.ts
npx tsc --noEmit --project tsconfig.json
```

기대: PASS · tsc 에러 0.

기존 테스트가 `localStorage` 를 직접 세팅해 `readPersonas()` 를 검증하던 케이스들은 이제 store 를 거친다. 실패하면 테스트를 `personas.useStore.getState().setAll([...])` 로 고치되 **`readPersonas()` 의 시그니처는 그대로 둔다.**

- [ ] **Step 6: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/web
git commit -m "feat(web): personas Tier 1 승격 — brandProfileStore 의 localStorage 직접 조작 제거"
```

---

## Task 8: `auto_relaunch_states` · `campaign_launches` 승격

둘 다 **인덱스 키가 없다.** 기존 로컬 데이터를 건지려면 `localStorage` 키를 접두사로 스캔해야 한다. 그리고 둘 다 **동기 포인트 리더**를 갖고 있다.

**Files:**
- Modify: `apps/web/src/shared/lib/autoRelaunch.ts`
- Modify: `apps/web/src/entities/campaign/launched-storage.ts`
- Test: `apps/web/src/shared/lib/autoRelaunch.test.ts`
- Test: `apps/web/src/entities/campaign/launched-storage.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `idOf`·`migrate`·`snapshot`, Task 6 의 라우트
- Produces:
  - `export const autoRelaunchStates = createSyncedStore<AutoRelaunchEntry>({ idOf: (e) => e.campaignId, … })`
  - `export const campaignLaunches = createSyncedStore<LaunchedCampaign>({ idOf: (e) => e.campaignId, … })`
  - `useAutoRelaunch()` 반환 형태 불변 (`get`·`setEnabled`·`inheritFromParent`·`getCycleCount`)
  - `loadLaunchedCampaign(id): LaunchedCampaign | null` · `saveLaunchedCampaign(v): void` — **동기 시그니처 유지**
  - `scanLegacyKeys<T>(prefix: string): T[]` — 두 곳이 공유하는 접두사 스캔 (`shared/lib/store/legacyScan.ts`)

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/web/src/shared/lib/autoRelaunch.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const ls = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => { ls.set(k, v); },
  removeItem: (k: string) => { ls.delete(k); },
  clear: () => { ls.clear(); },
  get length() { return ls.size; },
  key: (i: number) => [...ls.keys()][i] ?? null,
});

import { absorbLegacyAutoRelaunch, autoRelaunchStates, readAutoRelaunch } from "./autoRelaunch";

const fetchMock = vi.fn();

beforeEach(() => {
  ls.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  autoRelaunchStates.useStore.getState().setAll([]);
});

describe("absorbLegacyAutoRelaunch", () => {
  it("인덱스 없이 접두사 스캔으로 건져 올려요", () => {
    ls.set("auto-relaunch:c1", JSON.stringify({ campaignId: "c1", enabled: true, cycleCount: 2, createdAt: "x", updatedAt: "y" }));
    ls.set("auto-relaunch:c2", JSON.stringify({ campaignId: "c2", enabled: false, cycleCount: 1, createdAt: "x", updatedAt: "y" }));
    ls.set("adflow:other", "건드리면 안 됨");

    const absorbed = absorbLegacyAutoRelaunch();

    expect(absorbed.map((e) => e.campaignId).sort()).toEqual(["c1", "c2"]);
    expect(ls.has("auto-relaunch:c1")).toBe(false);
    // 접두사가 다른 키는 그대로 있어야 한다.
    expect(ls.get("adflow:other")).toBe("건드리면 안 됨");
  });

  it("깨진 JSON 은 건너뛰고 키만 지워요", () => {
    ls.set("auto-relaunch:bad", "{not json");
    expect(absorbLegacyAutoRelaunch()).toEqual([]);
    expect(ls.has("auto-relaunch:bad")).toBe(false);
  });
});

describe("readAutoRelaunch", () => {
  it("campaignId 로 동기 조회돼요", () => {
    autoRelaunchStates.useStore.getState().setAll([
      { campaignId: "c1", enabled: true, cycleCount: 3, createdAt: "x", updatedAt: "y" },
    ]);
    expect(readAutoRelaunch("c1")?.cycleCount).toBe(3);
    expect(readAutoRelaunch("없음")).toBeNull();
  });

  it("같은 campaignId 를 두 번 저장하면 하나만 남아요", () => {
    const store = autoRelaunchStates.useStore.getState();
    store.upsert({ campaignId: "c1", enabled: true, cycleCount: 1, createdAt: "x", updatedAt: "y" });
    store.upsert({ campaignId: "c1", enabled: false, cycleCount: 2, createdAt: "x", updatedAt: "z" });
    expect(autoRelaunchStates.useStore.getState().items).toHaveLength(1);
    expect(readAutoRelaunch("c1")?.enabled).toBe(false);
  });
});
```

`apps/web/src/entities/campaign/launched-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const ls = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => { ls.set(k, v); },
  removeItem: (k: string) => { ls.delete(k); },
  clear: () => { ls.clear(); },
  get length() { return ls.size; },
  key: (i: number) => [...ls.keys()][i] ?? null,
});

import {
  absorbLegacyLaunches,
  campaignLaunches,
  loadLaunchedCampaign,
  saveLaunchedCampaign,
} from "./launched-storage";

const fetchMock = vi.fn();

function launched(campaignId: string) {
  return {
    campaignId,
    adSetId: "adset_1",
    dailyBudget: 10000,
    startDate: "2026-07-01",
    endDate: "2026-07-07",
    status: "ACTIVE" as const,
  };
}

beforeEach(() => {
  ls.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  campaignLaunches.useStore.getState().setAll([]);
});

describe("absorbLegacyLaunches", () => {
  it("adflow:launched: 접두사를 스캔해 흡수해요", () => {
    ls.set("adflow:launched:c1", JSON.stringify(launched("c1")));
    ls.set("adflow:launched:c2", JSON.stringify(launched("c2")));
    ls.set("adflow:library", "건드리면 안 됨");

    expect(absorbLegacyLaunches().map((l) => l.campaignId).sort()).toEqual(["c1", "c2"]);
    expect(ls.has("adflow:launched:c1")).toBe(false);
    expect(ls.get("adflow:library")).toBe("건드리면 안 됨");
  });
});

describe("loadLaunchedCampaign", () => {
  it("동기로 campaignId 조회돼요", () => {
    campaignLaunches.useStore.getState().setAll([launched("c1")]);
    expect(loadLaunchedCampaign("c1")?.adSetId).toBe("adset_1");
    expect(loadLaunchedCampaign("없음")).toBeNull();
  });

  it("저장하면 바로 읽혀요 — 게재 직후 결과 카드가 이 경로다", () => {
    saveLaunchedCampaign(launched("c9"));
    expect(loadLaunchedCampaign("c9")?.campaignId).toBe("c9");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/autoRelaunch.test.ts src/entities/campaign/launched-storage.test.ts
```

기대: FAIL — 새 export 들이 없어 import 에러.

- [ ] **Step 3: 접두사 스캔 헬퍼를 만든다**

두 store 가 같은 일을 한다. 한 곳에 둔다.

`apps/web/src/shared/lib/store/legacyScan.ts`:

```ts
// 인덱스 키가 없는 레거시 저장 방식(키 하나당 항목 하나)에서 데이터를 건져 올린다.
// 스캔 뒤 해당 키를 지운다 — 남기면 다음 하이드레이션에서 같은 데이터가 다시 올라온다.

export function scanLegacyKeys<T>(prefix: string): T[] {
  if (typeof window === "undefined") return [];

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }

  const items: T[] = [];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) items.push(JSON.parse(raw) as T);
    } catch {
      // 깨진 항목은 버린다. 키는 아래에서 지워지므로 다시 시도하지 않는다.
    }
    try {
      localStorage.removeItem(k);
    } catch {}
  }
  return items;
}
```

`apps/web/src/shared/lib/store/index.ts` 에 export 를 더한다.

```ts
export { scanLegacyKeys } from "./legacyScan";
```

- [ ] **Step 4: `autoRelaunch` 를 승격한다**

`apps/web/src/shared/lib/autoRelaunch.ts` 를 아래로 **교체**한다. `AutoRelaunchEntry` 선언은 그대로다.

```ts
"use client";

// useAutoRelaunch — Auto Relaunch 상태(ADR-012). 단계 3 에서 Tier 1 으로 승격.
// 이전: `auto-relaunch:<campaignId>` 키 + syncUpsert 미러(에러 삼킴).

import { useCallback } from "react";
import { createSyncedStore, scanLegacyKeys } from "./store";

export type AutoRelaunchEntry = {
  campaignId: string;
  enabled: boolean;
  cycleCount: number;
  parentCampaignId?: string;
  createdAt: string;
  updatedAt: string;
};

const LEGACY_PREFIX = "auto-relaunch:";
const STATES_KEY = "adflow:auto-relaunch:v1"; // zustand persist 봉투

/** 인덱스가 없어 접두사 스캔으로 건져 올린다. */
export function absorbLegacyAutoRelaunch(): AutoRelaunchEntry[] {
  return scanLegacyKeys<AutoRelaunchEntry>(LEGACY_PREFIX).filter((e) => !!e?.campaignId);
}

export const autoRelaunchStates = createSyncedStore<AutoRelaunchEntry>({
  name: STATES_KEY,
  endpoint: "/api/stores/auto-relaunch",
  idOf: (e) => e.campaignId,
  migrate: absorbLegacyAutoRelaunch,
});

const { useStore } = autoRelaunchStates;

if (typeof window !== "undefined") autoRelaunchStates.rehydrate();

/** 동기 포인트 리더. presenter-fast-forward·campaigns/[id] 가 렌더 중 호출한다. */
export function readAutoRelaunch(campaignId: string): AutoRelaunchEntry | null {
  return autoRelaunchStates.snapshot().find((e) => e.campaignId === campaignId) ?? null;
}

export function useAutoRelaunch() {
  autoRelaunchStates.useSync();
  const upsert = useStore((s) => s.upsert);

  const get = useCallback((campaignId: string) => readAutoRelaunch(campaignId), []);

  const setEnabled = useCallback(
    (campaignId: string, enabled: boolean): void => {
      const now = new Date().toISOString();
      const existing = readAutoRelaunch(campaignId);
      upsert(
        existing
          ? { ...existing, enabled, updatedAt: now }
          : { campaignId, enabled, cycleCount: 1, createdAt: now, updatedAt: now },
      );
    },
    [upsert],
  );

  const inheritFromParent = useCallback(
    (parentCampaignId: string, newCampaignId: string, enabledOverride?: boolean): void => {
      const parent = readAutoRelaunch(parentCampaignId);
      const now = new Date().toISOString();
      upsert({
        campaignId: newCampaignId,
        enabled: enabledOverride !== undefined ? enabledOverride : (parent?.enabled ?? true),
        cycleCount: (parent?.cycleCount ?? 1) + 1,
        parentCampaignId,
        createdAt: now,
        updatedAt: now,
      });
    },
    [upsert],
  );

  const getCycleCount = useCallback(
    (campaignId: string): number => readAutoRelaunch(campaignId)?.cycleCount ?? 1,
    [],
  );

  return { get, setEnabled, inheritFromParent, getCycleCount };
}
```

- [ ] **Step 5: `launched-storage` 를 승격한다**

`apps/web/src/entities/campaign/launched-storage.ts` 를 아래로 **교체**한다.

```ts
"use client";

// PRD-ab-testing.md §10.1 — 게재 영수증. 단계 3 에서 Tier 1 으로 승격.
// 이전: `adflow:launched:{campaignId}` 키 + syncUpsert 미러(에러 삼킴).

import { createSyncedStore, scanLegacyKeys } from "@shared/lib/store";
import type { LaunchedCampaign } from "./model";

const LEGACY_PREFIX = "adflow:launched:";
const LAUNCHES_KEY = "adflow:launches:v1"; // zustand persist 봉투

/** 인덱스가 없어 접두사 스캔으로 건져 올린다. */
export function absorbLegacyLaunches(): LaunchedCampaign[] {
  return scanLegacyKeys<LaunchedCampaign>(LEGACY_PREFIX).filter((l) => !!l?.campaignId);
}

export const campaignLaunches = createSyncedStore<LaunchedCampaign>({
  name: LAUNCHES_KEY,
  endpoint: "/api/stores/campaign-launches",
  idOf: (l) => l.campaignId,
  migrate: absorbLegacyLaunches,
});

if (typeof window !== "undefined") campaignLaunches.rehydrate();

/** 게재 직후 저장. 훅 밖(핸들러)에서 호출되므로 동기 시그니처를 유지한다. */
export function saveLaunchedCampaign(value: LaunchedCampaign): void {
  campaignLaunches.useStore.getState().upsert(value);
}

/** 동기 포인트 리더. campaigns/[id] 가 useState 초기화자에서 호출한다. */
export function loadLaunchedCampaign(campaignId: string): LaunchedCampaign | null {
  return campaignLaunches.snapshot().find((l) => l.campaignId === campaignId) ?? null;
}
```

- [ ] **Step 6: 하이드레이션 배선을 붙인다**

두 store 는 훅 밖에서도 읽히지만 서버 하이드레이션은 훅에서 일어난다. `useAutoRelaunch()` 는 이미 `useSync()` 를 부른다. `campaignLaunches` 는 훅이 없으므로 **`campaigns/[id]` 페이지에서 한 번 배선한다.**

`apps/web/app/(workspace)/campaigns/[id]/page.tsx` 의 import 에 더한다.

```ts
import { campaignLaunches } from "@entities/campaign/launched-storage";
```

컴포넌트 본문 맨 위(다른 훅 호출과 나란히)에 한 줄을 넣는다.

```ts
  campaignLaunches.useSync();
```

- [ ] **Step 7: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/autoRelaunch.test.ts src/entities/campaign/launched-storage.test.ts
npx tsc --noEmit --project tsconfig.json
```

기대: PASS, 6건 · tsc 에러 0.

- [ ] **Step 8: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/web
git commit -m "feat(web): auto-relaunch · campaign-launches Tier 1 승격 — 인덱스 없는 레거시 키 접두사 스캔"
```

---

## Task 9: 브라우저 직접 write 제거 + 계약 갱신

이 Task 가 단계 3 의 성과를 확정한다.

**Files:**
- Delete: `apps/web/src/shared/lib/supabase-sync.ts`
- Delete: `apps/web/src/shared/lib/supabase.ts`
- Modify: `apps/web/src/features/goal/model/useGoalsStorage.test.ts`
- Modify: `apps/web/.env.example`
- Modify: `apps/web/src/shared/lib/backend/contract-compat.ts`
- Modify: `packages/contracts/openapi.json` · `types/api.d.ts` (생성물)

**Interfaces:**
- Consumes: Task 2~8 전부
- Produces: `contract-compat.ts` 에 신규 4종 단언 (예외 4개 명시)

- [ ] **Step 1: 남은 참조가 없는지 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
grep -rn "syncUpsert\|syncDelete" apps/web/src apps/web/app apps/web/lib
```

기대: `useGoalsStorage.test.ts` 의 `vi.mock` 만 남는다. 다른 것이 나오면 그 파일을 먼저 처리하라.

- [ ] **Step 2: 방어적 mock 을 지운다**

`apps/web/src/features/goal/model/useGoalsStorage.test.ts` 의 아래 블록을 삭제한다. `useGoalsStorage.ts` 는 이 모듈을 쓰지 않으므로 mock 이 필요 없었다.

```ts
vi.mock("@shared/lib/supabase-sync", () => ({
  syncUpsert: vi.fn(),
  syncDelete: vi.fn(),
}));
```

- [ ] **Step 3: 두 모듈을 삭제한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
rm apps/web/src/shared/lib/supabase-sync.ts apps/web/src/shared/lib/supabase.ts
```

- [ ] **Step 4: 환경변수 문서에서 브라우저 키를 내린다**

`apps/web/.env.example` 의 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY` 항목을 지우고 그 자리에 한 줄을 남긴다.

```
## NEXT_PUBLIC_SUPABASE_* 는 단계 3 에서 제거됐어요 — 브라우저가 Supabase 에 직접 쓰지 않아요.
```

- [ ] **Step 5: 성과 지표를 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
echo "syncUpsert/syncDelete: $(grep -rn 'syncUpsert\|syncDelete' apps/web/src apps/web/app apps/web/lib | wc -l | tr -d ' ')"
echo "NEXT_PUBLIC_SUPABASE: $(grep -rn 'NEXT_PUBLIC_SUPABASE' apps/web/src apps/web/app apps/web/lib | wc -l | tr -d ' ')"
ls apps/web/src/shared/lib/supabase*.ts 2>/dev/null && echo "❌ 남아있음" || echo "✅ 삭제됨"
```

기대: `0` · `0` · `✅ 삭제됨`

- [ ] **Step 6: 계약을 재생성한다**

Spring 을 띄운 상태여야 한다.

```bash
cd /Users/jieunsse/jieunsse/dev/meta
docker compose up -d postgres
cd apps/api
ADFLOW_JWT_SECRET='<로컬 값>' ADFLOW_INTERNAL_SECRET='<로컬 값>' ADFLOW_ENCRYPTION_KEY='<로컬 32자>' \
  ./gradlew bootRun --args='--spring.profiles.active=local' > /tmp/spring-bootrun.log 2>&1 &
until curl -sf http://localhost:8080/actuator/health > /dev/null; do sleep 2; done
cd /Users/jieunsse/jieunsse/dev/meta && npm run contracts:generate
grep -oE '"/stores/[a-z-]+"' packages/contracts/openapi.json | sort -u
```

기대: 경로 8개 — `/stores/auto-relaunch`·`/stores/brand-profiles`·`/stores/campaign-launches`·`/stores/creators`·`/stores/influencer-campaigns`·`/stores/library`·`/stores/personas`·`/stores/sops`

- [ ] **Step 7: 호환성 단언을 확장한다**

`apps/web/src/shared/lib/backend/contract-compat.ts` 의 import 와 단언을 더한다.

```ts
import type { AutoRelaunchEntry } from "@shared/lib/autoRelaunch";
import type { LaunchedCampaign } from "@entities/campaign/model";
import type { PersonaEntry } from "@features/brand-profile/model/usePersonasStorage";
import type { Sop } from "@features/sop/model/useSopStorage";
```

파일 끝에 붙인다.

```ts
// 단계 3 — 승격된 4종.
export type PersonaIsCompatible = Assert<AssignableTo<Api<"Persona">, PersonaEntry>>;
export type AutoRelaunchIsCompatible = Assert<
  AssignableTo<Api<"AutoRelaunchState">, AutoRelaunchEntry>
>;

// sections 는 SopSection 판별 유니온이라 OpenAPI 로 표현할 수 없다(policy 와 같은 이유).
// 왕복은 SopControllerTest.판별유니온_sections_가_그대로_왕복한다 가 지킨다.
export type SopIsCompatible = Assert<
  AssignableTo<Omit<Api<"Sop">, "sections">, Omit<Sop, "sections">>
>;

// 게재 영수증은 계약이 지켜주지 못하는 필드가 셋이다.
//   adIds          — TS 튜플 [string, string]. springdoc 이 prefixItems 를 내지 않는다.
//   abTestVariantB — 판별 유니온.
//   goalId         — const 배열에서 파생된 유니온. Java 로 옮기면 목록이 두 곳에 살아 드리프트한다.
// 셋의 왕복은 CampaignLaunchControllerTest·CampaignLaunchPostgresIT 가 런타임으로 지킨다.
type LaunchOpaque = "adIds" | "abTestVariantB" | "goalId";
export type CampaignLaunchIsCompatible = Assert<
  AssignableTo<Omit<Api<"CampaignLaunch">, LaunchOpaque>, Omit<LaunchedCampaign, LaunchOpaque>>
>;
```

- [ ] **Step 8: 컴파일해서 실제 불일치를 찾는다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
```

**에러가 나는 것이 정상이다.** 단계 2 Task 9 와 같은 처방을 쓴다 — **프론트 타입은 건드리지 않고 Java 쪽 `@Schema` 를 맞춘다.** 자주 나오는 것:

| 증상 | 처방 |
|---|---|
| 생성 타입 필드가 `T \| undefined` 인데 도메인은 필수 | 해당 Java 필드에 `@Schema(requiredMode = REQUIRED)` |
| `updatedAt` 이 `string` 아닌 다른 타입 | `domainUpdatedAt` 이 `String` 인지 확인 |
| `status` 가 `string` | `LaunchStatus` 가 자바 enum 인지 확인 |

Java 를 고쳤으면 `bootRun` 을 다시 띄우고 Step 6 부터 반복한다.

- [ ] **Step 9: 전체 회귀를 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json && echo "계약 호환 OK"
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
npm run build
```

기대: tsc 에러 0 · Vitest 기존 691 + 신규(Task 1 의 3 + Task 6 의 6 + Task 7 의 3 + Task 8 의 6 = 18) = **709 tests** · build 성공.

- [ ] **Step 10: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/web packages/contracts apps/api
git commit -m "feat(web): 브라우저 Supabase 직접 write 제거 — supabase-sync · anon 클라이언트 삭제"
```

---

## Task 10: 로컬 통합 확인

MockMvc 는 ERROR 디스패치를 재현하지 않는다. 신규 엔드포인트 4개를 **실제 HTTP 로** 확인한다. 단계 2 에서 만든 검증 스크립트와 같은 방식이다.

**Files:** 없음 (검증 전용).

- [ ] **Step 1: 두 프로세스를 띄우고 테이블을 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
docker compose exec -T postgres psql -U adflow -d adflow -tAc \
  "select count(*) from information_schema.tables where table_schema='public'"
docker compose exec -T postgres psql -U adflow -d adflow -c "\dt" | grep -E "sops|personas|auto_relaunch|campaign_launch"
```

기대: 테이블 수 **19개** (단계 2 의 12 + `sops`·`personas`·`persona_genders`·`persona_locations`·`persona_interests`·`auto_relaunch_states`·`campaign_launches` … 실제 수를 세어 기록하라). 위 grep 에 7줄 이상이 나온다.

- [ ] **Step 2: 토큰을 받고 4개 엔드포인트를 친다**

```bash
SECRET='<내부 시크릿>'
RESP=$(curl -sS -X POST http://localhost:8080/auth/exchange \
  -H "Content-Type: application/json" -H "X-Internal-Secret: $SECRET" \
  -d '{"ownerKey":"me@example.com","email":"me@example.com","role":"팀장","metaConnection":{"accessToken":"EAAG-x"}}')
TOKEN=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['token'])" "$RESP")

for p in sops personas auto-relaunch campaign-launches; do
  echo -n "토큰 없이 /stores/$p → "
  curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8080/stores/$p
done
```

기대: 전부 `401`.

- [ ] **Step 3: ERROR 디스패치 회귀를 확인한다**

```bash
echo -n "id 없는 저장 (400 기대, 401 이면 회귀) → "
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/stores/sops \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"item":{"name":"이름만"}}'

echo -n "campaignId 없는 저장 (400 기대) → "
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/stores/auto-relaunch \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"item":{"enabled":true,"cycleCount":1}}'
```

기대: `400` · `400`.

- [ ] **Step 4: 와이어 형태를 눈으로 확인한다**

```bash
curl -sS -X POST http://localhost:8080/stores/auto-relaunch \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"item":{"campaignId":"camp_curl","enabled":true,"cycleCount":2,"createdAt":"2026-07-01T00:00:00Z","updatedAt":"2026-07-02T00:00:00Z"}}'
echo
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/stores/auto-relaunch | python3 -m json.tool

curl -sS -X POST http://localhost:8080/stores/sops \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"item":{"id":"sop_curl","name":"정책","sections":[{"type":"prohibited_words","data":{"words":["최저가"]}}],"createdAt":"2026-07-01T00:00:00Z","updatedAt":"2026-07-02T00:00:00Z"}}'
echo
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/stores/sops | python3 -m json.tool
```

기대:
- auto-relaunch 항목에 `campaignId` 가 있고 **`id` 와 `ownerKey` 가 없다**
- sop 항목의 `updatedAt` 이 `"2026-07-02T00:00:00Z"`(도메인 값)이지 서버 시각이 아니다
- `sections` 가 배열이고 중첩 `data.words` 가 살아 있다

- [ ] **Step 5: 둘러보기가 Spring 을 호출하지 않는지 확인한다**

Spring 을 요청 로깅과 함께 띄운다.

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api
ADFLOW_JWT_SECRET='<로컬 값>' ADFLOW_INTERNAL_SECRET='<로컬 값>' ADFLOW_ENCRYPTION_KEY='<로컬 32자>' \
  ./gradlew bootRun --args='--spring.profiles.active=local --logging.level.org.springframework.security.web.FilterChainProxy=DEBUG' \
  > /tmp/spring-bootrun.log 2>&1 &
```

`npm run dev` 로 앱을 띄우고 **둘러보기**로 들어간 뒤 `/sop`·`/brand-profile`·`/campaigns` 를 돌아본다.

```bash
grep -cE "Securing .* /stores/(sops|personas|auto-relaunch|campaign-launches)" /tmp/spring-bootrun.log
```

기대: **0**.

- [ ] **Step 6: 실사용 경로를 확인한다**

Facebook 으로 로그인한 뒤:

1. `/sop` 에서 SOP 을 하나 만들고 섹션을 채운다 → 시크릿 창으로 같은 계정 로그인 시 보이면 서버가 진실의 원천이다
2. 브랜드 프로필에 페르소나를 추가하고 **프로필을 삭제** → 딸린 페르소나가 함께 사라져야 한다 (Task 7 의 결합 제거가 실제로 동작하는지)
3. Spring 을 내리고 SOP 을 하나 더 만든다 → **"저장이 서버에 닿지 않았어요" 토스트**가 떠야 한다 (단계 2 Task 8 의 장치가 신규 store 에도 걸렸는지)

- [ ] **Step 7: 최종 회귀**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
docker compose down
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon   # Docker 없이 통과해야 함
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
npm run build
```

기대: integrationTest 15건 · test 56건(Docker 없이) · tsc 0 · Vitest 709 · build 성공.

---

## 완료 조건

- [ ] `grep -rn "syncUpsert\|syncDelete" apps/web/src apps/web/app apps/web/lib` → **0건**
- [ ] `grep -rn "NEXT_PUBLIC_SUPABASE" apps/web/src apps/web/app apps/web/lib` → **0건**
- [ ] `apps/web/src/shared/lib/supabase-sync.ts` · `supabase.ts` **삭제됨**
- [ ] `cd apps/api && ./gradlew test` green (**56건**), **Docker 없이도 통과**
- [ ] `cd apps/api && ./gradlew integrationTest` green (**15건**)
- [ ] `npm test` → **709 tests** green
- [ ] `npm run build` 성공 · `tsc` 에러 0
- [ ] `/stores/*` 경로가 OpenAPI 에 **8개**
- [ ] 4개 신규 엔드포인트 — 토큰 없으면 401, id 없는 저장은 **실제 HTTP 에서 400**
- [ ] `auto-relaunch`·`campaign-launches` 응답에 `id`·`ownerKey` 가 **없고** `campaignId` 가 있다
- [ ] `Sop.updatedAt` 이 도메인 값이지 서버 시각이 아니다
- [ ] 프론트 도메인 타입 4종(`Sop`·`PersonaEntry`·`AutoRelaunchEntry`·`LaunchedCampaign`) 선언이 **한 줄도 바뀌지 않았다**
- [ ] `readPersonas()`·`loadLaunchedCampaign()`·`useAutoRelaunch().get()` 이 **여전히 동기**다
- [ ] 프로필 삭제 시 딸린 페르소나가 함께 사라진다
- [ ] 둘러보기 모드에서 신규 4개 경로 호출 **0건**
- [ ] 커밋 8개, Task 단위

## 이 단계에서 하지 않는 것

- **나머지 테이블·스토리지 버킷** — 단계 4 (`products`·`reference_materials`·`ig_messages`·`onboarded_users`·`notion_connections`·`cron_runs` + 버킷 2개)
- **토너먼트 정규화·엔진 Java 포팅** — 단계 5
- **`@Version` 낙관적 락** — 단계 5
- **서버 라우트의 Supabase 제거** — `app/api/brand-profile/*`·`instagram/*`·`onboarding/*` 등은 아직 `getSupabaseServer()` 를 쓴다. 단계 4~7 대상이다. **이 단계가 없애는 것은 브라우저 직접 write 뿐이다.**
- **`campaign_launches` 의 깊은 정규화** — 게재 영수증이라 얕게 둔다 (위 §의도된 편차 #1)
- **기존 Supabase 데이터 이사** — 단계 7 의 ETL

## 자기 점검 결과

**설계 §9 단계 3 항목("레거시 미러 4개 Tier 1 승격 → 브라우저 직접 write 소멸") 대비 누락 없음** — 4개는 Task 2~5(서버)와 Task 6~8(프론트), "소멸"의 증명은 Task 9 Step 5 의 grep 두 줄.

**설계 §5 대비 차이 1건** — `campaign_launches` 를 얕게 다룬다. 근거는 위 §의도된 편차 #1.

**계획 작성 시점에 확인 못 한 것 1건** — Task 9 Step 8 의 타입 불일치가 몇 건 나올지는 **실행해봐야 안다.** 단계 2 에서 같은 지점이 44개 필드의 `@Schema(requiredMode)` 누락으로 드러났으므로 이번에도 비슷한 규모를 예상한다. 처방과 반복 절차를 적어뒀고 추측으로 숫자를 채우지 않았다.

**타입 일관성 확인** — `snapshot()`(Task 1 산출) 을 Task 7·8 이 소비한다. `scanLegacyKeys<T>`(Task 8 Step 3) 를 같은 Task 의 Step 4·5 가 쓴다. `absorbLegacy*` 세 함수는 각각 자기 모듈에서 export 되고 테스트가 직접 부른다. `removePersonasForProfile`(Task 7) 을 `brandProfileStore`(같은 Task) 가 쓴다.
