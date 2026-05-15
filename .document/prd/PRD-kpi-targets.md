# PRD — 성과 보고 KPI 목표(목표 대비 실적) 사후 비교

> **한 줄 요약**: STEP 03 성과 확인 페이지에 "이 캠페인의 KPI 목표(예: CTR≥2%, CPC≤₩800)"를 사후로 입력받고, 현재 성과와 비교한 **진행률 막대 + 색상 신호등**을 보여준다. 입력값은 캠페인 ID별로 localStorage에 영구 저장. AI가 `lib/optimization` 임계치 기반으로 추천 디폴트값을 미리 채워줘서 사용자 마찰을 최소화. 목표 미달이면 기존 "최적화 제안" 카드의 본문이 사용자 목표값을 인용하도록 연동. **STEP 01·02는 손대지 않음.** Phase 1 KPI 풀 = 트래픽(CTR·CPC) / 인지도(CPM·도달·빈도) / 참여(참여율·반응 수).

- 문서 버전: v0.1 (grill 결정 Q1~Q7 기반 초안)
- 작성일: 2026-05-13
- 상태: 핵심 product 결정 7건 완료. 디자인은 현재 디자인 시스템(`.adflow` + `app/_design/*`)과 PerformanceStep의 기존 KPI 카드 패턴(KpiCard) 레퍼런스로 직접 코드 작성. 별도 design-prompt 문서 없음.
- 선행/관련: `.document/prd/PRD-create-modes-and-objectives.md`(STEP 03 목표별 KPI 분기 — 본 PRD는 그 위에 사용자 목표값 한 층 추가), `lib/optimization.ts`(추천 디폴트값 + 미달 시 인용 출처), `app/_design/library.ts`(`useLibrary` localStorage 패턴 레퍼런스).

---

## 1. 배경 & 목적

### 1.1 지금 상태
- STEP 03 PerformanceStep은 캠페인 목표별 KPI 4개 카드를 보여줘요 (방금 도입). 하지만 **"내가 정한 목표 대비 어떻게 달성됐는지"** 는 안 보여줘요 — 현재 수치만 띄움.
- 마케터 멘탈모델: "이 캠페인 CTR을 2%까지", "CPC ₩800 아래로" 같은 정량 목표가 있는데, AdFlow엔 그걸 입력·추적할 곳이 없음.
- 결과적으로 성과 페이지를 "회고용"으로만 쓸 수 있고, "목표 대비 어디까지 왔나" 판단이 불가.

### 1.2 왜 필요한가
1. **목표 대비 실적** 이 광고 운영의 가장 기본 질문. KPI 목표 없이 현재 수치만 보면 "잘 되는 건지 안 되는 건지" 판단 어려움.
2. AdFlow의 기존 최적화 제안 카드는 *일반 광고 평균*(트래픽 평균 CTR ~1~2%) 기준으로 메시지를 만들어요. 마케터가 자기 목표를 알면 *그 목표 기준*으로 제안을 받는 게 훨씬 행동 가능(actionable).

### 1.3 캠페인 목표 vs KPI 목표 (용어 명확화)
| 개념 | 무엇 | 예 | 어디 |
| --- | --- | --- | --- |
| **캠페인 목표(Campaign Objective)** | Meta enum, 정성적 라벨 | OUTCOME_TRAFFIC / OUTCOME_AWARENESS / OUTCOME_ENGAGEMENT | STEP 01 outcome 칩 · STEP 02 디테일 탭 칩 (기존) |
| **KPI 목표(Target)** | 정량 숫자 | "CTR≥2.0%", "CPC≤₩800", "도달≥100,000" | **본 PRD 신설 — STEP 03에서만** |

두 개념은 **보완 관계**. 캠페인 목표가 KPI 목표의 풀(어떤 KPI를 고를 수 있나)을 정함.

---

## 2. 목표 / 비목표

### 2.1 Phase 1 목표 (본 PRD 출시 범위)
1. STEP 03 PerformanceStep 첫 진입 시 **"KPI 목표 잡아보세요"** 카드 노출 (이미 저장된 목표 있으면 진행률 카드로 바로).
2. 입력 UI: 캠페인 목표에 맞춰 자동 좁힌 KPI 풀 (Q2), 여러 개 체크박스 선택 (Q3), 입력값 AI 추천 디폴트로 자동 채움 (Q4), 수정·삭제 자유.
3. 저장: **localStorage 영구**, 캠페인 ID별 키 (Q5).
4. 진행률 표시: **막대 + 색상 신호등** (Q6, 녹/주/적). 각 KPI 카드 따로.
5. **`lib/optimization` 연동** (Q7): 사용자가 KPI 목표를 입력했고 그 KPI가 lib/optimization 룰이 다루는 종류면, 제안 본문에 사용자 목표값 인용.
6. 기능 회귀 없음 — 기존 KPI 카드·차트·일별 표·최적화 제안 카드 전부 그대로 + 위에 한 층 추가.

### 2.2 Phase 1 비목표 (본 PRD 범위 밖)
- ❌ STEP 01·STEP 02 흐름에 영향 (AI 카피·집행 설정이 KPI 목표를 노려서 생성·조정 — Q1 결정으로 명시 제외).
- ❌ ROAS / CPA / CVR — 전환 이벤트(Pixel) 필요. 판매·잠재고객 캠페인(Phase 2 PRD)에서 다룸.
- ❌ DB 영구 / 팀 공유 — localStorage 한정 (디바이스·계정 간 안 옮겨감). 팀 공유는 후속.
- ❌ KPI 목표 입력 강제 / dismiss — 디스미스 모달 UX는 디자인 단계에서 결정(미정 #1).
- ❌ 진행률 추세(↑·→·↓) 화살표 — 미시 결정 후속 (현재는 막대 + 색상만).
- ❌ 캠페인 단위 외 — 워크스페이스 전역 KPI 기본값 / 사용자 프로필 기본값 등은 후속.

---

## 3. IA · 진입

- **단일 진입점**: STEP 03 PerformanceStep 화면.
- **실제 캠페인 진입 시**:
  - localStorage 에 `kpi-target:<campaignId>` 키가 있으면 → 진행률 카드 바로 표시
  - 없으면 → "KPI 목표 잡아보세요" 입력 카드 표시 (AI 추천값 자동 채움)
- **예시 모드(launched 없음) 진입 시**: 예시 데이터에 맞는 가상의 목표값을 인-메모리로 채워서 진행률 카드 UI 미리보기. localStorage 저장 안 함. (사용자에게 "이 기능 이렇게 생겼어요" 데모용)

---

## 4. KPI 풀 — 캠페인 목표별 자동 좁힘 (Q2)

| 캠페인 목표 | 가능한 KPI (Phase 1) | 추천 KPI (디폴트 체크) |
| --- | --- | --- |
| **OUTCOME_TRAFFIC** (트래픽) | CTR, CPC, 노출 수, 클릭 수 | **CTR, CPC** |
| **OUTCOME_AWARENESS** (인지도) | CPM, 도달, 빈도, 노출 수 | **CPM, 도달, 빈도** |
| **OUTCOME_ENGAGEMENT** (참여) | 참여율(반응/노출), 반응 수, 댓글 수, 공유 수 | **참여율, 반응 수** |

> ROAS / CPA / CVR 은 **Phase 2 캠페인 목표**(판매·잠재고객)와 함께 출시. 본 PRD의 UI 에는 노출하지 않음 (캠페인 목표 자체가 Phase 2 라서 캠페인 자체가 없음).

---

## 5. AI 추천 디폴트값 (Q4)

### 5.1 산출 규칙 — `lib/optimization.ts` 의 임계치 그대로
| KPI | 비교 방향 | 추천 디폴트 | 근거 (lib/optimization) |
| --- | --- | --- | --- |
| CTR | ≥ | **2.0%** | `GOOD_CTR_PCT = 2.0` (호조 기준) |
| CPC | ≤ | **₩2,000** | `HIGH_CPC_KRW = 2000` (비효율 경계) |
| CPM | ≤ | **₩8,000** | `HIGH_CPM_KRW = 8000` (비싸 경계) |
| 빈도 | ≤ | **3.0회** | `HIGH_FREQUENCY = 3.0` (피로 경계) |
| 참여율 | ≥ | **2.5%** | `GOOD_ENGAGEMENT_RATE = 2.5` (호조 기준) |
| 도달 | ≥ | (캠페인 일일 예산 × 일수)/CPM 추정 또는 **100,000** 디폴트 | 캠페인 규모에 따라 다름, 우선 단순 디폴트 |
| 노출/클릭/반응/댓글/공유 수량 | ≥ | (현재 집행 일수 × 일평균) 추정 또는 보수적 디폴트 | 후속 — 우선 빈 칸 + placeholder |

각 추천값 옆에 작은 안내 라벨 (예: "AI 추천 · 트래픽 광고 평균").

### 5.2 미래 확장 (후속)
- 광고주의 과거 캠페인 평균 (Meta `/api/campaigns` 데이터 활용)
- 업종별 벤치마크 (외부 데이터)
- 시즌별 보정

본 PRD는 위 임계치 기반 디폴트만 출시.

---

## 6. 화면 — STEP 03 PerformanceStep KPI 목표 카드

### 6.1 카드 위치
PerformanceStep 의 `campaignBar` 직후, KPI 카드(4개) 줄 **위**에 새 섹션:
- 미입력 상태: "KPI 목표 잡기" 입력 카드
- 입력 완료 상태: KPI 목표별 진행률 카드 N개

### 6.2 입력 카드 (목표 미입력 상태)

```
┌──────────────────────────────────────────────────────────┐
│  🎯  KPI 목표 잡아보세요                                  │
│  이 캠페인에서 어떤 숫자를 노릴지 정하면, 아래 성과 카드  │
│  옆에 진행률이 표시돼요.                                  │
│                                                          │
│  ☑ CTR ≥ [ 2.0 ]%     AI 추천 · 트래픽 평균             │
│  ☑ CPC ≤ [₩2,000]     AI 추천 · 한국 기준선              │
│  ☐ 노출 ≥ [          ]                                   │
│  ☐ 클릭 ≥ [          ]                                   │
│                                                          │
│  [ 이 목표로 저장 ]    [ 나중에 ]                        │
└──────────────────────────────────────────────────────────┘
```

- 체크박스 = 그 KPI 추적할지. 체크 안 한 행은 저장 안 됨.
- 추천 KPI(§4 표) 는 체크된 상태로 진입. 추천값 미리 채움.
- "이 목표로 저장" → localStorage 에 저장 + 진행률 카드 모드로 전환.
- "나중에" → 카드 dismiss. (재진입 시 다시 나옴 — 미정 #1)

### 6.3 진행률 카드 (목표 입력 완료 상태)

```
┌─ KPI 목표 진행률 ────────────────────  [수정] [초기화] ─┐
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ CTR 목표 2.0% 이상   │  │ CPC 목표 ₩2,000 이하 │    │
│  │ 현재 1.88% · 94%     │  │ 현재 ₩2,300 · 115%   │    │
│  │ █████████████▒  주황 │  │ ███████████████  빨강 │   │
│  │                       │  │  목표 초과!           │    │
│  └──────────────────────┘  └──────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

- 카드 헤더 우측에 [수정] [초기화] 아이콘 버튼
  - 수정 → 입력 카드(§6.2) 모드로 전환, 기존 값 그대로 채워서
  - 초기화 → confirm 다이얼로그 후 localStorage 키 삭제, 입력 카드 모드로

### 6.4 진행률 계산 (Q6)
| 비교 방향 | 진행률 계산 | 색상 임계치 |
| --- | --- | --- |
| **≥ (이상)** — CTR/도달/노출/클릭/반응/참여율 | 현재 / 목표 × 100% | ≥ 90% 녹 · ≥ 70% 주 · < 70% 적 |
| **≤ (이하)** — CPC/CPM/빈도 | 현재 / 목표 × 100% | ≤ 100% 녹 · ≤ 130% 주 · > 130% 적("초과 경고") |

- 막대 너비 = `min(진행률, 100%)` (시각 안정성을 위해 100% 캡). 100% 초과는 막대 끝 + 우측에 작은 "초과" 배지.
- 색상은 인라인 토큰 사용: `var(--w-status-positive)` / `var(--w-status-cautionary)` / `var(--w-status-negative)`.

---

## 7. 데이터 모델

### 7.1 localStorage 구조
```ts
// 키: `kpi-target:<campaignId>`
// 값: JSON
{
  campaignId: string;
  createdAt: string;   // ISO date
  updatedAt: string;   // ISO date
  targets: {
    kpi: "ctr" | "cpc" | "cpm" | "reach" | "frequency"
       | "impressions" | "clicks" | "engagementRate" | "reactions" | "comments" | "shares";
    direction: "gte" | "lte";  // 이상(gte) / 이하(lte)
    value: number;
    unit: "pct" | "krw" | "count" | "ratio";
  }[];
}
```

### 7.2 새 훅 — `app/_design/kpiTargets.ts` (or similar) — `useKpiTargets`
`useLibrary` 패턴 그대로:
```ts
function useKpiTargets() {
  function get(campaignId: string): KpiTargetEntry | null;
  function save(campaignId: string, targets: KpiTarget[]): void;
  function clear(campaignId: string): void;
  function suggestDefaults(objective: MetaObjective): KpiTarget[];  // AI 추천 디폴트
}
```

`suggestDefaults` 는 lib/optimization 의 임계치를 읽어서 §5.1 표대로 매핑.

---

## 8. `lib/optimization` 연동 (Q7)

### 8.1 함수 시그니처 확장
```ts
export function suggestOptimizations(
  ins: OptimizationInsights,
  currentDailyBudget: number,
  objective: OptimizationObjective,
  userTargets?: KpiTarget[],   // 새 인자 (optional)
): Suggestion[]
```

### 8.2 동작
- 기존 룰은 그대로 (트래픽 CTR<0.8% → 일시정지 등). `userTargets` 없으면 동작 변화 없음.
- 사용자 KPI 목표가 들어왔고 그 KPI 가 룰의 판단 기준 KPI 와 일치(또는 관련)면, **제안 카드의 `detail` 배열 첫 줄에 사용자 목표 대비 비교를 삽입**:

| 룰 | 기존 첫 줄 | userTargets 있을 때 첫 줄 |
| --- | --- | --- |
| 트래픽 부진 → 일시정지 | `"CTR이 1.40%로 낮아요 (트래픽 광고 평균 ~1~2%)."` | `"CTR이 1.40%로 낮아요 (설정한 목표 2.00%의 70%)."` |
| 트래픽 호조 → 예산 증액 | `"CTR 2.70%로 호조예요."` | `"CTR 2.70%로 호조예요 (설정한 목표 2.00% 의 135%)."` |
| CPC 경고 | `"클릭당 ₩2,400 들고 있어요 — 일반 트래픽 기준선(₩2,000) 보다 비싸요."` | `"클릭당 ₩2,400 들고 있어요 (설정한 목표 ₩2,000 의 120%)."` |
| 인지도 빈도 과다 | `"빈도가 3.50회로 높아요 (권장 2회 이하)."` | `"빈도가 3.50회로 높아요 (설정한 목표 3.00회 의 117%)."` |

원칙: 룰 임계치가 사용자 목표값으로 *교체되지 않음*. 룰은 lib/optimization 의 임계치를 그대로 사용해서 발화. 다만 발화 본문에 사용자 목표를 인용해서 personalized 느낌을 줌.

### 8.3 PerformanceStep 호출 변경
```ts
const userTargets = useKpiTargets().get(launched?.campaignId)?.targets ?? null;
const suggestions = suggestOptimizations(ins, dailyBudget, objective, userTargets ?? undefined);
```

---

## 9. 영향 받는 코드 영역

| 영역 | 변경 |
| --- | --- |
| `app/_design/kpiTargets.ts` (신규) | `useKpiTargets` 훅 — localStorage 저장·로딩·삭제·기본값 |
| `app/(workspace)/create/_components/PerformanceStep.tsx` | KPI 목표 입력 카드 / 진행률 카드 / 수정·초기화 동선. 기존 KPI 카드(4개) 줄 위에 새 섹션 |
| `app/(workspace)/create/_components/KpiTargetCard.tsx` (신규) | 진행률 카드 1개 — 막대 + 색상 신호등 |
| `app/(workspace)/create/_components/KpiTargetForm.tsx` (신규) | 입력 카드 — 체크박스 + 인풋 + 추천 라벨 + 저장/취소 |
| `lib/optimization.ts` | `userTargets?: KpiTarget[]` 추가 + §8.2 본문 인용 로직. 기존 룰 그대로. |
| `app/styles/adflow.css` | 진행률 막대 클래스 (예: `.kpi-bar`, `.kpi-bar__fill`, `--good`/`--warn`/`--bad`). 최소화. |

---

## 10. 캠페인 페이지(`/campaigns/[id]`) 연동 — 후속

본 PRD 는 `/create` STEP 03 한정. 같은 캠페인의 상세 페이지(`/campaigns/[id]`) 도 같은 KPI 목표·진행률을 보여줘야 자연스러운데, 그 통합은 후속 작업. localStorage 키가 `campaignId` 기반이라 데이터는 이미 공유 가능 — UI 만 그 페이지에서도 렌더하면 됨.

---

## 11. 미정·결정 후속

| # | 항목 | 1차 안 | 결정 시점 |
| --- | --- | --- | --- |
| 1 | "나중에" 클릭 후 dismiss 정책 (영구 dismiss vs 매번 노출) | **매번 노출** — 목표 설정의 가치 강조. 영구 dismiss 는 후속. | 구현 직전 |
| 2 | 진행률 추세(↑/→/↓) 표시 — 막대만 vs 추세 화살표 추가 | **막대만** — Phase 1 단순. 추세는 후속. | 후속 |
| 3 | 도달·노출·클릭 등 "수량 KPI"의 추천 디폴트값 산출 방식 | **빈 칸 + placeholder** — 캠페인 일일예산·일수 기반 추정은 후속 | 구현 직전 |
| 4 | 동시 여러 KPI 가 미달일 때, 최적화 제안에 어느 목표 인용? | **현재 발화 중인 룰의 KPI와 일치하는 사용자 목표만 인용** | 구현 시 |
| 5 | 예시 모드(launched 없음) UI — 가상 목표값 미리보기? | **가상 값 미리보기** (localStorage 저장 안 함) | 구현 시 |
| 6 | 진행률 카드 정렬 순서 (목표 입력 순 / 미달 심각도 순) | **목표 입력 순** — 안정. 미달 순 정렬은 후속. | 구현 시 |

---

## 12. 검수 체크리스트

본 PRD 가 출시됐다고 보려면:
- [ ] STEP 03 실제 캠페인 첫 진입 시 KPI 목표 입력 카드 노출 (캠페인 목표에 맞게 추천 KPI 자동 체크 + 추천값 채움)
- [ ] 입력 후 [이 목표로 저장] → localStorage 에 정상 저장 → 진행률 카드 모드 전환
- [ ] 진행률 카드: 막대 너비·색상 신호등(녹/주/적) 임계치대로 동작
- [ ] CPC/CPM/빈도 같은 "이하형" KPI 의 초과 경고가 별도 색·라벨로 표시
- [ ] [수정] → 입력 카드 모드, 기존 값 그대로 채움
- [ ] [초기화] → confirm 후 localStorage 키 삭제, 입력 카드 모드로
- [ ] 페이지 새로고침해도 진행률 카드 그대로 복구
- [ ] 사용자 KPI 목표 미달 시, 기존 최적화 제안 카드의 `detail` 첫 줄에 사용자 목표값이 인용됨
- [ ] 캠페인 목표가 트래픽이면 CTR/CPC 만 KPI 풀에 노출 (인지도·참여 KPI 안 보임)
- [ ] 기존 KPI 카드(4개)·차트·일별 표·최적화 제안 카드 회귀 없음
- [ ] `tsc --noEmit` / `eslint .` 통과
