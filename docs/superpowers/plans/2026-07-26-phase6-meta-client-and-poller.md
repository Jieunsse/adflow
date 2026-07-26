# 단계 6 — Meta 클라이언트 Java 재작성 + 무인 폴러 + SSE 다리 (사후 기록)

> 계획서를 먼저 쓰지 않고 바로 구현했다. 이 문서는 **끝난 뒤에 남기는 기록**이다 — 무엇을 왜 그렇게
> 했는지와, 다음 단계로 넘긴 것.

**Goal:** 폴러가 Spring 에서 무인으로 돈다. 단계 5 가 남긴 Next 역위임(Meta KPI)을 없앤다.

**실측 결과**

| 검증 | 결과 |
|---|---|
| `./gradlew test` | **504건** green (457 → 504), Docker 없이 |
| `./gradlew integrationTest` | **26건** green (23 → 26), 실제 PostgreSQL 16 |
| `npm test` | **1097건 / 77파일** green (1074 / 74) |
| `tsc --noEmit` · `npm run build` | 에러 0 · 성공 |
| 라이브 스모크 | Spring 기동 → `/internal/tournaments` upsert → `POST /internal/poller/run` → `{scanned:1}` · 시크릿 없이 401 · cron 자기기록 남음 |

## 설계보다 좁게 간 곳 — Meta 클라이언트

설계 §6 은 `meta-ads-campaign.ts`(729줄) + `meta-ads-insights.ts`(738줄)를 통째로 Java 로 옮기라 했다.
**폴러가 실제로 쓰는 것은 셋뿐이다** — split test 게재 · 광고별 KPI · ad study 유의성. 나머지(캠페인
집계·과금·목표별 액션·상태 매핑)는 화면 전용이라 TS 에 남는다. 안 쓰는 분기를 옮기면 아무도 돌려보지
않는 코드가 늘 뿐이다. 결과 약 550줄.

같은 이유로 `SplitTestRequest` 는 TS `CreateCampaignParams` 25필드 중 **토너먼트 delivery 봉투가
표현할 수 있는 17필드만** 담는다. pixelId·customAudienceId·bidAmount·placements·phoneNumber·mode 는
게재 마법사 경로에서만 오고 폴러는 절대 채우지 않는다.

## 최고 위험 조각을 어떻게 방어했나

이 코드는 **실 Meta 계정 없이 검증할 방법이 없다.** TS 쪽은 실전에서 검증된 코드고 Java 재작성본은
아무도 돌려볼 수 없다. 단계 5 의 처방을 그대로 썼다 — TS 가 실제로 하는 일을 파일로 떠서 양쪽이 같은
파일을 읽는다.

| 픽스처 | 무엇을 잠그나 | 케이스 |
|---|---|---|
| `fixtures/meta/split-test-launch.json` | 게재 **요청 바디**와 호출 순서 | 5 (목표 4종 · 이미지 업로드 · CTA 3형태 · 축 2종) |
| `fixtures/meta/insights.json` | Meta **응답 파싱** | ad study 10 · 광고별 KPI 5 |

요청 쪽은 원본이 TS 가 보낸 것이고, 응답 쪽은 원본이 손으로 적은 입력이며 기대값만 TS 에서 떠냈다.

**역검증** — 픽스처가 헛돌지 않는지 확인했다:

| 훼손 | 깨지는 케이스 |
|---|---|
| 셀당 예산 절반(`/2`) 제거 | 5 |
| 날짜를 KST 대신 UTC 로 해석 | 5 |
| `promoted_object` 조건 제거 | 1 (leads_call) |
| 크리에이티브 이름의 공백 한 칸 | 5 |
| confidence 퍼센트 정규화 제거 | 1 |
| ctr 반올림 제거 | 1 |
| 유의 폴백 0.95 제거 | 1 |

## 판정·게재를 두 곳에 두지 않았다

단계 5 에서 결산을 TS 에서 들어낸 것과 같은 이유로, 이번엔 **게재와 레버 선택**을 들어냈다.
`server-runner.ts` 에서 `proposeChallenger`·`launchRound`·`autoAdvance` 를 지웠고 화면의 수동 액션
(`propose-challenger`·`launch`)은 `POST /internal/tournaments/{id}/advance` 로 Java 를 부른다.

판정 이중화보다 위험하다 — **실제 광고가 만들어지는 경로**라 사람이 누른 라운드와 폴러가 띄운 라운드가
다른 규칙으로 만들어지면 돈이 갈린다.

그 편집들도 같은 날 Spring 으로 옮겼다 — 아래 §동시 수정 구멍 참고.

## 역위임 — 없앤 것과 남긴 것

**없앴다:** Meta KPI 역위임(`RoundKpiClient` + `/api/internal/tournament/round-kpis`). 설계 §9 가
"단계 6 에서 그 역위임을 없앤다"고 한 바로 그것이다.

**남겼다:** 둘. 성격이 다르다.

1. **챌린저 카피 생성** → `POST /api/internal/creative/challenger`. Gemini 프롬프트 521줄이 화면 생성
   경로와 같은 파일에 산다. Java 로 옮기면 같은 한국어 프롬프트가 두 곳에서 갈라진다. 설계 §6 도 Meta
   클라이언트만 재작성 대상으로 적었다.
2. **SSE 알림 다리** → `POST /api/internal/notify/tournament-concluded`. 열린 커넥션이 Next 프로세스
   **메모리**에 있어 다른 프로세스에서 닿을 방법이 없다. 설계가 필수라고 못 박은 것이다.

## 설계와 다르게 간 것 하나 — SSE 다리가 토큰을 넘긴다

설계 §6 은 "토큰 대신 ownerKey 를 넘겨 Next 가 해석하게" 하자고 했다. 그런데 registry 키는 **액세스
토큰의 해시**이고 ownerKey 는 이메일일 수도 있다(`ownerKeyFrom`) — 이메일에서는 키를 역산할 수 없다.
Next 가 토너먼트를 Spring 에 되물어도 토큰은 어차피 같은 경계를 넘고, 저장 경로(`backend-store` 의
upsert)가 이미 이 봉투를 통째로 실어 보낸다. 지킬 것이 남아 있지 않은 규칙이라 토큰을 그대로 넘긴다.

문구는 Next 가 만든다 — 하우스 보이스(해요체)는 화면 쪽 규칙이라 서버가 한국어를 조립하지 않는다.

## 폴러

- `@Scheduled(fixedDelayString = "${app.poller.interval}")` — 운영 6시간, `local` 프로필 1분.
- `POST /internal/poller/run` — 한 사이클 즉시 실행. 로컬 편의만이 아니다: 배포하면 슬립하는 무료
  플랜에서 외부 cron 이 이 엔드포인트를 때려 기동하는 경로가 그대로 된다(설계 §6).
- **자기기록을 Spring 이 남긴다.** Next cron 라우트를 지우면 `cron_runs` 에 아무것도 안 남아 health 의
  dead-man's switch(ADR-042)가 "폴러가 죽었다"고 오탐한다. 폴러가 사이클마다 직접 기록한다.
- 테스트 프로필에서는 스케줄을 끈다(`app.poller.enabled=false`) — 컨텍스트가 뜨자마자 한 바퀴 도는
  것이 테스트의 관심사가 아니다.

## 구현 중 잡은 실제 버그

- **`setRounds` 로 컬렉션을 통째로 갈아끼워 orphanRemoval 이 깨졌다.** 영속 상태 엔티티에서 컬렉션
  인스턴스를 바꾸면 Hibernate 가 터진다("A collection with orphan deletion was no longer referenced").
  단계 5 의 upsert 는 detached 엔티티라 안 걸렸고, 폴러가 관리 중인 엔티티를 고치면서 드러났다.
  `addRound()` 로 제자리에 더한다. **첫 폴러 틱에서 터졌을 버그다.**
- **`RestClient.Builder` 빈이 없다.** Boot 4 의 webmvc starter 는 자동 구성해주지 않아 컨텍스트가
  통째로 안 떴다. 주입 대신 `RestClient.create()`.
- **Jackson 은 `IntNode(1)` 과 `LongNode(1)` 을 다르게 본다.** 골든 비교가 내용은 같은데 계속 깨졌다.
  직렬화 후 재파싱해 정규화한다.
- **픽스처 생성기가 케이스 간 ID 카운터를 리셋하지 않았다.** 잠금 테스트가 바로 잡았다 — 생성기와
  검증기가 같은 스텁을 쓰도록 고쳐 다시 떴다.

## 동시 수정 구멍 — 같은 날 닫음

설계 §6 대로 `@Version` 을 걸었지만 그것만으로는 부족했다. Next 의 **전체 애그리거트 upsert 는 지우고
새로 넣으므로 버전 비교를 지나간다.** 챔피언 확정·봉투 충전·복구 같은 편집이 그 경로였다 — 사람이
누르는 순간과 폴러 틱이 겹치면 폴러가 방금 쓴 라운드가 통째로 사라진다.

**진짜 원인은 락이 아니라 스냅샷이었다.** 화면이 들고 있던 옛 애그리거트를 통째로 다시 올리는 한,
락을 어떻게 걸어도 그 사이 벌어진 일이 지워진다.

`POST /internal/tournaments/{id}/edit?action=…` 을 만들어 여섯 편집을 옮겼다. Spring 이 한 트랜잭션
안에서 읽고 필요한 필드만 고쳐 저장한다. `/internal/tournaments` 의 upsert 는 **생성 전용**으로 남는다.

Postgres 통합 테스트 둘이 이걸 지킨다.

| 테스트 | 확인하는 것 |
|---|---|
| `편집과_결산이_겹쳐도_둘_다_남는다` | 새 경로 — 사용자 충전과 폴러 결산이 함께 남는다 |
| `애그리거트를_통째로_다시_올리면_결산이_사라진다` | 옛 경로 재현 — 라운드가 통째로 사라진다 |

두 번째는 통과하는 것이 정상이다. upsert 를 편집에 다시 쓰면 안 된다는 근거를 코드로 남겨둔 것이다.

`server-runner.ts` 는 이제 **생성과 Gemini 카피 뽑기만** 한다(105줄).

## 확인하지 못한 것

- **실 Meta 게재·조회를 한 번도 돌리지 못했다.** Facebook 로그인과 실 광고 계정이 필요하다. 골든
  픽스처는 "TS 와 같다"를 증명하지 그 TS 가 맞다는 것을 증명하지 않는다 — 다만 그쪽은 실전 검증됐다.
- **Gemini 역위임을 라이브로 태우지 못했다.** 유료 호출이라 스모크에서 뺐다. 인증 경계와 파라미터
  전달은 라우트 테스트가 덮는다.
