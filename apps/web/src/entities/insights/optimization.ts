/* ── 광고 성과 최적화 ─────────────────────────────────────────────── */

import type { Suggestion } from "./suggestion";
import {
  MIN_DAYS as AUTOMATION_MIN_DAYS,
  GOOD_CTR_PCT,
  HIGH_CPC_KRW,
  HIGH_FREQUENCY,
  HIGH_CPM_KRW,
  GOOD_ENGAGEMENT_RATE,
  BUDGET_INCREASE_RATIO,
} from "./thresholds";

export type { Suggestion, SuggestionAction } from "./suggestion";

export type OptimizationInsights = {
  impressions: number;
  clicks: number;
  ctr: number;   // %
  spend: number; // KRW
  reach?: number;
  frequency?: number;
  cpm?: number;
  postEngagement?: number;
  postReaction?: number;
  postComment?: number;
  postShare?: number;
};

export type OptimizationObjective = "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_APP_PROMOTION";

// PRD §13 — 신규 4 goal 은 별도 룰 없음. 일반 안내만 반환.
// 기존 3 goal(awareness/traffic/engagement_post) 은 Meta objective 단위 룰을 그대로 사용.
const NEW_GOAL_IDS = new Set(["traffic_page_visit", "engagement_page_likes", "engagement_messages", "leads_call"]);

// 데이터 수집 중 안내 note 의 제목 — suggestOptimizations(생성) 와 deriveVerdict(collecting 판정) 의 단일 출처.
export const DATA_GATHERING_TITLES = {
  newGoal: "데이터를 모으는 중이에요",
  dataGap: "데이터를 조금 더 모아보세요",
} as const;
const DATA_GATHERING_TITLE_SET: ReadonlySet<string> = new Set(Object.values(DATA_GATHERING_TITLES));

// ADR-048 — 캠페인 평결. 성과 탭 최상단 한 줄 신호등 결론. 저자=룰(결정적·무료·즉시), Flo(Claude) 아님.
export type VerdictStatus = "collecting" | "trap" | "poor" | "cruising" | "stable";
export type Verdict = {
  status: VerdictStatus;
  headline: string;  // 1순위 Suggestion.title 그대로 (새 카피 0줄)
  top: Suggestion;   // 1순위 제안 — 배너 액션 버튼(pause/increase-budget)을 기존 콜백에 잇기 위함
};

// 새 숫자 계산 없음. 이미 우선순위대로 병합·정렬된 suggestions[] 의 1순위를 평결로 승격한다.
// fake-performance > 호조: 배열 순서가 이미 그 우선순위(page.tsx 가 fake 감지 시 증액 제안을 숨기고 점검을 앞세움)라
// 1순위 kind/severity 만 읽으면 충돌이 자동 해소된다. collecting(데이터부족)만 제목으로 선판정.
export function deriveVerdict(suggestions: Suggestion[]): Verdict | null {
  const top = suggestions[0];
  if (!top) return null; // 엔진은 항상 ≥1 제안을 반환하므로 이론상 도달 안 함 — 방어적 null
  const status: VerdictStatus = DATA_GATHERING_TITLE_SET.has(top.title)
    ? "collecting"
    : top.kind === "fake-performance"
      ? "trap"
      : top.kind === "pause" || top.severity === "warn"
        ? "poor"
        : top.kind === "increase-budget"
          ? "cruising"
          : "stable";
  return { status, headline: top.title, top };
}

const LOW_CTR_PCT = 0.8;
const MAX_SUGGESTED_DAILY_BUDGET = 1_000_000;

const AUTOMATION_MIN_IMPRESSIONS = 10_000;
const AUTOMATION_MIN_CLICKS = 50;  // near Meta's ~50-event learning phase exit

// 성과를 신뢰성 있게 판단할 만큼 데이터가 쌓였는지 — 제안 엔진(suggestOptimizations)과
// 자동화 준비도(assessAutomationReadiness)가 공유하는 단일 게이트. 두 패널이 항상 일치하도록.
function automationDataGaps(ins: OptimizationInsights, daysOfData: number, objective: OptimizationObjective): string[] {
  const gaps: string[] = [];
  if (ins.impressions < AUTOMATION_MIN_IMPRESSIONS) {
    gaps.push(`노출 ${ins.impressions.toLocaleString("ko-KR")}회 (목표 ${AUTOMATION_MIN_IMPRESSIONS.toLocaleString("ko-KR")}회)`);
  }
  if (daysOfData < AUTOMATION_MIN_DAYS) {
    gaps.push(`집행 ${daysOfData}일 (목표 ${AUTOMATION_MIN_DAYS}일)`);
  }
  if (objective !== "OUTCOME_AWARENESS" && objective !== "OUTCOME_ENGAGEMENT" && ins.clicks < AUTOMATION_MIN_CLICKS) {
    gaps.push(`클릭 ${ins.clicks.toLocaleString("ko-KR")}회 (목표 ${AUTOMATION_MIN_CLICKS}회)`);
  }
  return gaps;
}

const won = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;
const pct = (n: number) => `${n.toFixed(2)}%`;

const LOW_REACH_REL_GROWTH = 0.05;   // daily reach growth below 5% = stagnant
const LOW_ENGAGEMENT_RATE = 0.5;     // reactions/impressions below 0.5% = underperforming

export function suggestOptimizations(
  ins: OptimizationInsights,
  currentDailyBudget: number,
  daysOfData: number,
  objective: OptimizationObjective = "OUTCOME_TRAFFIC",
  goalId?: string,
): Suggestion[] {
  const out: Suggestion[] = [];

  // PRD §13 — 신규 4 goal 은 KPI 가 달라서 기존 룰 잘못 적용 위험. 데이터 누적 안내만 반환.
  if (goalId && NEW_GOAL_IDS.has(goalId)) {
    out.push({
      kind: "note",
      severity: "info",
      title: DATA_GATHERING_TITLES.newGoal,
      detail: [
        `이 광고 목표(${goalId})의 자동 최적화 룰은 다음 업데이트에서 추가돼요.`,
        `우선은 KPI 카드의 추세와 일일 표를 보고 직접 조정해주세요.`,
      ],
    });
    return out;
  }

  // 준비도와 동일한 데이터 게이트 — 둘 다 충분/부족을 같은 기준으로 판단해 모순 표시를 막는다.
  const dataGaps = automationDataGaps(ins, daysOfData, objective);
  if (dataGaps.length > 0) {
    out.push({
      kind: "note",
      severity: "info",
      title: DATA_GATHERING_TITLES.dataGap,
      detail: [
        `아직 성과를 판단하기엔 일러요 — 부족: ${dataGaps.join(" / ")}.`,
        `조금 더 쌓이면 예산·소재 조정을 제안해드릴게요.`,
      ],
    });
    out.push({
      kind: "note",
      severity: "info",
      title: "기다리는 동안 점검해볼 것들",
      detail: [
        `랜딩 페이지가 모바일에서 빠르게 뜨는지 확인해보세요 (LCP < 2.5s 권장).`,
        `타겟이 너무 좁지 않은지 살펴봐요 — 도달이 거의 늘지 않으면 연령·지역을 한 단계 넓혀보는 걸 추천해요.`,
        `노출이 쌓이는 동안 광고 카피·이미지가 모바일 미리보기에서 잘려 보이지 않는지도 확인해주세요.`,
      ],
    });
    return out;
  }

  if (objective === "OUTCOME_AWARENESS") {
    if (ins.frequency != null && ins.frequency > HIGH_FREQUENCY) {
      out.push({
        kind: "pause",
        severity: "warn",
        title: "광고 피로도가 쌓이고 있어요 — 일시정지를 고려해보세요",
        detail: [
          `빈도가 ${ins.frequency.toFixed(2)}회로 높아요 (권장 2회 이하).`,
          `같은 사람에게 너무 자주 노출되면 인지도 효율이 떨어져요. 새 소재로 다시 시도하는 걸 권해요.`,
        ],
      });
    }
    if (ins.cpm != null && ins.cpm > HIGH_CPM_KRW) {
      out.push({
        kind: "note",
        severity: "warn",
        title: "CPM이 높아요",
        detail: [
          `CPM ${won(ins.cpm)}으로 일반 인지도 광고 기준선(${won(HIGH_CPM_KRW)})보다 비싸요.`,
          `타겟이 너무 좁거나 경쟁이 강한 시기일 수 있어요. 타겟·일정을 조정해보세요.`,
        ],
      });
    }
    if (ins.cpm != null && ins.cpm <= HIGH_CPM_KRW && ins.frequency != null && ins.frequency <= HIGH_FREQUENCY) {
      const to = Math.min(MAX_SUGGESTED_DAILY_BUDGET, Math.round((currentDailyBudget * BUDGET_INCREASE_RATIO) / 1000) * 1000);
      if (to > currentDailyBudget) {
        out.push({
          kind: "increase-budget",
          severity: "info",
          title: "도달이 안정적이에요 — 일일예산을 늘려볼까요?",
          detail: [
            `CPM ${won(ins.cpm)}·빈도 ${ins.frequency.toFixed(2)}회로 안정적이에요.`,
            `일일예산을 ${won(currentDailyBudget)} → ${won(to)}로 올려 더 많은 사람에게 도달해보세요.`,
            `한 번에 크게 올리면 Meta 학습기가 다시 시작될 수 있어 +30% 정도를 제안해요.`,
          ],
          fromDailyBudget: currentDailyBudget,
          toDailyBudget: to,
        });
      }
    }
  } else if (objective === "OUTCOME_ENGAGEMENT") {
    const engagementRate = ins.impressions > 0 && ins.postEngagement != null
      ? (ins.postEngagement / ins.impressions) * 100
      : 0;
    if (engagementRate < LOW_ENGAGEMENT_RATE) {
      out.push({
        kind: "pause",
        severity: "warn",
        title: "참여가 부진해요 — 일시정지를 고려해보세요",
        detail: [
          `참여율이 ${engagementRate.toFixed(2)}%로 낮아요 (참여 광고 평균 ~1~2%).`,
          `댓글·공유를 유도하는 소재로 새로 만드는 걸 권해요.`,
        ],
      });
    } else if (engagementRate >= GOOD_ENGAGEMENT_RATE) {
      const to = Math.min(MAX_SUGGESTED_DAILY_BUDGET, Math.round((currentDailyBudget * BUDGET_INCREASE_RATIO) / 1000) * 1000);
      if (to > currentDailyBudget) {
        out.push({
          kind: "increase-budget",
          severity: "info",
          title: "참여가 좋아요 — 일일예산을 늘려볼까요?",
          detail: [
            `참여율 ${engagementRate.toFixed(2)}%로 호조예요.`,
            `일일예산을 ${won(currentDailyBudget)} → ${won(to)}로 올려 더 많은 사람에게 노출해보세요.`,
            `한 번에 크게 올리면 Meta 학습기가 다시 시작될 수 있어 +30% 정도를 제안해요.`,
          ],
          fromDailyBudget: currentDailyBudget,
          toDailyBudget: to,
        });
      }
    }
  } else {
    if (ins.ctr < LOW_CTR_PCT) {
      out.push({
        kind: "pause",
        severity: "warn",
        title: "성과가 부진해요 — 일시정지를 고려해보세요",
        detail: [
          `CTR이 ${pct(ins.ctr)}로 낮아요 (트래픽 광고 평균 ~1~2%).`,
          `광고를 일시정지하고 새 소재로 다시 만드는 걸 권해요.`,
        ],
      });
    }

    if (ins.ctr >= GOOD_CTR_PCT) {
      const to = Math.min(MAX_SUGGESTED_DAILY_BUDGET, Math.round((currentDailyBudget * BUDGET_INCREASE_RATIO) / 1000) * 1000);
      if (to > currentDailyBudget) {
        out.push({
          kind: "increase-budget",
          severity: "info",
          title: "성과가 좋아요 — 일일예산을 늘려볼까요?",
          detail: [
            `CTR ${pct(ins.ctr)}로 호조예요.`,
            `일일예산을 ${won(currentDailyBudget)} → ${won(to)}로 올려 더 많은 사람에게 노출해보세요.`,
            `한 번에 크게 올리면 Meta 학습기가 다시 시작될 수 있어 +30% 정도를 제안해요.`,
          ],
          fromDailyBudget: currentDailyBudget,
          toDailyBudget: to,
        });
      }
    }
  }

  // CPC is only meaningful for the traffic objective.
  if (objective === "OUTCOME_TRAFFIC" && ins.clicks > 0) {
    const cpc = ins.spend / ins.clicks;
    if (cpc >= HIGH_CPC_KRW) {
      out.push({
        kind: "note",
        severity: "warn",
        title: "클릭당 비용이 높아요",
        detail: [
          `클릭당 ${won(cpc)} 들고 있어요 — 일반 트래픽 광고 기준선(${won(HIGH_CPC_KRW)}) 보다 비싸요.`,
          `타겟을 좁히거나(나이·성별·지역) 소재를 점검해보세요.`,
          `재타겟팅은 새 캠페인으로 만들어야 해요 — 기존 광고에는 적용되지 않아요.`,
        ],
      });
    } else {
      out.push({
        kind: "note",
        severity: "info",
        title: "클릭 효율은 안정적이에요",
        detail: [
          `클릭당 ${won(cpc)} 수준 — 일반 트래픽 광고 기준선(${won(HIGH_CPC_KRW)}) 보다 효율적이에요.`,
          `이 효율을 유지하면 같은 예산으로 더 많은 방문을 만들 수 있어요.`,
          `소재를 복제해 1~2개 변형(헤드라인·이미지)으로 A/B 테스트하면 다음 라운드 인사이트가 쌓여요.`,
        ],
      });
    }
  }

  if (out.length === 0) {
    out.push({
      kind: "note",
      severity: "info",
      title: "지금은 안정적이에요",
      detail: [
        `CTR ${pct(ins.ctr)} · 특별히 손볼 곳은 없어 보여요.`,
        `계속 지켜보다 성과가 바뀌면 다시 제안해드릴게요.`,
      ],
    });
  }

  // Always show at least two cards, even in edge cases (0 clicks, borderline CTR).
  if (out.length === 1) {
    out.push({
      kind: "note",
      severity: "info",
      title: "다음 라운드 준비 팁",
      detail: [
        `핵심 시간대(요일·시간)와 가장 반응이 좋은 광고 카피를 메모해두세요 — 다음 캠페인 기획에 큰 도움이 돼요.`,
        `소재를 살짝 변형한 버전으로 별도 캠페인을 만들어 A/B 테스트하면 성공 패턴이 더 또렷해져요.`,
        `랜딩 페이지 헤드라인을 광고 카피와 일치시키면 클릭 후 이탈을 줄일 수 있어요.`,
      ],
    });
  }

  return out;
}

export type AutomationReadiness = {
  ready: boolean;
  reason: string; // when ready: why it's safe; when not: which thresholds are unmet
};

export function assessAutomationReadiness(
  ins: OptimizationInsights,
  daysOfData: number,
  objective: OptimizationObjective = "OUTCOME_TRAFFIC",
  goalId?: string,
): AutomationReadiness {
  // PRD §13 — 신규 goal 의 자동화 룰은 미정. 사용자 직접 판단 권유.
  if (goalId && NEW_GOAL_IDS.has(goalId)) {
    return { ready: false, reason: "이 광고 목표의 자동 판단 룰은 곧 추가돼요. 우선은 KPI 추세를 보고 직접 조정해주세요." };
  }
  // 데이터 충분성은 제안 엔진과 공유하는 게이트로 — 두 패널 일치 보장. 성과(CTR·빈도·참여) 게이트만 별도.
  const gaps = automationDataGaps(ins, daysOfData, objective);
  if (objective === "OUTCOME_AWARENESS") {
    if (ins.frequency != null && ins.frequency > HIGH_FREQUENCY) {
      gaps.push(`빈도 ${ins.frequency.toFixed(2)}회 — 피로도 높아 자동화 보류`);
    }
  } else if (objective === "OUTCOME_ENGAGEMENT") {
    const engagementRate = ins.impressions > 0 && ins.postEngagement != null
      ? (ins.postEngagement / ins.impressions) * 100
      : 0;
    if (engagementRate < LOW_ENGAGEMENT_RATE) {
      gaps.push(`참여율 ${engagementRate.toFixed(2)}% — 낮아서 먼저 개선 필요`);
    }
  } else {
    if (ins.ctr < LOW_CTR_PCT) {
      gaps.push(`CTR ${pct(ins.ctr)} — 낮아서 먼저 개선 필요`);
    }
  }
  if (gaps.length === 0) {
    const headline = objective === "OUTCOME_AWARENESS"
      ? `노출 ${ins.impressions.toLocaleString("ko-KR")}회 · 빈도 ${(ins.frequency ?? 0).toFixed(2)}회 · CPM ${won(ins.cpm ?? 0)}`
      : objective === "OUTCOME_ENGAGEMENT"
        ? `노출 ${ins.impressions.toLocaleString("ko-KR")}회 · 참여 ${(ins.postEngagement ?? 0).toLocaleString("ko-KR")}회`
        : `노출 ${ins.impressions.toLocaleString("ko-KR")}회 · 클릭 ${ins.clicks.toLocaleString("ko-KR")}회 · CTR ${pct(ins.ctr)}`;
    return {
      ready: true,
      reason: `${headline} — 자동 판단이 안정적으로 동작할 만큼 데이터가 쌓였어요.`,
    };
  }
  return { ready: false, reason: gaps.join(" / ") };
}
