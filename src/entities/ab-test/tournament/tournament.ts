"use client";

// A/B Tournament(ADR-032) 엔진 + Browse Mode 시연 store. 흐름2 — 챔피언-챌린저 체인.
// 우세안(raw CTR 우위)이 다음 라운드 챔피언으로 승격, 챌린저는 축 순회로 Gemini 가 생성.
// 정직한 이음매 — 우세 판정은 Meta 유의성(데모: z-검정). 광고별 성과는 결정적 생성기(실제 Meta·실제 시간만 mock).
// ADR-033 — /demo 트리 폐기에 따라 lib/demo 에서 src/entities 로 relocate, Demo→Browse 리네임.
// ADR-037 — 실 Meta 정합: judgeAbTest 분리, inconclusive=챔피언 방어, 승격=confidence ≥ WINNER_CONFIDENCE.

import { type AdKpi } from "@entities/insights/ab-verdict";

export type TourAxis = "headline" | "primary_text" | "image";
export type TourVariant = { headline: string; primaryText: string; imageUrl?: string };

export type RoundVerdict = {
  state: "insufficient" | "inconclusive" | "winner";
  ctrA: number;
  ctrB: number;
  confidence: number; // 0..1 — Meta 유의성 (데모: z-검정). state 는 WINNER_CONFIDENCE 기준 파생.
};

export type TourRound = {
  index: number; // 1-based
  axis: TourAxis;
  campaignId: string; // browse_tourn_{tid}_r{index} — 결정적 시드
  champion: TourVariant; // A
  challenger: TourVariant; // B
  fastForwardDays: number; // 빨리감기 단일 소스, 0 시작
  verdict?: RoundVerdict;
  rawWinner?: "A" | "B"; // 승격 결과 — "B"=챌린저 유의 승격 / "A"=챔피언 방어(유의 승리 or inconclusive) (ADR-037)
  adKpis?: [AdKpi, AdKpi]; // 결산 시점 광고별 성과 스냅샷 (표시용)
  status: "running" | "settled";
};

export type TourMode = "manual-n" | "auto";
export type TourEnvelope = { totalBudget?: number; targetDate?: string };

export type Tournament = {
  id: string;
  brandProfileId: string;
  productId: string;
  productName: string;
  tone: string; // Gemini 톤 (warm|pro|trendy)
  objective: string; // ObjectiveId — Gemini outcome
  mode: TourMode;
  maxRounds?: number; // 수동-N
  envelope?: TourEnvelope; // 자동
  dailyBudget: number;
  champion: TourVariant; // 현 챔피언 크리에이티브
  championCtr: number; // 현 챔피언 CTR 기준선 (%)
  championSource?: "ai" | "existing"; // 출발 챔피언 출처 (undefined=ai 하위호환)
  championSourceName?: string; // existing 일 때 원본 캠페인명 (provenance 표기용)
  championConfirmed?: boolean; // 출발 광고 승인 결정 지점 통과 여부
  pendingChallenger?: TourVariant; // 결정 대기 중인 챌린저 제안 (게재 전)
  prohibitedWords?: string[]; // ADR-035 ⓑ — 브랜드 금칙어 (챌린저 위반 시 이상 신호)
  anomalyClearedRound?: number; // ADR-035 ⓑ — 사람이 "계속"으로 해소한 이상 신호 라운드
  brandDescription?: string; // 셋업 시 고른 브랜드 컨텍스트 — 라운드별 Gemini 주입
  productDescription?: string; // 셋업 시 고른 제품 컨텍스트 — 라운드별 Gemini 주입
  axisCursor: number; // 좌표상승 인덱스
  rounds: TourRound[];
  spentBudget: number; // 자동 봉투 누적
  status: "running" | "completed";
  createdAt: string;
};

/* ─── store (흐름 1 browse/store.ts 패턴 복제) ──────────────── */

const KEY = "adflow:browse:tournaments";
export const TOURNAMENT_CHANGE_EVENT = "adflow:browse:tournaments:change";

function read(): Tournament[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tournament[]) : [];
  } catch {
    return [];
  }
}

function write(list: Tournament[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOURNAMENT_CHANGE_EVENT));
  }
}

export function listTournaments(): Tournament[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getTournament(id: string): Tournament | null {
  return read().find((t) => t.id === id) ?? null;
}

export function upsertTournament(t: Tournament): void {
  const list = read();
  const idx = list.findIndex((x) => x.id === t.id);
  if (idx >= 0) list[idx] = t;
  else list.push(t);
  write(list);
}

export function resetTournaments(): void {
  write([]);
}

export function removeTournament(id: string): void {
  write(read().filter((t) => t.id !== id));
}

export function newTournamentId(): string {
  return `tourn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ─── 엔진 (순수 함수) ───────────────────────────────────────── */

// 자동 순회 축 — 2라운드+ AI 챌린저 제안. image 는 셋업에서 유저가 직접 고르는 라운드1 전용 축이라 제외.
export const AXIS_CYCLE: TourAxis[] = ["headline", "primary_text"];
export const AXIS_LABEL: Record<TourAxis, string> = {
  headline: "헤드라인",
  primary_text: "광고 카피",
  image: "이미지",
};

export function nextAxis(cursor: number): TourAxis {
  return AXIS_CYCLE[cursor % AXIS_CYCLE.length];
}

// 챔피언↔챌린저가 어느 필드에서 다른지로 라운드 축을 도출. 셋업에서 유저가 고른 축(이미지 포함) 반영용.
export function deriveAxis(champion: TourVariant, challenger: TourVariant): TourAxis {
  if ((champion.imageUrl ?? "") !== (challenger.imageUrl ?? "")) return "image";
  if (champion.headline !== challenger.headline) return "headline";
  return "primary_text";
}

export function roundCampaignId(tournamentId: string, index: number): string {
  return `browse_tourn_${tournamentId}_r${index}`;
}

// 광고당 일평균 노출 기준치 — 빨리감기 1주면 광고당 ≈ 1.5만 노출 (z-검정 유의성 산출에 충분).
const BASE_DAILY_IMP_PER_AD = 2200;

// 같은 (seed, index)면 항상 같은 값 — 흐름 1 buildBrowseInsights 의 seededVariance 와 동일 아이디어.
export function seededUnit(seed: string, index = 0): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  h = (h * 9301 + index * 49297 + 233280) | 0;
  return ((((h % 10000) + 10000) % 10000) / 10000);
}

// 챌린저 품질 계수 — 라운드마다 결정적 (챔피언 대비 CTR 배수). >1 이면 챌린저 우세 → 승격.
// 라운드가 진행될수록 상승 편향(시연 신뢰성 — 대체로 CTR 우상향)이되, 라운드별 시드 분산을
// 남겨 가끔 챔피언 방어·우열 불명도 나온다. boost 는 clamp 해 비현실적 수치를 막는다.
function challengerFactor(campaignId: string, index: number): number {
  const idxBoost = Math.min(Math.max(index - 1, 0), 4) * 0.05;
  return 0.9 + idxBoost + seededUnit(campaignId + "f") * 0.45;
}

// 라운드 광고별 KPI 생성 (split test = 셀당 동일 예산·동일 노출). ffDays=0 이면 데이터 없음(insufficient).
// 노출·예산은 두 셀 동일, 클릭만 CTR(챔피언 vs 챌린저)로 갈린다 → CPC(=spend/clicks)가 셀마다 emergent.
// Meta traffic 결정 지표(cost per link click)가 실제로 셀 간 차이를 갖도록 하는 핵심 (ADR-037).
// factorOverride 는 시드 시연용 — 라운드별 승부를 authoring 하려고 challengerFactor 대신 쓴다(실 runner 는 미사용).
export function roundAdKpis(
  round: TourRound,
  championCtr: number,
  dailyBudget: number,
  factorOverride?: number,
): [AdKpi, AdKpi] {
  const ff = Math.max(0, round.fastForwardDays);
  if (ff === 0) {
    return [
      { ctr: 0, impressions: 0, clicks: 0, spend: 0 },
      { ctr: 0, impressions: 0, clicks: 0, spend: 0 },
    ];
  }
  const imp = Math.round(BASE_DAILY_IMP_PER_AD * ff * (0.9 + seededUnit(round.campaignId + "i") * 0.2));
  const ctrA = championCtr;
  const ctrB = championCtr * (factorOverride ?? challengerFactor(round.campaignId, round.index));
  const clicksA = Math.max(0, Math.round((imp * ctrA) / 100));
  const clicksB = Math.max(0, Math.round((imp * ctrB) / 100));
  const pace = 0.86 + seededUnit(round.campaignId + "pace") * 0.1; // 86~96% 예산 소진 (현실 페이싱)
  const spendPerCell = Math.round(((dailyBudget * ff) / 2) * pace);
  const mk = (clk: number): AdKpi => ({
    impressions: imp,
    clicks: clk,
    ctr: imp ? Math.round((clk / imp) * 10000) / 100 : 0,
    spend: spendPerCell,
  });
  return [mk(clicksA), mk(clicksB)];
}

// 표준정규 CDF (Abramowitz & Stegun 26.2.17). 두 비율 z-검정의 단측 신뢰도용.
function stdNormalCdf(z: number): number {
  const b1 = 0.319381530, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
  const p = 0.2316419, c = 0.39894228;
  const az = Math.abs(z);
  const t = 1 / (1 + p * az);
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
  const upper = c * Math.exp((-az * az) / 2) * poly;
  return z >= 0 ? 1 - upper : upper;
}

// 두 광고 (clicks/impressions) 2-비율 z-검정 → 신뢰도 = Φ(|z|). 실 Meta 유의성의 데모 시뮬레이터.
// report.ts 가 표시용으로도 동일 함수를 쓴다(단일 소스).
export function confidenceFromZTest(a: AdKpi, b: AdKpi): number {
  if (a.impressions <= 0 || b.impressions <= 0) return 0.5;
  const pa = a.clicks / a.impressions;
  const pb = b.clicks / b.impressions;
  const pooled = (a.clicks + b.clicks) / (a.impressions + b.impressions);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.impressions + 1 / b.impressions));
  if (se === 0) return 0.5;
  return stdNormalCdf(Math.abs(pa - pb) / se);
}

// winner 확정 신뢰도 임계 — 실 Meta A/B test winner 확정 통상 기준(ADR-037). 미만이면 inconclusive.
export const WINNER_CONFIDENCE = 0.9;

// 최소 게재 기간 — 실 Meta A/B test 권장 최소(ADR-037 §6). 미달이면 결산 보류(미종료 간주).
// 데모 빨리감기는 +7일 단위라 실동작엔 영향 없고, 실 split test 폴러의 "스케줄 종료 전 winner 미확정"을 코드로 명시한다.
export const MIN_ROUND_DAYS = 4;

export type SettleResult = {
  kpis: [AdKpi, AdKpi];
  verdict: RoundVerdict;
  rawWinner: "A" | "B";
};

// 결산 (ADR-037) — Meta 유의성(데모: z-검정 confidence) + traffic 결정 지표(cost per link click)로 승격 판정.
// confidence ≥ 임계 and 챌린저 CPLC 우위 → "B" 승격, 그 외(챔피언 유의 승리·inconclusive) → "A" 방어.
// ff=0(미게재) 또는 최소 게재 기간 미달(미종료)이면 insufficient — 결산 보류.
export function settleRound(
  round: TourRound,
  championCtr: number,
  dailyBudget: number,
  factorOverride?: number,
): SettleResult {
  const kpis = roundAdKpis(round, championCtr, dailyBudget, factorOverride);
  const [a, b] = kpis;
  if (a.impressions === 0 || b.impressions === 0 || round.fastForwardDays < MIN_ROUND_DAYS) {
    return { kpis, verdict: { state: "insufficient", ctrA: a.ctr, ctrB: b.ctr, confidence: 0 }, rawWinner: "A" };
  }
  const confidence = confidenceFromZTest(a, b);
  const significant = confidence >= WINNER_CONFIDENCE;
  // winner = Meta traffic 결정 지표(cost per link click = spend/clicks)가 낮은 셀. 유의할 때만 승격.
  const cplcA = a.clicks > 0 ? a.spend / a.clicks : Infinity;
  const cplcB = b.clicks > 0 ? b.spend / b.clicks : Infinity;
  const rawWinner: "A" | "B" = significant && cplcB < cplcA ? "B" : "A";
  return {
    kpis,
    verdict: { state: significant ? "winner" : "inconclusive", ctrA: a.ctr, ctrB: b.ctr, confidence },
    rawWinner,
  };
}

function daysBetweenIso(start: string, end: string): number {
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (isNaN(s) || isNaN(e)) return Infinity;
  return Math.round((e - s) / 86400000);
}

// 봉투 소진 — 수동-N: settled 라운드 수 ≥ maxRounds / 자동: 예산 또는 목표일 도달.
export function isEnvelopeExhausted(t: Tournament): boolean {
  if (t.mode === "manual-n") {
    return t.rounds.filter((r) => r.status === "settled").length >= (t.maxRounds ?? 0);
  }
  const env = t.envelope ?? {};
  if (env.totalBudget != null && t.spentBudget >= env.totalBudget) return true;
  if (env.targetDate) {
    const simDays = t.rounds.filter((r) => r.status === "settled").reduce((s, r) => s + r.fastForwardDays, 0);
    const budgetDays = daysBetweenIso(t.createdAt, env.targetDate + "T00:00:00+09:00");
    if (simDays >= budgetDays) return true;
  }
  return false;
}

/* ─── ADR-035 무인 루프 비트 + 필요 브레이크 ──────────────── */

export type TourBeat =
  | "champion-review" // ⓒ 출발 챔피언 확인 (셋업 게이트)
  | "auto-running" // auto 무인 진행 — 사람 개입 없음
  | "anomaly" // ⓑ 이상 신호 — auto 일시정지, 사람 대기
  | "winner-handling" // ⓐ 봉투 소진 — 사람 처리 대기
  | "live" // manual-n 라이브 라운드
  | "challenger-review" // manual-n 챌린저 검토
  | "between" // manual-n 라운드 전환
  | "done";

export type TourAnomaly = { kind: "stagnation" | "prohibited"; round: number; words?: string[] };

// auto 무인 루프를 멈춰야 하는 이상 신호 감지 (ADR-035 ⓑ · ADR-037 정련).
// V1 트리거: ① 마지막 챌린저 텍스트가 브랜드 금칙어 위반 ② 연속 3라운드 챌린저 미승격.
// inconclusive 가 정상이 된 실 Meta 정합상 "방어"가 흔하므로 임계 2→3 (AXIS_CYCLE 한 바퀴+α).
// anomalyClearedRound 이하로 사람이 "계속"한 라운드는 해소된 것으로 본다.
export function detectAnomaly(t: Tournament): TourAnomaly | null {
  const settled = t.rounds.filter((r) => r.status === "settled");
  const last = settled.at(-1);
  if (!last) return null;
  if ((t.anomalyClearedRound ?? 0) >= last.index) return null;

  const words = t.prohibitedWords ?? [];
  const text = `${last.challenger.headline} ${last.challenger.primaryText}`;
  const hits = words.map((w) => w.trim()).filter((w) => w && text.includes(w));
  if (hits.length) {
    return { kind: "prohibited", round: last.index, words: hits };
  }
  const prev = settled.at(-2);
  const prev2 = settled.at(-3);
  if (prev && prev2 && last.rawWinner === "A" && prev.rawWinner === "A" && prev2.rawWinner === "A") {
    return { kind: "stagnation", round: last.index };
  }
  return null;
}

// 현재 상태 → 비트. auto = 무인(브레이크만 멈춤), manual-n = 매 단계 제어 (ADR-035).
// 우선순위: done > champion-review > winner-handling > anomaly > 진행.
export function deriveBeat(t: Tournament): TourBeat {
  if (!t.championConfirmed) return "champion-review";
  if (t.status === "completed") return "done";
  if (t.mode === "auto") {
    if (isEnvelopeExhausted(t)) return "winner-handling";
    if (detectAnomaly(t)) return "anomaly";
    return "auto-running";
  }
  if (t.rounds.some((r) => r.status === "running")) return "live";
  if (t.pendingChallenger) return "challenger-review";
  return "between";
}

// 대시보드 "결정 대기" = 꼭 사람이 봐야 하는 비트만 (ADR-035 브레이크 + manual-n 제어).
export function isDecisionBeat(b: TourBeat): boolean {
  return (
    b === "winner-handling" ||
    b === "anomaly" ||
    b === "champion-review" ||
    b === "challenger-review" ||
    b === "between"
  );
}

export function isRunningBeat(b: TourBeat): boolean {
  return b === "auto-running" || b === "live";
}

// Gemini 결과에서 해당 축 필드만 챔피언과 다르게 교체해 챌린저 변형 구성.
type CreativeGen = { headlines: string[]; primaryTexts: string[] };
export function buildChallenger(champion: TourVariant, axis: TourAxis, gen: CreativeGen): TourVariant {
  if (axis === "headline") {
    const h = gen.headlines.find((x) => x.trim() && x.trim() !== champion.headline.trim()) ?? gen.headlines[0];
    return { ...champion, headline: h };
  }
  const t = gen.primaryTexts.find((x) => x.trim() && x.trim() !== champion.primaryText.trim()) ?? gen.primaryTexts[0];
  return { ...champion, primaryText: t };
}

export function initialChampion(gen: CreativeGen): TourVariant {
  return { headline: gen.headlines[0] ?? "", primaryText: gen.primaryTexts[0] ?? "" };
}
