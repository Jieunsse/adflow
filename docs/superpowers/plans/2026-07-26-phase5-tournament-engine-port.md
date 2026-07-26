# 단계 5 — 토너먼트 정규화 + 순수 엔진 Java 포팅 + 골든 픽스처 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토너먼트 도메인의 **판정을 Java 가 소유**한다. 순수 엔진을 Java 로 포팅하고, TS·Java 가 **같은 골든 픽스처**를 읽어 같은 답을 내는 것을 CI 로 강제한다. 애그리거트는 정규화해 Spring 이 영속한다. 트리거·Meta I/O 는 아직 TS 에 남는다(단계 6).

**Architecture:** 이 단계의 위험은 "포팅했는데 미묘하게 다르다" 하나뿐이다. 그래서 순서를 뒤집는다 — **픽스처를 먼저 만들고 TS 를 거기에 묶은 뒤** Java 를 포팅한다. 픽스처가 통과하면 두 엔진이 같다는 뜻이고, 실패하면 어느 함수가 갈라졌는지 이름으로 바로 나온다.

**Tech Stack:** 단계 4 와 동일 — Spring Boot 4.1.0 · Jackson 3 · Hibernate 7 · Testcontainers 2.0.5 · JDK 21 · H2(단위) / PostgreSQL 16(통합) · Next.js 16 · Vitest

## Global Constraints

- **와이어 형태 동결.** `Tournament`·`TourRound`·`Hypothesis` 등 TS 선언을 한 줄도 바꾸지 않는다.
- **둘러보기는 Spring 을 호출하지 않는다.** TS 엔진은 **삭제하지 않는다** — 둘러보기가 계속 돌려야 한다(설계 §7). 이중화는 의도된 상태이고 픽스처가 방어한다.
- `./gradlew test` 는 **Docker 없이** green (H2).
- **회귀 기준선**: `npm test` **718 tests / 70 files**, `./gradlew test` **99건**, `./gradlew integrationTest` **17건**.
- `npm run build` · `npx tsc --noEmit --project apps/web/tsconfig.json` 성공 유지.
- 새 의존성 **없음**. 픽스처는 JSON, 파싱은 Jackson(이미 있음)·`JSON.parse`.
- 커밋 메시지는 `type(scope): 한국어 설명`. 스코프에 **쉼표 금지**(훅이 막는다). `Co-Authored-By:` 금지. `git push` 금지.
- **단계 5 시작 전 롤백 태그**: `git tag pre-phase5`.

## 설계 문서의 포팅 목록이 틀린 곳 — 2건

설계 §6 은 Java 로 옮길 순수 엔진을 7개로 적었다. 코드를 읽어보니 둘은 대상이 아니다.

| 파일 | 설계의 분류 | 실제 | 판단 |
|---|---|---|---|
| `ledger.ts` | 순수 엔진 | **localStorage store 다.** 62줄 전부 `window`·`localStorage` 접근이고 순수 함수가 하나도 없다. 실유저 경로는 이미 이걸 안 쓴다 — `hypothesis.ts` 의 `deriveLedger()` 가 토너먼트에서 평탄화한다(ADR-047) | **포팅 안 함.** 둘러보기 전용 store |
| `report.ts` | 순수 엔진 | **표시용 파생이다.** Meta 스타일 리포트 카드(reach·frequency·cpc·budgetRemaining)를 만들 뿐 승격에 관여하지 않는다("통계적 표기 ≠ 승격 기준"). Java 는 이 카드를 렌더하지 않는다 | **포팅 안 함.** 단, 그 안의 통계 코어(`confidenceFromZTest`·`confidenceFromCountTest`)는 엔진 것을 재사용하므로 자동으로 함께 포팅된다 |

포팅 대상은 다섯이다 — `objective-metric.ts` · `lever.ts` · `engine.ts`(결정 함수) · `hypothesis.ts`(순수부) · `transitions.ts`.

## 실측으로 확인된 사실

| 확인 항목 | 결과 |
|---|---|
| 순수 엔진 규모 | 포팅 대상 5파일 ≈ **875줄**. 나머지(`runner`·`server-runner`·`client`·`seed`·`meta-*`)는 부작용이 있어 대상 아님 |
| `seededUnit` 의 이식성 | `h = (h * 31 + charCodeAt(i)) \| 0` — **JS 의 `\|0` 은 int32 wrap 이고 Java `int` 가 정확히 같다.** 캐스팅 없이 1:1 포팅된다. 이게 안 맞으면 시드 KPI 전부가 갈라진다 |
| `stdNormalCdf` | `Math.exp`·`Math.sqrt` 사용. **V8 과 JVM 의 마지막 ulp 가 다를 수 있다** — 픽스처 비교는 정확 일치가 아니라 epsilon 이어야 한다 |
| `newTournamentId()` | `Math.random()` — 순수하지 않다. 포팅 대상에서 뺀다(id 는 클라가 만들어 보낸다, 단계 2~4 와 같은 계약) |
| `Tournament` 필드 수 | **29개** + 중첩 6종(`TourVariant`·`TourRound`·`RoundVerdict`·`Hypothesis`·`TourEnvelope`·`TournamentDelivery`) |
| `TournamentDelivery.accessToken` | **Meta 장기 토큰이 평문으로 jsonb 에 들어 있다.** 정규화하면서 `EncryptedStringConverter` 를 걸어야 한다 |
| `TourRound.adIds`·`adSetIds`·`adKpis` | 전부 TS 튜플 `[T, T]` — 단계 3 의 `LaunchedCampaign.adIds` 와 같은 계약 한계 |
| 기존 TS 테스트 | `tournament.test.ts`(256) · `hypothesis.test.ts`(142) · `cascade.test.ts`(91) · `report.test.ts`(80) · `deriveBeat.test.ts`(93) — 픽스처의 원재료 |
| `supabase-store.ts` 의 `normalize()` | 레거시 `manual-n` 행을 `auto` 로 흡수하는 읽기 경계 패치(ADR-054). Spring 으로 옮길 때 **같은 흡수를 해야** 옛 토너먼트가 멈추지 않는다 |
| Gradle 테스트 리소스 | `build.gradle.kts` 에 `sourceSets.test.resources.srcDir` 한 줄이면 픽스처가 클래스패스에 올라온다. 새 의존성 불필요 |

## 골든 픽스처 설계

`packages/contracts/fixtures/tournament/` 아래 JSON 5개. 양쪽이 **같은 파일**을 읽는다.

| 파일 | 지키는 것 | 왜 분리했나 |
|---|---|---|
| `seeded-unit.json` | `seededUnit(seed, index)` | **결정성의 뿌리.** 이게 갈라지면 아래 전부가 갈라지므로 맨 먼저 실패해야 한다 |
| `judge-round.json` | `judgeRoundKpis` · `confidenceFromZTest` · `confidenceFromCountTest` | 판정 코어. 이 단계의 본체 |
| `round-kpis.json` | `roundAdKpis` · `settleRound` | 시드 KPI 생성기 (둘러보기 시뮬) |
| `tournament-state.json` | `deriveBeat` · `championDefendStreak` · `hasConverged` · `isEnvelopeExhausted` · `canAutoRefill` · `endCompletionReason` | 상태 판정 |
| `hypothesis.json` | `selectNextLever` · `buildHypothesis` · `resolveHypothesis` · `demoLeverFactor` | 가설 결정 (ADR-044) |

**형식** — 케이스마다 `name`(실패 시 이름으로 위치 특정) · `input` · `expected`.

```json
{ "seededUnit": [ { "name": "빈 문자열", "input": { "seed": "", "index": 0 }, "expected": 0.328 } ] }
```

**부동소수 비교는 epsilon `1e-9`.** 정확 일치를 요구하면 `Math.exp` 의 마지막 ulp 차이로 CI 가 흔들린다.

## 계약이 지켜주지 못하는 필드 (예상)

| 필드 | 이유 |
|---|---|
| `TourRound.adIds` · `adSetIds` · `adKpis` | TS 튜플 `[T, T]` — springdoc 이 `prefixItems` 를 내지 않는다 (단계 3 과 동일) |
| `Hypothesis.lever` | `CopyHook | NonCopyLever` 유니온이 `@entities/creative/options` 에서 파생 — Java 로 옮기면 목록이 두 곳에 산다 |
| `Tournament.completionReason` 등 문자열 유니온 | Java enum 을 만들면 드리프트. `String` 으로 두고 왕복만 지킨다 |

---

## Task 1: 골든 픽스처 + TS 를 픽스처에 묶기

Java 를 한 줄도 쓰기 전에 한다. 이 태스크가 끝나면 **TS 엔진의 답이 파일로 고정**되고, 그 파일이 곧 Java 의 명세가 된다.

**Files:**
- Create: `packages/contracts/fixtures/tournament/*.json` (5개)
- Create: `apps/web/src/entities/ab-test/tournament/golden.test.ts`

- [x] **Step 1: 픽스처 생성 스크립트로 현재 TS 답을 떠낸다**

손으로 기대값을 적지 않는다 — 지금 TS 엔진이 내는 답이 곧 기준이다. 스크립트로 뽑되, **뽑은 값이 상식적인지 눈으로 확인**한다(0.5 만 잔뜩 나오면 입력이 잘못된 것이다).

- [x] **Step 2: `golden.test.ts` 가 픽스처를 읽어 TS 엔진을 검증한다**

이 테스트는 지금 당연히 통과한다. 의미는 **잠금**이다 — 이후 TS 엔진을 건드리면 여기서 깨진다.

- [x] **Step 3: 검증**

```bash
cd /Users/jieunsse/jieunsse/dev/meta && npm test -- --run 2>&1 | grep -E "Test Files|Tests "
```

---

## Task 2: Java 엔진 포팅 — 픽스처가 명세다

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/tournament/engine/*.java`
- Create: `apps/api/src/test/java/ai/adflow/api/tournament/engine/GoldenFixtureTest.java`
- Modify: `apps/api/build.gradle.kts` (픽스처를 테스트 리소스로)

- [x] **Step 1: 픽스처를 클래스패스에 올린다**
- [x] **Step 2: 실패하는 `GoldenFixtureTest` 를 쓴다** — 5개 파일을 전부 읽는다
- [x] **Step 3: `seededUnit` 부터 포팅** — 뿌리부터
- [x] **Step 4: 통계 · 판정 코어 포팅** (`stdNormalCdf`·`confidence*`·`judgeRoundKpis`)
- [x] **Step 5: 시드 KPI 생성기 포팅** (`roundAdKpis`·`settleRound`)
- [x] **Step 6: 상태 판정 포팅** (`deriveBeat` 계열)
- [x] **Step 7: 가설 결정 포팅** (`selectNextLever` 계열)
- [x] **Step 8: 전체 green 확인**

---

## Task 3: 토너먼트 애그리거트 정규화

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/tournament/*.java` (엔티티·리포지토리·컨트롤러)
- Test: 단위 + Postgres 통합

`Tournament` 29필드 + 중첩 6종을 관계형으로 펼친다. `delivery.accessToken` 은 **암호화**한다.

---

## Task 4: 라운드 진행 엔드포인트 + Next 배선

단계 5 의 종착점 — `POST /tournaments/{id}/settle` 이 Java 엔진으로 판정하고, Next 의 cron 은 **얇은 트리거**로 남는다(설계 §9). Meta 게재·KPI 조회는 아직 TS 라 Spring 이 Next 내부 엔드포인트에 역위임한다.

---

## 진행 상태 (구현 중 실측)

| 태스크 | 상태 | 실측 |
|---|---|---|
| Task 1 골든 픽스처 + TS 잠금 | **완료** | 픽스처 5파일 · TS 340 케이스 green |
| Task 2 Java 엔진 포팅 | **완료** | Java 338 케이스 green. 역검증 3종(시드 곱수 40건·추천 훅 10건·승격 임계 1건)이 각각 깨지는 것 확인 |
| Task 3 애그리거트 정규화 | **완료** | 단위 10건 · Postgres 통합 4건. 계약 단언 5종 추가 |
| Task 4 라운드 진행 엔드포인트 + Next 배선 | **미착수** | 아래 §남은 일 |

### 구현 중 알게 된 것

- **`Variant.headline`·`primaryText` 가 계약에서 optional 로 나갔다.** TS 는 required 다. 손으로 쓴 왕복
  테스트는 값이 있는 경우만 봐서 못 잡았고 **계약 단언이 잡았다.** `@Schema(REQUIRED)` 를 붙여 정정.
- **`leverPool` 을 traffic 만 픽스처에 담았다가 넓혔다.** 목표별 추천 3훅 표가 TS·Java 양쪽에 사는데
  픽스처가 한 목표만 덮으면 나머지 3개의 드리프트를 못 잡는다. 5개 목표 × 풀 전체를 박았다.
- **Postgres 통합 테스트가 트랜잭션 밖에서 `deleteBy…` 를 불러 깨졌다.** 매핑 문제가 아니라 테스트
  경계 문제였다 — 컨트롤러와 같이 `TransactionTemplate` 으로 감쌌다.
- **테스트가 레포에 파일을 남겼다**(단계 4 의 `.adflow-files`). 이번엔 골든 픽스처를 테스트 리소스로
  얹었을 뿐이라 재발하지 않았다.

## 남은 일 — Task 4

단계 5 의 종착점(`POST /tournaments/{id}/settle` + Next cron 을 얇은 트리거로)이 남았다. 지금 상태에서
멈춰도 **앱은 그대로 동작한다** — Spring 에 엔티티와 엔드포인트가 생겼을 뿐 Next 가 아직 호출하지 않고,
실유저 토너먼트는 여전히 Supabase 로 돈다. 되돌릴 것이 없는 지점이다.

Task 4 를 할 때 정해야 할 것 둘:

1. **Meta 게재·KPI 조회의 역위임 경로.** 설계 §9 는 Spring 이 Next 내부 엔드포인트에 되부른다고 했다.
   내부 시크릿 경로(`/internal/*`)가 단계 4 에서 이미 생겼으므로 그 위에 얹으면 된다.
2. **`tournaments` 데이터 이사 시점.** 지금은 Supabase 와 Spring 에 스키마가 둘 다 있다. 단계 7 ETL
   전까지 실유저 토너먼트를 어느 쪽이 소유할지 — 둘 다 쓰면 갈라진다.

## 완료 조건

- 골든 픽스처를 **TS·Java 양쪽이 읽고 둘 다 green**
- `./gradlew test` green (Docker 없이), `npm test` 718건 이상 green
- `tsc --noEmit` 에러 0, `npm run build` 성공
- 둘러보기가 Spring 을 호출하지 않는다 (TS 엔진 존치)

## 이 단계에서 하지 않는 것

- **Meta 클라이언트 Java 재작성** — 단계 6. 최고 위험 조각이라 엔진 포팅과 분리한다(설계 §9)
- **`ledger.ts`·`report.ts` 포팅** — 위 §설계 문서의 포팅 목록이 틀린 곳 참고
- **TS 엔진 삭제** — 둘러보기가 계속 쓴다. 이중화는 의도된 상태
- **`notion_connections` 이관** — 단계 4 에서 유예
