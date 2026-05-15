# PRD — 광고 만들기 고도화: 간단/디테일 모드 + 6개 캠페인 목표

> **한 줄 요약**: 현재 "트래픽 캠페인 전용 + 입력 흐름 1개"인 `/create` 페이지를 (1) 마케터 페르소나에 맞춘 간단/디테일 두 탭으로 분기하고 (2) Meta Ads Manager의 6개 캠페인 목표(인지도·트래픽·참여·잠재고객·앱홍보·판매)를 단계적으로 도입한다. **본 PRD = Phase 1**: 모드 분기 framework 완성 + 가벼운 3개 목표(인지도·트래픽·참여) 완전 동작. 무거운 3개(잠재고객·판매·앱홍보)는 디테일 탭에 "곧 열려요" 칩으로 자리만 잡고 Phase 2 후속 PRD에서 각각 별도 기획.

- 문서 버전: v0.1 (grill 결정 Q1~Q7 기반 초안)
- 작성일: 2026-05-13
- 상태: 핵심 product 결정 7건 완료. 디자인은 현재 디자인 시스템(`.adflow` + `app/_design/*`)·기존 화면(`/connect`, `/campaigns`, `LaunchStep`)을 레퍼런스로 직접 코드 작성. **별도 design-prompt 문서는 만들지 않음.**
- 선행/관련: `docs/PRD.md`(사이드바 IA·디자인시스템 이관), `.document/PRD-ad-publish-flow.md`(현재 `/create` 흐름 기반선), `lib/optimization.ts`(최적화 제안 엔진 — 본 PRD에서 목표별 분기 필요)

---

## 1. 배경 & 목적

### 1.1 지금 상태
- `/create`는 3스텝: ① 소재 만들기(브랜드·타겟·목적 입력 → Gemini가 헤드라인·본문·타겟팅 생성) → ② 광고 집행(예산·기간·연령·성별·국가·게재 상태 → Meta API) → ③ 성과 확인.
- 캠페인 목표는 `LaunchStep`의 `SummaryCard`에서 **하드코딩 "트래픽"**. 게재 위치는 Advantage+ LOCKED. 입력 흐름은 페르소나 구분 없는 단일 폼.
- Meta Insights API(`/api/insights/[id]`)도 트래픽 KPI(노출·클릭·CTR·지출) 위주.

### 1.2 왜 고도화하나
1. **마케터 페르소나가 두 갈래로 갈림** — "최소 입력으로 빨리 돌리고 싶다" 형과 "디테일하게 뾰족하게 운영하고 싶다" 형. 단일 폼은 둘 다에게 어중간하다.
2. **트래픽 캠페인 전용 도구**라서 사용처가 좁다. 인지도·참여·잠재고객·판매 광고를 만들고 싶으면 결국 Meta Ads Manager로 가야 한다 → AdFlow의 "AI 광고 자동화" 가치 침식.
3. Meta Ads Manager 자체가 6개 목표 ODAX 체계로 통일된 지 오래라, 마케터 멘탈모델과 우리 UI가 어긋난다.

### 1.3 두 페르소나
| 페르소나 | 특징 | 우리가 줘야 할 것 |
| --- | --- | --- |
| **빠른 집행 마케터** | 처음 광고 해보거나, 시간이 없거나, 최소 입력으로 일단 돌려보고 싶음. 캠페인 목표 개념을 정확히 모를 수 있음 | 자연어/outcome 칩 한 번에 의도 캡처 → AI가 알아서 처리. 입력 항목 ≤ 5개 |
| **뾰족한 운영 마케터** | Meta Ads Manager 경험 있음. 캠페인 목표·입찰·맞춤 타겟·플레이스먼트를 본인이 정하고 싶음 | Meta 풀카피는 아니어도 의미있는 디테일 큐레이션 + AI 추천 보강 |

---

## 2. 목표 / 비목표

### 2.1 Phase 1 목표 (본 PRD 출시 범위)
1. `/create` STEP 02 안에 **간단/디테일 두 탭** UX 도입. 자유 전환, 디테일→간단 전환만 데이터 손실 confirm.
2. **간단 탭** — 현재 폼과 본질 동일하되 "캠페인 목표" 칸은 노출하지 않음. AI 자동 매핑(기본 트래픽).
3. **디테일 탭** — 6개 캠페인 목표 노출. Phase 1 3개(**인지도·트래픽·참여**)는 완전 동작. Phase 2 3개(**잠재고객·판매·앱홍보**)는 "곧 열려요" 칩 + 알림받기.
4. **STEP 01 소재 만들기** — "이 광고로 뭘 이루고 싶나" outcome 입력(칩 3개 + 자연어 보조) 추가. AI가 (a) Meta 목표 매핑 (b) 카피 톤을 둘 다 결정.
5. **디테일 탭 큐레이션 노브 5개**: 입찰 전략(AI 추천), 맞춤 타겟+lookalike, 플레이스먼트 자동/수동 토글, 일정+자동 되돌림, A/B 소재(헤드라인 변형).
6. **STEP 03 성과 확인** — 목표별 KPI·차트·최적화 제안 완전 분기 (Phase 1 3개 목표만).
7. 기존 트래픽 흐름은 회귀 없음 — 모든 기존 캠페인 동작 보존.

### 2.2 Phase 1 비목표 (본 PRD 범위 밖)
- ❌ 잠재고객 목표의 **리드 폼 빌더 / 리드 webhook 수집** — 별도 Phase 2 PRD(`PRD-objective-leads.md`)
- ❌ 판매 목표의 **Meta Pixel 연동 + 전환 이벤트 매핑** — 별도 Phase 2 PRD(`PRD-objective-sales.md`)
- ❌ 앱 홍보 목표의 **앱 등록 + SDK 연동** — 별도 Phase 2 PRD(`PRD-objective-app-promotion.md`)
- ❌ Meta Ads Manager의 모든 노브(빈도 상한, dayparting, 광고세트 다단 테스트, 동적 소재 등) — "큐레이션" 원칙. 자잘한 건 Meta에서.
- ❌ 모드 선택을 **사이드바·진입 단계**로 끌어올리기 — STEP 02 내부 토글로만.
- ❌ "둘러보기" 모드 사용자의 디테일 탭 차단 — 둘 다 허용(어차피 집행 시 차단되니).
- ❌ 모바일 반응형 — 데스크톱 1440 기준.

---

## 3. 페르소나 × 모드 매핑

```
빠른 집행 마케터  →  STEP 01 outcome 칩 + 본문 → AI 자동 → STEP 02 간단 탭 → 집행
뾰족 운영 마케터  →  STEP 01 outcome 칩 + 본문 → AI 자동 → STEP 02 디테일 탭 → 미세조정 → 집행
```

- STEP 01은 두 페르소나가 **공통**. AI가 outcome을 보고 캠페인 목표·카피를 동시에 결정.
- STEP 02 진입 시 **간단/디테일 탭 토글**로 분기. 디테일에서 캠페인 목표를 명시 변경 가능(AI 추천을 기본값으로).
- 기본 진입 = **간단 탭** (첫 인상 = "쉬워 보임").

---

## 4. 화면 1 — STEP 01 (소재 만들기) 변경

### 4.1 현재 → 변경 후
현재: 브랜드 / 누구에게 / 무엇을 + 톤 칩 → Gemini 카피 생성.

변경: 그 앞에 "**이 광고로 뭘 이루고 싶나요?**" 한 필드 추가.

### 4.2 outcome 입력 UI
- **outcome 칩 (라디오, 단일 선택, 필수)** — Phase 1 = 3개
- **자연어 보조 입력 (선택)** — 한 줄짜리 input, "추가로 알려주세요"

#### 4.2.1 outcome 칩 (Phase 1 = 3개)
| 라벨 | Meta 목표 | 카피 톤 가이드 |
| --- | --- | --- |
| 더 많은 사이트 방문 | `OUTCOME_TRAFFIC` | 클릭 유도·urgency·CTA 강조 |
| 더 많은 게시물 반응 | `OUTCOME_ENGAGEMENT` | 공감·질문·해시태그·대화형 |
| 인지도 넓히기 | `OUTCOME_AWARENESS` | 브랜드 약속·메모러블·짧고 강한 헤드라인 |

> 매출·가입자·앱 설치 칩은 Phase 2 출시 시 추가. Phase 1엔 안 보임 (Q5 결정).

#### 4.2.2 자연어 보조 입력
- 라벨: "추가로 알려주세요 (선택)"
- placeholder 예: "5월 신상 한정 할인 강조하고 싶어요"
- AI 프롬프트에 그대로 부어 카피 톤 미세조정 — **목표 매핑엔 영향 없음**(칩이 결정).

### 4.3 AI 매핑 규칙 (server)
1. outcome 칩 → 위 표대로 1:1 매핑.
2. 자연어 보조 = 카피 톤·헤드라인 변형에만 영향.
3. 매핑 결과 = `creativeState.objective` (state 보존, STEP 02 기본값으로 전파).
4. 칩 미선택 시 STEP 01 완료 불가(=다음 버튼 비활성). 매핑 실패 케이스 0건.

### 4.4 카피 생성 프롬프트 변경
`useGenerateCreative`(`app/_hooks/useGenerateCreative.ts` → `/api/generate-creative`)에 두 파라미터 추가:
```ts
generateMutation.mutate({ brand, target, goal, tone, outcome, objective, hint })
```
Gemini 프롬프트는 `objective`에 따라 "클릭 유도" / "공감 유도" / "브랜드 약속" 세 톤을 가르는 한 단락을 시스템 메시지에 추가. `hint`(자연어 보조)는 user 메시지에 그대로.

---

## 5. 화면 2 — STEP 02 (광고 집행) 분기

### 5.1 모드 토글
STEP 02 진입 시 상단에 세그먼티드 토글:
```
[간단 설정]  [디테일 설정]
```
기본 = **간단**. 단 STEP 01 outcome이 트래픽 외(인지도·참여)로 매핑되면 디테일 탭이 자동 선택돼서 진입(목표가 노출돼야 마케터가 안심).

### 5.2 전환 정책 (Q6)
- **간단 → 디테일**: 자유. 간단의 모든 입력값은 디테일에 그대로 노출. 디테일 전용 필드는 AI 추천 기본값으로 채워짐.
- **디테일 → 간단**: **confirm 다이얼로그**:
  > ⚠ 간단으로 가면 아래 입력이 사라져요.
  > • 입찰 전략 · "대상 비용"
  > • 맞춤 타겟 · "재방문자 …"
  > • A/B 소재 테스트
  > [간단으로 이동] [취소]
  
  동의 시 디테일 전용 입력은 state에서 폐기.
- 같은 광고 만들기 세션 동안 자유 전환 가능. STEP 이동(02→03 또는 02→01)해도 모드 선택은 유지.

### 5.3 간단 탭 (= 현재 `LaunchStep` 거의 그대로)

필드(현재 그대로):
- 광고 소재 미리보기(STEP 01 출력 자동) + 이미지 업로드
- 랜딩 페이지 URL (https://)
- 일일 예산
- 집행 기간
- 타겟 (연령 슬라이더, 성별, 국가) — STEP 01 AI 자동 채움 기본값
- **광고 플랫폼** — 페이스북·인스타그램(권장) / 페이스북만 / 인스타그램만 (3택 칩). 기존 "게재 위치 LOCKED" 블록을 대체. 선택한 플랫폼 안에선 Advantage+ 자동 배치 안내 표시.
- 게재 상태 (일시중지 / 지금 바로)

차이점:
- **캠페인 목표는 안 보임**. SummaryCard의 "캠페인 목표" 행은 `AI 매핑 결과(보통 트래픽)` 한 줄 + 옆에 작은 "변경하려면 디테일 →" 링크.
- 집행 버튼 동작은 현재와 동일하되 `objective`·`platforms` 파라미터를 `creativeState`에서 전달.

### 5.4 디테일 탭 — 큐레이션된 디테일 (Q3·Q4)

#### 5.4.1 6개 캠페인 목표 라디오 칩 (최상단)
| 라벨 | 상태 | 클릭 동작 |
| --- | --- | --- |
| 인지도 | Phase 1 | 선택 → 폼 적용 |
| 트래픽 | Phase 1 (기본) | 선택 → 폼 적용 |
| 참여 | Phase 1 | 선택 → 폼 적용 |
| 잠재고객 | **Phase 2** | "곧 열려요" 카드 + [알림받기] |
| 앱 홍보 | **Phase 2** | "곧 열려요" 카드 + [알림받기] |
| 판매 | **Phase 2** | "곧 열려요" 카드 + [알림받기] |

**"곧 열려요" 카드 디자인**:
- `.adflow .card` + `Badge kind="violet"`("Coming Soon")
- 한 줄 설명: "이 목표 광고는 곧 열려요. <Pixel 연동 · 리드 폼 빌더 · 앱 등록> 중 필요한 게 있어요."
- 이메일 입력 한 줄 + [알림받기] 버튼 — MVP는 console.log + 토스트(실 알림 채널은 별도 작업)

**카피 부합성 경고**: 디테일에서 선택한 목표가 STEP 01 매핑 결과와 다르면 상단에 노란 callout:
> ⚠ AI가 추천한 목표는 '트래픽'이었어요. 변경하면 카피 톤이 안 맞을 수 있어요.
> [STEP 01에서 카피 다시 만들기 →]

#### 5.4.2 큐레이션 노브 5개

각 노브는 카드 하나. AI 추천 행 + 펼침/접힘 토글로 수동 입력. 펼침 컴포넌트는 `app/(workspace)/connect/page.tsx`의 `PermissionsDisclosure` 패턴 재사용.

**(1) 입찰 전략**
- 라벨: "어떻게 입찰할까요?"
- 옵션 (한국어 라벨 → Meta API enum):
  - **최저 비용** → `LOWEST_COST_WITHOUT_CAP` — 기본 AI 추천
  - **대상 비용** → `LOWEST_COST_WITH_BID_CAP` — 펼침 시 bid cap KRW 인풋
  - **목표 단가** → `COST_CAP` — 펼침 시 cost cap KRW 인풋
- AI 추천 행: "AI: 첫 캠페인엔 **최저 비용**이 안전해요. 노출이 빠르게 시작돼요."

**(2) 맞춤 타겟 + lookalike**
- 두 섹션:
  - **맞춤 타겟(custom audience)**: Meta에서 가져온 audience 목록 셀렉트. Phase 1 = 기존 audience만 선택 (새로 만들기는 외부 Meta 광고 관리자 링크).
  - **유사 타겟(lookalike)**: 위 audience 기준 한국 1·3·5% lookalike 자동 생성 토글. Phase 1 동작 범위는 **미정 #1** 참조.

**(3) 광고 플랫폼 + 세부 위치(플레이스먼트)** — 두 단 분리
- **광고 플랫폼**: 페이스북·인스타그램 / 페이스북만 / 인스타그램만 (간단 탭과 공유 state `platforms`)
- **세부 위치**:
  - **자동(Advantage+)** — 기본
  - **수동** — 펼침 시 위치 칩: Facebook 피드 / IG 피드 / IG 스토리 / Audience Network / Messenger. **광고 플랫폼 picker에 안 들어간 채널의 위치 칩은 비활성**(클릭 시 hint "광고 플랫폼에서 해당 채널을 먼저 선택해 주세요"). 광고 플랫폼을 좁히면 그와 충돌하는 기존 수동 위치는 자동 정리.
- AI 추천: "자동을 권해요. 보통 자동이 CPM이 더 낮아요."

**(4) 일정 + 자동 되돌림**
- 시작·종료 날짜 (간단 탭과 동일)
- 추가: "광고가 안 좋게 흘러가면 자동 되돌림" 토글 (기본 OFF)
  - 정의: 첫 3일 동안 CPM이 광고 계정 평균 대비 2배 넘으면 자동 일시정지
  - Phase 1 동작 범위는 **미정 #2** 참조

**(5) A/B 소재 시험**
- 라벨: "헤드라인 두 개로 시험할게요"
- 토글 ON 시 STEP 01에서 Gemini가 만든 헤드라인 후보 중 2개를 자동 선택해서 Meta에 두 개의 광고로 등록 (같은 캠페인 / 같은 광고세트 / 다른 광고)
- 7일 후 우세한 쪽 자동 안내(읽기만, 자동 일시정지는 안 함)
- 기본 OFF
- Phase 1 동작 범위는 **미정 #3** 참조

#### 5.4.3 디테일 탭 SummaryCard 추가 행
간단 SummaryCard 골격에 다음 행 추가:
- 캠페인 목표 (라벨 + Meta enum 작게)
- 입찰 전략
- 플레이스먼트 (`자동` / `수동 N곳`)
- A/B 시험 (`켜짐` / `꺼짐`)
- 자동 되돌림 (`켜짐` / `꺼짐`)

### 5.5 캠페인 생성 API 페이로드 확장
`useLaunchCampaign` → `/api/campaign/launch` 페이로드:
```ts
{
  // 기존
  headline, primaryText, dailyBudget, startDate, endDate,
  ageMin, ageMax, genders, countries, linkUrl, cta, status, imageDataUrl,

  // 추가 (공통)
  objective: "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT",
  mode: "simple" | "detailed",
  platforms: "both" | "facebook" | "instagram",  // 간단·디테일 공통, Meta `publisher_platforms` 매핑

  // 디테일 모드에서만 (optional)
  bidStrategy?: "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP",
  bidAmount?: number,        // KRW, cap 옵션일 때
  customAudienceIds?: string[],
  lookalike?: { fromAudienceId: string; percent: 1 | 3 | 5 } | null,
  placements?: { mode: "auto" } | { mode: "manual"; positions: string[] },
  autoPauseGuardrail?: boolean,
  abTestHeadlines?: string[],  // 2개 (켜진 경우만)
}
```

서버 측 Meta API 호출 분기:
| outcome (입력) | `Campaign.objective` | `AdSet.optimization_goal` | default `billing_event` |
| --- | --- | --- | --- |
| traffic | `OUTCOME_TRAFFIC` | `LINK_CLICKS` | `LINK_CLICKS` |
| engagement | `OUTCOME_ENGAGEMENT` | `POST_ENGAGEMENT` | `IMPRESSIONS` |
| awareness | `OUTCOME_AWARENESS` | `REACH` | `IMPRESSIONS` |

---

## 6. 화면 3 — STEP 03 (성과 확인) 분기 (Q7)

### 6.1 목표별 KPI 정의 (Phase 1)
| 목표 | KPI 카드 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| **인지도** | 도달 (reach) | 빈도 (frequency) | CPM | 총 노출 (impressions) |
| **트래픽** | 노출 | 클릭 | CTR | 지출 (현재와 동일) |
| **참여** | 반응 (post engagement) | 댓글 | 공유 | 페이지 좋아요 증가 |

추가:
- **인지도**: 차트 = 일별 도달·CPM 듀얼. 일별 표 컬럼 = 날짜·도달·빈도·CPM·지출.
- **트래픽**: 현재 그대로 (차트 = 클릭/CTR, 표 = 날짜·클릭·CTR·지출·전일대비 CTR).
- **참여**: 차트 = 일별 반응·댓글 듀얼. 표 = 날짜·반응·댓글·공유·지출.

### 6.2 Meta Insights API 호출 분기 (`/api/insights/[id]`)
현재는 트래픽 metric만 fetch. 목표별로 fields 분기:
```ts
const fieldsByObjective = {
  OUTCOME_TRAFFIC:    ["impressions","clicks","ctr","spend","cpc","reach"],
  OUTCOME_AWARENESS:  ["reach","frequency","cpm","impressions","spend"],
  OUTCOME_ENGAGEMENT: ["actions","post_engagement","page_engagement","spend","impressions"],
};
```
- `actions`는 Meta가 배열로 주는 액션 분류 — `post_reaction` / `comment` / `post_share` 추출 유틸 필요.
- 캠페인 객체에서 `objective`를 가져오려면 캠페인 메타도 함께 fetch — 현재 미사용일 수 있음, 코드 작성 시 확인.

### 6.3 최적화 제안 분기 (`lib/optimization.ts`)
현재 `suggestOptimizations`는 CTR 기준의 트래픽 룰만 있음. 함수 시그니처를 `objective` 받게 확장하고 룰을 목표별로 분기:
- **인지도**: 도달 정체 / 빈도 과다 / CPM 과다 → 일시정지·예산조정·새 소재
- **트래픽**: 현재 룰 그대로 (CTR/CPC 기준)
- **참여**: 반응율(반응/노출) 부진 / 댓글 0 → 일시정지·새 소재

`assessAutomationReadiness`도 목표별 임계치 따로:
- 인지도: 노출 ≥ X, 도달 ≥ Y, 일수 ≥ 3
- 트래픽: 현재 그대로
- 참여: 반응 ≥ X, 일수 ≥ 3

### 6.4 campaignBar / SummaryCard 라벨
"이 광고의 목표: 인지도 / 트래픽 / 참여" 라벨을 캠페인 헤더에 `Badge kind="violet"`로 추가.

### 6.5 디테일 모드 캠페인 표시
디테일에서 만든 캠페인은 KPI 패널 옆에 작게:
- 입찰 전략 라벨
- 플레이스먼트 (자동/수동 N곳)
- A/B 시험 켜짐(켜졌으면)

---

## 7. 데이터/상태 모델

### 7.1 `CreativeProvider` 확장 (`app/_components/CreativeProvider.tsx`)
```ts
type CreativeState = {
  // 기존
  tone, primaryText, cta, headline, targeting, generatedImages?, launchedCampaign?,

  // 추가
  outcomeChip: "traffic" | "engagement" | "awareness" | null,  // 칩 선택
  outcomeHint: string,                                          // 자연어 보조
  objective: "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | null,  // 매핑 결과

  // STEP 02 디테일 전용
  mode: "simple" | "detailed",
  bidStrategy?: "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP",
  bidAmount?: number,
  customAudienceIds?: string[],
  lookalike?: { fromAudienceId: string; percent: 1 | 3 | 5 } | null,
  placements?: { mode: "auto" } | { mode: "manual"; positions: string[] },
  autoPauseGuardrail?: boolean,
  abTestEnabled?: boolean,
};
```

신규 액션:
- `SET_OUTCOME_CHIP`
- `SET_OUTCOME_HINT`
- `SET_OBJECTIVE` (AI 매핑 결과 또는 디테일에서 수동 변경)
- `SET_MODE`
- `SET_BID_STRATEGY`, `SET_BID_AMOUNT`
- `SET_CUSTOM_AUDIENCES`, `SET_LOOKALIKE`
- `SET_PLACEMENTS`
- `SET_AUTO_PAUSE_GUARDRAIL`
- `SET_AB_TEST_ENABLED`
- `RESET_DETAIL_FIELDS` (디테일 → 간단 confirm 후 호출)

### 7.2 Meta 캠페인 객체 매핑 (서버측)
5.5 페이로드 → Meta API 매핑 테이블 그대로 적용. `Campaign` 객체에 `objective` 저장 후 `AdSet` 만들 때 `optimization_goal` 결정.

---

## 8. 디자인 / UI 가이드

- **디자인 토대**:
  - 토큰: `app/styles/design-system.css`
  - 컴포넌트: `app/styles/adflow.css`
  - React 프리미티브: `app/_design/*` (Icon, Badge, KpiCard, Sparkline, AgeRange, DualChart, format)
- **레퍼런스 페이지**:
  - 모드 토글 = `.seg` 패턴 (이미 `LaunchStep`에서 게재 상태 토글로 쓰임)
  - 6개 목표 칩 = `.chip` / `.chip--on` 패턴 (`LaunchStep`의 성별 칩과 동일)
  - "곧 열려요" Phase 2 카드 = `.card` + `Badge kind="violet"` + 이메일 입력 (`/connect`의 alert-bar 톤 참고)
  - 디테일 큐레이션 노브 5개 = 각 노브가 `.card`. 펼침/접힘은 `app/(workspace)/connect/page.tsx`의 `PermissionsDisclosure` 컴포넌트 패턴
  - confirm 다이얼로그(디테일→간단) = `app/(workspace)/connect/page.tsx`의 `ConfirmModal` 컴포넌트 재사용
  - 노란 callout(카피 부합성 경고) = `.callout.callout--warn`
- **별도 design-prompt 문서·시안 없음.** 직접 코드 작성하면서 레퍼런스에 어긋나면 본 PRD § 11(미정)에 항목 추가 후 다시 정리.

---

## 9. 영향 받는 코드 영역

| 영역 | 변경 |
| --- | --- |
| `app/(workspace)/create/page.tsx` | outcome 입력 UI 연동, `mode` 토글 상태, `CreativeProvider` 확장 dispatch, AI 매핑 결과 `objective` 전파 |
| `app/(workspace)/create/_components/CreativeStep.tsx` | outcome 칩 + 자연어 보조 입력 추가, 칩 미선택 시 다음 버튼 비활성 |
| `app/(workspace)/create/_components/LaunchStep.tsx` | 모드 토글, 간단/디테일 분기 렌더, 디테일 큐레이션 노브 5개 카드, confirm 다이얼로그 호출, SummaryCard 행 추가 |
| `app/(workspace)/create/_components/PerformanceStep.tsx` | 목표별 KPI 카드/차트/표 분기. 트래픽 외 KPI는 새 컴포넌트 신설 또는 분기 |
| `app/_components/CreativeProvider.tsx` | state 타입 확장, reducer 액션 추가 (§ 7.1) |
| `app/_hooks/useGenerateCreative.ts` | `objective`·`hint` 파라미터 |
| `app/api/generate-creative/route.ts` | Gemini 프롬프트 목표별 분기 |
| `app/_hooks/useLaunchCampaign.ts` | 페이로드 확장 (§ 5.5) |
| `app/api/campaign/launch/route.ts` (또는 등가 위치) | Meta API 호출 분기 — 목표·입찰·플레이스먼트·맞춤 audience·A/B(켜진 경우 두 광고 생성) |
| `app/api/insights/[id]/route.ts` | 목표별 fields, `actions` 파싱 유틸 |
| `lib/optimization.ts` | 목표별 룰 분기, readiness 분기 |
| `lib/creative-options.ts` | outcome 칩 정의, 목표↔카피톤 매핑 |
| `app/styles/adflow.css` | 신규 클래스가 필요한 경우(예: 디테일 노브 카드 디스클로저) — 최소화. 가능하면 기존 `.card` + `.callout` 재사용 |

---

## 10. Phase 2 후속 PRD 예고

각 Phase 2 목표마다 별도 PRD(이번 grill 결과대로):
- **`PRD-objective-leads.md`** — 잠재고객. Meta Lead Generation Form 정의, 개인정보처리방침 URL, 리드 webhook 수집·저장 모델.
- **`PRD-objective-sales.md`** — 판매. Meta Pixel 연동 확인 UX, 전환 이벤트 매핑 픽커, 자동 카탈로그(데이터셋) 연결.
- **`PRD-objective-app-promotion.md`** — 앱 홍보. 앱 ID 입력·검증, 외부 SDK 가이드 안내.

각 PRD는 본 PRD의 "곧 열려요" 칩이 활성화되는 시점에 작성·구현.

---

## 11. 결정 사항 (2026-05-13 grill 마무리에서 모두 확정)

| # | 항목 | 결정 |
| --- | --- | --- |
| 1 | lookalike(유사 타겟) — Phase 1 동작 깊이 | **UI만** — 디테일 탭에 섹션 노출, 토글 ON 시 토스트/안내 "유사 타겟 자동 생성은 곧 적용돼요". 서버 페이로드에는 포함하지 않음 |
| 2 | 자동 되돌림 guardrail — Phase 1 동작 깊이 | **UI 옵션만** — 디테일 탭 일정 섹션에 토글 노출, ON 시 안내 "자동 되돌림은 곧 연동돼요". 실 체크·일시정지 로직은 후속(axhub cron 없음, 별도 처리) |
| 3 | A/B 소재 시험 — Phase 1 동작 깊이 | **UI 토글만** — 디테일 탭에 토글 노출, ON 시 안내 "두 개 소재 시험은 곧 연동돼요". 서버에선 단일 광고만 생성 |
| 4 | 칩 미선택 시 STEP 01 진행 차단 | **차단** — outcome 칩 미선택 시 "AI 카피 생성" 버튼 비활성 |
| 5 | 모드 토글 위치 | **카드 상단 세그먼티드** — LaunchStep의 광고 집행 카드 최상단 `.seg` |
| 6 | 디테일에서 목표 변경 → STEP 01 카피 재생성 | **"다시 만들기" 버튼만 노출** — 자동 재생성 없음, 유저가 명시 클릭. 노란 callout에 STEP 01 이동 링크

---

## 12. 검수 체크리스트

이 PRD가 출시됐다고 보려면:
- [ ] 간단 탭에서 처음부터 끝까지 광고 1개 만들 수 있음 (현재 트래픽 흐름과 결과 동일)
- [ ] 디테일 탭에서 인지도·트래픽·참여 각각 광고 1개 만들 수 있음 (Meta에 캠페인 정상 생성)
- [ ] 디테일 탭의 Phase 2 칩(잠재고객·판매·앱홍보)은 "곧 열려요" 카드 + 알림받기로 동작
- [ ] STEP 01 outcome 칩 선택 시 STEP 02에 그 목표가 기본값으로 전파됨
- [ ] 디테일 → 간단 전환 시 confirm 다이얼로그 + 디테일 입력 데이터 폐기 정상
- [ ] STEP 03에서 목표에 맞는 KPI 카드·차트·표가 표시됨 (3가지 목표 각각)
- [ ] 최적화 제안이 목표별로 다른 룰을 적용함
- [ ] 기존 트래픽 캠페인의 성과 페이지가 회귀 없음
- [ ] `tsc --noEmit` / `eslint .` 통과
