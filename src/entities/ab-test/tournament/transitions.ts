// ADR-038 — 데모 토너먼트 라운드 전이의 순수 로직(store 없음). 클라 동기 runner.ts 와 stateless 데모
// 라우트(/api/tournaments/demo)가 같은 함수를 공유한다 — 게재·결산·승격을 서버에서 실행해 시연 시
// "깡통 퍼블리싱"이 아니라 engine.ts(z-검정·CPLC·승격)가 실제로 도는 걸 네트워크로 증명한다.
// "use client" 없음 — 서버 라우트가 import 한다. 부작용(localStorage·fetch)은 호출 측이 가진다.

import {
  deriveAxis,
  settleRound,
  isEnvelopeExhausted,
  roundCampaignId,
  type Tournament,
  type TourRound,
  type Hypothesis,
} from "./engine";
import {
  selectNextLever,
  buildHypothesis,
  buildLeverChallenger,
  summarizeLedger,
  resolveHypothesis,
  demoLeverFactor,
} from "./hypothesis";

export type CreativeGen = { headlines: string[]; primaryTexts: string[] };

export type RoundSettleResult =
  | { status: "no-active" }
  | { status: "insufficient" }
  | {
      status: "settled";
      round: TourRound;
      winnerIsB: boolean;
      winnerCtr: number;
      ctrA: number;
      ctrB: number;
      badge: "winner" | "inconclusive";
      completed: boolean;
    };

// pending 챌린저 → 라운드 게재. 게재 불가(완료·라이브·pending 없음)면 round=null.
export function applyLaunch(t: Tournament): { t: Tournament; round: TourRound | null } {
  if (t.status === "completed" || t.rounds.some((r) => r.status === "running") || !t.pendingChallenger) {
    return { t, round: null };
  }
  const index = t.rounds.length + 1;
  const round: TourRound = {
    index,
    axis: deriveAxis(t.champion, t.pendingChallenger),
    campaignId: roundCampaignId(t.id, index),
    champion: t.champion,
    challenger: t.pendingChallenger,
    fastForwardDays: 0,
    status: "running",
    hypothesis: t.pendingHypothesis ? { ...t.pendingHypothesis, status: "testing" } : undefined,
  };
  t.rounds = [...t.rounds, round];
  t.pendingChallenger = undefined;
  t.pendingHypothesis = undefined;
  return { t, round };
}

// 활성 라운드를 days 만큼 경과시킨 뒤 결산 + 챔피언 승격 + 봉투 정지 체크. engine.settleRound 가 z-검정·CPLC 로 판정.
export function applySettle(t: Tournament, days = 0): { t: Tournament; result: RoundSettleResult } {
  const r = t.rounds.find((x) => x.status === "running");
  if (!r) return { t, result: { status: "no-active" } };

  r.fastForwardDays = Math.max(r.fastForwardDays, days);
  // ADR-044 데모 — 가설이 있으면 레버별 결과 authoring(반증 연출). 없으면 종전 해시 기반 challengerFactor.
  const factorOverride = r.hypothesis ? demoLeverFactor(r.hypothesis.lever, r.campaignId) : undefined;
  const result = settleRound(r, t.championCtr, t.dailyBudget, factorOverride, t.objective);
  if (result.verdict.state === "insufficient") {
    return { t, result: { status: "insufficient" } }; // 누적 ff 는 저장하도록 t 반환
  }

  r.verdict = result.verdict;
  r.rawWinner = result.rawWinner;
  r.adKpis = result.kpis;
  r.status = "settled";
  if (r.hypothesis) {
    r.hypothesis = resolveHypothesis(r.hypothesis, result.verdict, result.rawWinner, new Date().toISOString());
  }

  const winnerIsB = result.rawWinner === "B";
  t.champion = winnerIsB ? r.challenger : r.champion;
  t.championCtr = winnerIsB ? result.verdict.ctrB : result.verdict.ctrA;
  t.axisCursor += 1;
  t.spentBudget += t.dailyBudget * r.fastForwardDays;

  const exhausted = isEnvelopeExhausted(t); // ADR-054 — auto 는 winner-handling 으로 사람 대기(자동 완료 X)

  return {
    t,
    result: {
      status: "settled",
      round: r,
      winnerIsB,
      winnerCtr: t.championCtr,
      ctrA: result.verdict.ctrA,
      ctrB: result.verdict.ctrB,
      badge: result.verdict.state === "winner" ? "winner" : "inconclusive",
      completed: exhausted,
    },
  };
}

// 다음 가설을 세워 챌린저 자동 생성·게재. auto 무인 체인 + 데모 캐스케이드(발표자 빨리감기) 공용.
// ADR-044 — AXIS_CYCLE 순회 대신 Ledger(호출 측이 brandProfile 맥락으로 필터해 주입)를 읽어 레버 선택.
// gen 은 호출 측 주입(클라=정적 데모 응답, 서버 라우트=DEMO_CREATIVE_RESULT) — 생성 부작용을 순수 로직과 분리.
// ADR-054 — 봉투 소진에서만 멈춘다. 정체는 selectNextLever 가 다른 레버로 자동 돌파한다.
export function applyAutoAdvance(t: Tournament, gen: CreativeGen, ledger: Hypothesis[] = []): { t: Tournament } {
  if (t.status === "completed") return { t };
  if (!t.championConfirmed) return { t };
  if (t.rounds.some((r) => r.status === "running")) return { t };
  if (isEnvelopeExhausted(t)) return { t };
  if (!t.pendingChallenger) {
    const index = t.rounds.length + 1;
    const ctx = { productId: t.productId, objective: t.objective };
    const lever = selectNextLever(ledger, ctx, index);
    const hasPrior = summarizeLedger(ledger, ctx).relevant.length > 0;
    t.pendingHypothesis = buildHypothesis({
      lever,
      ctx,
      rationaleSource: hasPrior ? "ledger" : "platform-prior",
      idSeed: `${t.id}_r${index}`,
    });
    t.pendingChallenger = buildLeverChallenger(t.champion, lever, gen);
  }
  const { t: launched } = applyLaunch(t);
  return { t: launched };
}
