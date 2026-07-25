"use client";

// ADR-033 — Browse Mode 토너먼트 대시보드 시연 시드. 흐름1 browse/seed.ts(seedAutoPilotDemo)의 대칭.
// listTournaments() 가 비면 대시보드가 빈 상태만 보이므로, 결정 대기·진행 중·완료 세 서사를 모두 채우는
// 고정 토너먼트 7개를 멱등 seed 한다. 라운드 성과는 실제 엔진(settleRound)으로 시뮬레이션해
// 대시보드 집계(lift·누적 지출·trophy)와 일관성을 유지한다 — mock 은 Meta 게재·시간 경과뿐.
// ADR-054 — 시드는 전부 auto 무인. "결정 대기"는 예산 소진(winner-handling) 하나뿐 — 돈 방향만 사람.
// 금칙어는 생성 단계 구조 차단, 정체는 selectNextLever 자동 돌파, AI 챔피언은 자동 확정이라 멈추지 않는다.

import {
  getTournament,
  upsertTournament,
  removeTournament,
  resetTournaments,
  listTournaments,
  settleRound,
  hasConverged,
  seededUnit,
  deriveAxis,
  roundCampaignId,
  type Tournament,
  type TourVariant,
  type TourRound,
  type TourMode,
  type TourEnvelope,
} from "./tournament";
import { clearAllLedgers } from "./ledger";

// outcome — 라운드별 승부 authoring (시연 믹스 제어). win=챌린저 유의 승격 / hold=챔피언 방어(우열 불명).
// 해시 기반 challengerFactor 는 후반 라운드 상승 편향으로 거의 전승하므로, 시드는 결과를 직접 정한다.
type Outcome = "win" | "hold";
type Mutation = { field: "headline" | "primaryText"; value: string; outcome: Outcome };

// outcome → challengerFactor 오버라이드. win=1.12~1.26(유의 lift) / hold=0.97~1.03(near-tie → inconclusive).
function outcomeFactor(outcome: Outcome, campaignId: string): number {
  const j = seededUnit(campaignId + "of");
  return outcome === "hold" ? 0.97 + j * 0.06 : 1.12 + j * 0.14;
}

type SeedSpec = {
  id: string;
  createdAt: string;
  productName: string;
  productId?: string; // Ledger 맥락 키 — 생략 시 id (제품별 학습 격리). ADR-044
  tone: string;
  objective: string;
  startChampion: TourVariant;
  startCtr: number;
  mutations: Mutation[]; // 라운드별 챌린저 — 현 챔피언에서 한 필드만 교체
  finalStatus: "running" | "completed";
  championConfirmed: boolean;
  mode?: TourMode; // 기본 auto (ADR-054 무인)
  runningLast?: boolean; // 마지막 mutation 을 결산하지 않고 라이브 라운드로 둠
  envelope?: TourEnvelope; // winner-handling 시드 — 소진된 자원 봉투
};

const DAILY_BUDGET = 50000;
const SETTLE_FF = 7; // 결산 라운드 누적 빨리감기 일수
const LIVE_FF = 4; // 진행 중 라운드 — 성과는 보이되 결산 전

// settleActiveRound 의 승격 로직을 시뮬레이션 — 라운드를 결산하며 챔피언/CTR/지출을 누적한다.
export function build(spec: SeedSpec): Tournament {
  let champion = spec.startChampion;
  let championCtr = spec.startCtr;
  let axisCursor = 0;
  let spentBudget = 0;
  const rounds: TourRound[] = [];

  spec.mutations.forEach((mut, i) => {
    const index = i + 1;
    const challenger: TourVariant = { ...champion, [mut.field]: mut.value };
    const isLiveLast = spec.runningLast && i === spec.mutations.length - 1;
    const round: TourRound = {
      index,
      axis: deriveAxis(champion, challenger),
      campaignId: roundCampaignId(spec.id, index),
      champion,
      challenger,
      fastForwardDays: isLiveLast ? LIVE_FF : SETTLE_FF,
      status: "running",
    };

    if (isLiveLast) {
      rounds.push(round);
      return;
    }

    const result = settleRound(round, championCtr, DAILY_BUDGET, outcomeFactor(mut.outcome, round.campaignId));
    round.verdict = result.verdict;
    round.rawWinner = result.rawWinner;
    round.adKpis = result.kpis;
    round.status = "settled";
    rounds.push(round);

    const winnerIsB = result.rawWinner === "B";
    champion = winnerIsB ? challenger : champion;
    championCtr = winnerIsB ? result.verdict.ctrB : result.verdict.ctrA;
    axisCursor += 1;
    spentBudget += DAILY_BUDGET * round.fastForwardDays;
  });

  const tournament: Tournament = {
    id: spec.id,
    // ADR-050 — 데모 Ledger 키를 /create 데모 브랜드 프로필(seed-demo.ts DEMO_PROFILE_ID)과 일치시켜
    // 토너먼트 학습이 /create 카피 훅 편향으로 흐르게 한다. 옛 "browse_demo" 시드는 아래 stale 정리가 재시드.
    brandProfileId: "demo-greenroutine-001",
    productId: spec.productId ?? spec.id,
    productName: spec.productName,
    tone: spec.tone,
    objective: spec.objective,
    mode: spec.mode ?? "auto",
    dailyBudget: DAILY_BUDGET,
    champion,
    championCtr,
    championSource: "ai",
    championConfirmed: spec.championConfirmed,
    envelope: spec.envelope,
    axisCursor,
    rounds,
    spentBudget,
    status: spec.finalStatus,
    createdAt: spec.createdAt,
  };

  // ADR-061 — 챔피언 N회 연속 방어로 끝난 시드는 transitions.settle 와 동일하게 수렴 종결로 굳힌다
  // (시드 build 는 결산만 시뮬할 뿐 종결 판정을 안 거치므로, completed+converged done 카드를 직접 세팅).
  if (spec.finalStatus === "completed" && hasConverged(tournament)) {
    tournament.completionReason = "converged";
  }

  return tournament;
}

// 고정 시드 7종 (ADR-054) — 완료 2 / 진행 3 / 결정 대기 1(winner-handling=예산) + 캐스케이드 1.
// 옛 anomaly·champion-review 시드는 정상 무인 진행으로 전환했다(금칙어·정체·AI 챔피언은 더는 멈추지 않음).
export const SPECS: SeedSpec[] = [
  // ── 완료 ① 수분 크림 (4라운드, 최대 lift 후보) ──
  {
    id: "browse_demo_tourn_moisture_cream",
    createdAt: "2026-05-30T09:00:00+09:00",
    productName: "수분 가득 비건 크림",
    tone: "warm",
    objective: "traffic",
    startCtr: 1.85,
    startChampion: {
      headline: "건조한 피부에 수분 한 겹",
      primaryText: "식물성 성분만 담은 수분 크림. 민감한 피부도 부담 없이, 바르고 나면 촉촉하게 마무리돼요.",
      imageUrl: "/demo/library/cream.jpg",
    },
    mutations: [
      { field: "headline", value: "당기는 피부, 오늘부터 촉촉하게", outcome: "win" },
      { field: "primaryText", value: "무향·무색소로 자극은 줄이고 수분은 그대로. 민감성 피부를 위한 비건 수분 크림이에요.", outcome: "win" },
      { field: "headline", value: "민감한 피부를 위한 비건 수분 크림", outcome: "hold" },
      { field: "primaryText", value: "출시 첫 달 재구매율 절반 이상. 민감성 피부 고객이 다시 찾는 수분 크림이에요.", outcome: "win" },
    ],
    finalStatus: "completed",
    championConfirmed: true,
  },
  // ── 완료 ② 진정 토너 (3라운드) ──
  {
    id: "browse_demo_tourn_toner",
    createdAt: "2026-05-30T08:30:00+09:00",
    productName: "진정 비건 토너",
    tone: "warm",
    objective: "traffic",
    startCtr: 1.60,
    startChampion: {
      headline: "세안 후 첫 단계, 순한 진정 토너",
      primaryText: "자극 없이 피부결을 정돈하는 식물성 토너. 민감한 피부도 편하게 쓸 수 있어요.",
      imageUrl: "/demo/library/toner.jpg",
    },
    mutations: [
      { field: "headline", value: "예민한 피부, 순하게 정돈하기", outcome: "win" },
      { field: "primaryText", value: "무향·무색소 비건 토너로 데일리 케어를 가볍게. 산뜻하게 스며들어 다음 단계가 편해져요.", outcome: "hold" },
      { field: "headline", value: "매일 쓰는 토너, 순한 게 좋으니까", outcome: "win" },
    ],
    finalStatus: "completed",
    championConfirmed: true,
  },
  // ── 진행 중 ① 약산성 클렌저 (2 결산 + 1 라이브) ──
  {
    id: "browse_demo_tourn_cleanser",
    createdAt: "2026-05-30T08:00:00+09:00",
    productName: "약산성 비건 클렌저",
    tone: "warm",
    objective: "traffic",
    startCtr: 1.95,
    startChampion: {
      headline: "하루의 끝, 순하게 씻어내요",
      primaryText: "약산성 식물성 클렌저로 피부 부담 없이 깨끗하게. 세안 후에도 당기지 않아요.",
      imageUrl: "/demo/library/cleanser.jpg",
    },
    mutations: [
      { field: "headline", value: "당김 없는 세안, 약산성으로", outcome: "win" },
      { field: "primaryText", value: "무향·무색소로 자극은 줄이고, 노폐물은 부드럽게. 민감한 피부를 위한 비건 클렌저예요.", outcome: "hold" },
      { field: "headline", value: "민감한 피부도 편한 데일리 클렌저", outcome: "win" },
    ],
    finalStatus: "running",
    championConfirmed: true,
    runningLast: true,
  },
  // ── 진행 중 ② 딥클렌징 오일 (2 결산 + 1 라이브) ──
  {
    id: "browse_demo_tourn_cleansing_oil",
    createdAt: "2026-05-30T07:50:00+09:00",
    productName: "딥클렌징 비건 오일",
    tone: "warm",
    objective: "traffic",
    startCtr: 2.25,
    startChampion: {
      headline: "메이크업도 산뜻하게 녹여내요",
      primaryText: "식물성 오일로 모공 속 노폐물까지 부드럽게. 헹군 뒤에도 막 없이 깔끔하게 마무리돼요.",
      imageUrl: "/demo/library/serum.jpg",
    },
    mutations: [
      { field: "headline", value: "클렌징 한 번에 끝, 비건 오일", outcome: "hold" },
      { field: "primaryText", value: "무향·무색소 식물성 오일로 자극은 줄이고 세정력은 그대로. 민감한 피부도 편하게 쓸 수 있어요.", outcome: "win" },
      { field: "headline", value: "막 없이 깔끔한 비건 클렌징 오일", outcome: "win" },
    ],
    finalStatus: "running",
    championConfirmed: true,
    runningLast: true,
  },
  // ── 결정 대기 ⓐ winner-handling — 자원 봉투 소진 (수분 세럼, R1 방어·R2 승격 후 예산 소진 → 위너 처리 대기) ──
  // ADR-037 — outcome authoring 으로 R1 inconclusive(방어)·R2 winner(승격) 서사를 만든다(새 모델 시연용).
  {
    id: "browse_demo_tourn_aqua_serum",
    createdAt: "2026-05-30T07:30:00+09:00",
    productName: "수분 충전 비건 세럼",
    tone: "pro",
    objective: "traffic",
    startCtr: 2.05,
    startChampion: {
      headline: "속건조 피부에 수분 채우기",
      primaryText: "가볍게 스며드는 식물성 수분 세럼. 크림 전에 한 방울로 촉촉함을 더해줘요.",
      imageUrl: "/demo/library/serum.jpg",
    },
    mutations: [
      { field: "headline", value: "한 방울로 채우는 수분 루틴", outcome: "hold" },
      { field: "primaryText", value: "끈적임 없이 산뜻하게 스며드는 비건 수분 세럼. 매일의 수분 루틴을 가볍게 시작해보세요.", outcome: "win" },
    ],
    finalStatus: "running",
    championConfirmed: true,
    envelope: { totalBudget: 600000 }, // 2R 누적 지출 70만 > 60만 → isEnvelopeExhausted
  },
  // ── 진행 중 ③ 선크림 (2 결산 + 1 라이브) — 옛 anomaly 시드, 금칙어 없이 정상 무인 진행 ──
  {
    id: "browse_demo_tourn_suncream",
    createdAt: "2026-05-30T07:20:00+09:00",
    productName: "데일리 비건 선크림",
    tone: "pro",
    objective: "traffic",
    startCtr: 1.95,
    startChampion: {
      headline: "매일 바르는 순한 식물성 자외선 차단",
      primaryText: "백탁 없이 산뜻하게 발리는 비건 선크림. 민감한 피부도 부담 없이 데일리로 쓸 수 있어요.",
      imageUrl: "/demo/library/suncream.png",
    },
    mutations: [
      { field: "primaryText", value: "백탁 없이 산뜻하게 흡수되는 비건 선크림. 민감 피부도 매일 부담 없이 발라요.", outcome: "win" },
      { field: "headline", value: "데일리 식물성 자외선 차단, 순하게", outcome: "hold" },
      { field: "primaryText", value: "끈적임 없이 흡수되는 데일리 비건 선크림. 백탁 없이 산뜻하게 발리고 민감한 피부도 부담 없어요.", outcome: "win" },
    ],
    finalStatus: "running",
    championConfirmed: true,
    runningLast: true,
  },
  // ── 진행 중 ④ 립밤 — 옛 champion-review 시드, AI 챔피언 자동 확정 후 무인 진행 ──
  {
    id: "browse_demo_tourn_lipbalm",
    createdAt: "2026-05-30T07:00:00+09:00",
    productName: "보습 비건 립밤",
    tone: "trendy",
    objective: "traffic",
    startCtr: 2.10,
    startChampion: {
      headline: "건조한 입술에 촉촉 한 겹",
      primaryText: "식물성 보습 성분을 담은 비건 립밤. 무향으로 자극 없이, 하루 종일 촉촉하게.",
      imageUrl: "/demo/library/lipbalm.png",
    },
    mutations: [
      { field: "headline", value: "갈라지는 입술, 촉촉하게 채워요", outcome: "win" },
      { field: "primaryText", value: "식물성 보습 성분으로 하루 종일 촉촉하게. 무향·무색소라 민감한 입술도 편하게 발라요.", outcome: "hold" },
    ],
    finalStatus: "running",
    championConfirmed: true,
    runningLast: true,
  },
  // ── 완료 ③ 수렴 종결 (ADR-061) — 챔피언 2연속 방어로 봉투 소진 전 수렴 정지 ──
  // rawWinner 시퀀스 B,A,A: R1 챌린저 승격(championCtr 상승) → R2·R3 챔피언 방어 2연속 → hasConverged(N=2)
  // → completed + completionReason="converged". totalBudget 200만 > 3R 지출 105만이라 수렴 시점에 예산이 남아
  // done 카드 🎯수렴 sub-state 의 "남은 예산 ₩95만 · 시작 대비 CTR 변화량"이 의미 있게 렌더된다.
  {
    id: "browse_demo_tourn_converged",
    createdAt: "2026-05-30T09:30:00+09:00",
    productName: "탄력 비건 아이크림",
    tone: "warm",
    objective: "traffic",
    startCtr: 1.70,
    startChampion: {
      headline: "지친 눈가에 탄력 한 겹",
      primaryText: "식물성 탄력 성분을 담은 비건 아이크림. 눈가에 부드럽게 발려 매일의 케어를 가볍게 마무리해요.",
      imageUrl: "/demo/library/cream.jpg",
    },
    mutations: [
      { field: "headline", value: "푸석한 눈가, 탄력 있게 채워요", outcome: "win" },
      { field: "primaryText", value: "무향·무색소로 자극은 줄이고 탄력은 그대로. 민감한 눈가를 위한 비건 아이크림이에요.", outcome: "hold" },
      { field: "headline", value: "민감한 눈가를 위한 비건 아이크림", outcome: "hold" },
    ],
    finalStatus: "completed",
    championConfirmed: true,
    envelope: { totalBudget: 2000000 }, // 3R 누적 지출 105만 < 200만 → 수렴 시점 약 95만 잔여
  },
  // ── 가설 캐스케이드 쇼케이스 (ADR-044) — auto·봉투 보유·라운드 0 ──
  // 콘솔 시간 1회 advance 가 봉투 소진(winner-handling)까지 전체 루프를 돈다. 라운드는 가설 생성기가
  // Ledger 를 읽어 만든다(시드에 박지 않음): trust 입증 → rush 반증(이후 회피) → 미결 다수 → 5R 후 소진.
  {
    id: "browse_demo_tourn_ample",
    createdAt: "2026-05-30T10:00:00+09:00",
    productName: "비타민 비건 앰플",
    tone: "pro",
    objective: "traffic",
    startCtr: 1.70,
    startChampion: {
      headline: "칙칙한 피부에 비타민 한 방울",
      primaryText: "식물성 비타민 앰플로 생기 없는 피부에 활력을. 매일 아침 한 방울로 톤을 정돈해요.",
      imageUrl: "/demo/library/serum.jpg",
    },
    mutations: [],
    finalStatus: "running",
    championConfirmed: true,
    // ADR-061 — 이 시드는 ADR-054 봉투 소진(winner-handling) 캐스케이드 쇼케이스용. 방어 시퀀스가 B,A,A,A,A 라
    // 기본 N=2 면 R3 에서 수렴 종결돼 winner-handling 시연이 사라진다. stopOnDefendStreak 를 올려 수렴을 끈다(실/신규는 N=2).
    envelope: { totalBudget: 1500000, stopOnDefendStreak: 99 }, // 5R(라운드당 35만) 후 소진 → winner-handling
  },
];

// 멱등 — 이미 있으면 건드리지 않음. /ab-tests 목록(browseMode) 진입 시 호출.
// 옛 시드(카페 제품 등)가 localStorage 에 남아 있을 수 있으므로, 현 SPEC 에 없는
// browse_demo 토너먼트는 먼저 정리한다. 유저가 만든 토너먼트(tourn_*)는 건드리지 않는다.
export function seedTournamentDemo(): void {
  const validIds = new Set(SPECS.map((s) => s.id));
  for (const t of listTournaments()) {
    const isDemoSeed = t.id.startsWith("browse_demo_tourn_") || t.brandProfileId === "browse_demo";
    if (!isDemoSeed) continue; // 유저가 만든 토너먼트(tourn_*)는 건드리지 않는다.
    // 현 SPEC 에 없거나, 옛 brandProfileId("browse_demo")로 박힌 데모 시드는 정리 후 재시드
    // — ADR-050 Ledger 키 정렬(demo-greenroutine-001)을 기존 localStorage 에도 한 번 반영한다.
    // ADR-054 — 옛 브레이크 시드(미확정 챔피언·금칙어)는 자가 치유: 제거 후 정상 무인 시드로 재시드.
    const staleAdr054 = t.championConfirmed === false || !!t.prohibitedWords?.length;
    if (!validIds.has(t.id) || t.brandProfileId === "browse_demo" || staleAdr054) removeTournament(t.id);
  }
  for (const spec of SPECS) {
    if (!getTournament(spec.id)) upsertTournament(build(spec));
  }
}

// Presenter 초기화 — 전부 비우고 고정 시드를 다시 세운다. 멱등 seed 와 달리
// 사용자가 만들거나 진행시킨 토너먼트까지 지우고 원래 목업 상태로 되돌린다. ADR-044 Ledger 도 함께 비운다.
export function resetTournamentDemo(): void {
  resetTournaments();
  clearAllLedgers();
  for (const spec of SPECS) upsertTournament(build(spec));
}
