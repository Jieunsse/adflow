/* ── Instagram 오가닉 최적화 ─────────────────────────────────────── */

export type IgOptInput = {
  followers: number;
  reach: number;        // 28일 오가닉 도달
  engagementRate: number; // %
  posts: Array<{ likeCount: number; commentCount: number; savedCount: number }>;
};

const LOW_IG_ENGAGEMENT = 1.0;    // 1% 미만 = 부진
const GOOD_IG_ENGAGEMENT = 3.0;   // 3% 이상 = 우수
const LOW_REACH_RATE = 30;        // 도달/팔로워 30% 미만 = 낮음
const LOW_FOLLOWER_COUNT = 1000;

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function suggestIgOptimizations(input: IgOptInput): Suggestion[] {
  const { followers, reach, engagementRate, posts } = input;
  const out: Suggestion[] = [];

  // 1. 인게이지먼트율
  if (engagementRate < LOW_IG_ENGAGEMENT) {
    out.push({
      kind: "note",
      severity: "warn",
      title: "인게이지먼트율이 낮아요",
      detail: [
        `현재 ${engagementRate.toFixed(1)}%로 비즈니스 계정 평균(1~3%) 아래예요.`,
        `정보성(팁·인포그래픽), 참여 유도(질문·투표), 뒷이야기 콘텐츠가 반응을 높이는 데 효과적이에요.`,
        `스토리 설문·퀴즈를 활용하면 알고리즘 노출도 함께 높아져요.`,
      ],
    });
  } else if (engagementRate >= GOOD_IG_ENGAGEMENT) {
    out.push({
      kind: "note",
      severity: "info",
      title: "인게이지먼트율이 좋아요",
      detail: [
        `${engagementRate.toFixed(1)}%로 평균(1~3%)보다 높아요.`,
        `성과 좋은 게시물의 포맷·주제·시간대를 파악해 비슷한 콘텐츠를 더 올려보세요.`,
        `협업 게시물(Collab post)이나 릴스 확장을 고려해볼 좋은 시점이에요.`,
      ],
    });
  } else {
    out.push({
      kind: "note",
      severity: "info",
      title: "인게이지먼트율이 안정적이에요",
      detail: [
        `${engagementRate.toFixed(1)}%로 평균 범위 안에 있어요.`,
        `저장 수가 높은 게시물이 오가닉 도달에 가장 효과적이에요 — '저장하고 싶은' 정보성 콘텐츠를 늘려보세요.`,
      ],
    });
  }

  // 2. 도달률 (reach / followers)
  if (followers > 0) {
    const reachRate = (reach / followers) * 100;
    if (reachRate < LOW_REACH_RATE) {
      out.push({
        kind: "note",
        severity: "warn",
        title: "오가닉 도달이 팔로워 대비 낮아요",
        detail: [
          `28일 도달(${fmtK(reach)})이 팔로워(${fmtK(followers)}) 대비 ${reachRate.toFixed(0)}%예요.`,
          `팔로워 활동이 많은 시간대(보통 저녁 7~9시)에 맞춰 게시하고, 인기 해시태그 3~5개를 활용해보세요.`,
          `릴스는 피드보다 알고리즘 노출이 높아요 — 기존 콘텐츠를 릴스로 리패키징해보세요.`,
        ],
      });
    }
  }

  // 3. 최고 성과 게시물 인사이트
  if (posts.length > 0) {
    const best = [...posts].sort(
      (a, b) => (b.likeCount + b.commentCount + b.savedCount) - (a.likeCount + a.commentCount + a.savedCount),
    )[0];
    if (best.likeCount + best.commentCount + best.savedCount > 0) {
      out.push({
        kind: "note",
        severity: "info",
        title: "최고 성과 게시물에서 힌트를 얻어보세요",
        detail: [
          `가장 반응이 좋은 게시물: 좋아요 ${fmtK(best.likeCount)} · 댓글 ${fmtK(best.commentCount)} · 저장 ${fmtK(best.savedCount)}.`,
          `이 게시물의 포맷·주제·표현 방식을 분석해 비슷한 콘텐츠를 기획해보세요.`,
        ],
      });
    }
  }

  // 4. 초기 성장 단계 조언
  if (followers < LOW_FOLLOWER_COUNT) {
    out.push({
      kind: "note",
      severity: "info",
      title: "팔로워 성장이 중요한 단계예요",
      detail: [
        `팔로워 ${fmtK(followers)}명으로 초기 성장 단계예요.`,
        `광고 집행과 오가닉 콘텐츠를 병행하면 팔로워 확보 속도를 높일 수 있어요.`,
        `프로필 바이오와 하이라이트를 정리해 첫 방문자의 팔로우 전환율을 높여보세요.`,
      ],
    });
  }

  return out;
}

/* ── 광고 성과 최적화 ─────────────────────────────────────────────── */

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

export type Suggestion =
  | {
      kind: "pause";
      severity: "warn";
      title: string;
      detail: string[];
    }
  | {
      kind: "increase-budget";
      severity: "info";
      title: string;
      detail: string[];
      fromDailyBudget: number;
      toDailyBudget: number;
    }
  | {
      kind: "note"; // info-only; no action button
      severity: "info" | "warn";
      title: string;
      detail: string[];
    };

const MIN_IMPRESSIONS_FOR_JUDGEMENT = 1000; // below this = insufficient data, defer judgement
const LOW_CTR_PCT = 0.8;                     // traffic-objective underperformance threshold
const GOOD_CTR_PCT = 2.0;                    // traffic-objective good performance, suggests scaling
const HIGH_CPC_KRW = 2000;                   // CPC above this triggers an inefficiency warning
const BUDGET_BUMP_RATIO = 1.3;               // +30% bump — small enough to avoid re-entering Meta's learning phase
const MAX_SUGGESTED_DAILY_BUDGET = 1_000_000;

const AUTOMATION_MIN_IMPRESSIONS = 10_000;
const AUTOMATION_MIN_CLICKS = 50;  // near Meta's ~50-event learning phase exit
const AUTOMATION_MIN_DAYS = 3;

const won = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;
const pct = (n: number) => `${n.toFixed(2)}%`;

const LOW_REACH_REL_GROWTH = 0.05;   // daily reach growth below 5% = stagnant
const HIGH_FREQUENCY = 3.0;          // above 3 impressions/person = ad fatigue
const HIGH_CPM_KRW = 8000;           // CPM above this is expensive for awareness
const LOW_ENGAGEMENT_RATE = 0.5;     // reactions/impressions below 0.5% = underperforming
const GOOD_ENGAGEMENT_RATE = 2.5;    // above 2.5% = good, suggests scaling

export function suggestOptimizations(
  ins: OptimizationInsights,
  currentDailyBudget: number,
  objective: OptimizationObjective = "OUTCOME_TRAFFIC",
): Suggestion[] {
  const out: Suggestion[] = [];

  if (ins.impressions < MIN_IMPRESSIONS_FOR_JUDGEMENT) {
    out.push({
      kind: "note",
      severity: "info",
      title: "데이터를 조금 더 모아보세요",
      detail: [
        `노출 ${ins.impressions.toLocaleString("ko-KR")}회로 아직 적어요.`,
        `노출 ${MIN_IMPRESSIONS_FOR_JUDGEMENT.toLocaleString("ko-KR")}회 정도 쌓이면 성과 판단을 도와드릴 수 있어요.`,
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
      const to = Math.min(MAX_SUGGESTED_DAILY_BUDGET, Math.round((currentDailyBudget * BUDGET_BUMP_RATIO) / 1000) * 1000);
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
      const to = Math.min(MAX_SUGGESTED_DAILY_BUDGET, Math.round((currentDailyBudget * BUDGET_BUMP_RATIO) / 1000) * 1000);
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
      const to = Math.min(MAX_SUGGESTED_DAILY_BUDGET, Math.round((currentDailyBudget * BUDGET_BUMP_RATIO) / 1000) * 1000);
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
): AutomationReadiness {
  const gaps: string[] = [];
  if (ins.impressions < AUTOMATION_MIN_IMPRESSIONS) {
    gaps.push(`노출 ${ins.impressions.toLocaleString("ko-KR")}회 (목표 ${AUTOMATION_MIN_IMPRESSIONS.toLocaleString("ko-KR")}회)`);
  }
  if (daysOfData < AUTOMATION_MIN_DAYS) {
    gaps.push(`집행 ${daysOfData}일 (목표 ${AUTOMATION_MIN_DAYS}일)`);
  }
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
    if (ins.clicks < AUTOMATION_MIN_CLICKS) {
      gaps.push(`클릭 ${ins.clicks.toLocaleString("ko-KR")}회 (목표 ${AUTOMATION_MIN_CLICKS}회)`);
    }
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
