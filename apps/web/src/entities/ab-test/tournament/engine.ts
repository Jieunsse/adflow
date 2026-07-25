// A/B Tournament(ADR-032/037) 순수 엔진 — 타입 + 결정 함수. 데모·실제 공유 (ADR-038 결정 6).
// "use client" 없음 — 서버 cron 폴러(섬2)가 settleRound·deriveBeat 를 import 할 수 있어야 한다.
// 영속화·게재·KPI 소스 같은 부작용은 어댑터(adapters.ts)로 분리, 여기엔 순수 함수만 둔다.
// 우세 판정은 Meta 유의성(데모: z-검정), 승격=confidence ≥ WINNER_CONFIDENCE, inconclusive=챔피언 방어.

import { type AdKpi } from "@entities/insights/ab-verdict";
import { tourMetricSpec, metricCpm } from "./objective-metric";
import type { Lever } from "./lever";

export type { Lever, CopyLever, NonCopyLever } from "./lever";

export type TourAxis = "headline" | "primary_text" | "image";
export type TourVariant = { headline: string; primaryText: string; imageUrl?: string };

/* ─── 가설 (ADR-044) — A/B 한 라운드가 검증하는 반증 가능한 인과 단언 ───── */

export type HypothesisVerdict = "confirmed" | "refuted" | "inconclusive";

export type Hypothesis = {
  id: string;
  lever: Lever; // 구조화 키 — Ledger 집계 단위
  statement: string; // "긴박감을 주면 CTR이 오른다"
  predictedMetric: string; // 목표별 결정 지표 라벨 (CTR / CPM / 참여율 …)
  predictedDirection: "up" | "down"; // 개선 방향 (rate=up, cpm=down)
  rationale: string; // 근거 강제 — 어느 재료에서 나왔는지
  rationaleSource:
    | "brand-profile"
    | "persona"
    | "performance-archive"
    | "platform-prior"
    | "ledger"
    | "principle";
  contextTags: { productId: string; personaId?: string; objective: string }; // Ledger 필터·가중 키
  status: "proposed" | "testing" | "resolved";
  verdict?: HypothesisVerdict; // resolved 시
  effectSize?: number; // 챌린저 대비 lift % (verdict 와 함께)
  resolvedAt?: string;
};

// Brand Profile 단위 누적 — resolved 가설이 영구 적재되는 브랜드 지식 자산. 데모=localStorage / 실=Supabase(후속).
export type HypothesisLedger = {
  brandProfileId: string;
  entries: Hypothesis[]; // resolved 만 적재
};

// ADR-039 — 단일 축을 *얼마나* 다르게(변형 폭). 텍스트 축(헤드라인·카피) AI 챌린저 생성에만 적용.
// 토너먼트 상수로 저장 → 무인 auto 루프(R2+)가 그대로 사용 (ADR-054 — 라운드별 override 없음).
export type VariationIntensity = "subtle" | "moderate" | "bold";

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
  adIds?: [string, string]; // 실 게재 라운드의 챔피언(A)·챌린저(B) 광고 ID — KpiSource insights 키. 데모는 미사용
  adSetIds?: [string, string]; // ad_studies SPLIT_TEST 셀별 AdSet(A=챔피언·B=챌린저). 데모는 미사용
  studyId?: string; // Meta ad study(SPLIT_TEST) ID — KpiSource 가 Meta verdict 를 조회하는 키. 데모는 미사용
  launchedAt?: string; // 실 게재 시각 ISO — cron 이 MIN_ROUND_DAYS 경과 판정에 사용. 데모는 fastForwardDays 사용
  status: "running" | "settled";
  hypothesis?: Hypothesis; // ADR-044 — 이 라운드가 검증하는 가설. 동인은 hypothesis.lever, axis 는 표시 파생 유지
};

// ADR-054 — 완전 무인화: manual-n 폐기, auto 단일. mode 필드는 Supabase 컬럼(NOT NULL)이라 유지하되 값은 항상 auto.
export type TourMode = "auto";
// ADR-061 — autoRefill(opt-in·기본 OFF): 봉투 소진 시 hardCap 까지 addBudget 자동 충전. stopOnDefendStreak: 챔피언 N회 연속 방어 시 수렴 정지(미지정=DEFAULT_DEFEND_STREAK).
export type TourEnvelope = {
  totalBudget?: number;
  targetDate?: string;
  autoRefill?: { addBudget: number; hardCap: number };
  stopOnDefendStreak?: number;
};

// 실 게재 자격증명 + 게재 스펙 (ADR-038 결정 3). 데모는 undefined — cron 폴러가 세션 없이 라운드를
// 게재·폴링하려면 유저 long-lived 토큰·계정·페이지와 타겟/링크/CTA 를 토너먼트에 박아둬야 한다.
// Supabase 가 진실의 원천이라 이 봉투째 jsonb 로 저장된다(서버 service-role 뒤).
export type TournamentDelivery = {
  accessToken: string;
  adAccountId: string; // act_ 프리픽스 포함 형태
  pageId: string;
  ownerEmail: string; // cron 이 SSE 푸시할 대상
  goalId?: string; // OBJECTIVES_PHASE1 id — 미지정 시 traffic 레거시 경로
  linkUrl: string;
  ctaType: string; // Meta call_to_action.type (예: LEARN_MORE)
  countries: string[];
  ageMin: number;
  ageMax: number;
  genders?: number[];
  roundDays: number; // 라운드당 실제 게재 기간 (MIN_ROUND_DAYS 이상)
  imageDataUrl?: string; // 공통 이미지 (axis≠image 라운드용)
};

export type Tournament = {
  id: string;
  brandProfileId: string;
  productId: string;
  productName: string;
  tone: string; // Gemini 톤 (warm|pro|trendy)
  objective: string; // ObjectiveId — Gemini outcome
  mode: TourMode;
  envelope?: TourEnvelope; // 자동 봉투 — 총예산·(선택)목표일. 소진 = winner-handling 브레이크(유일한 사람 결정)
  dailyBudget: number;
  champion: TourVariant; // 현 챔피언 크리에이티브
  championCtr: number; // 현 챔피언 CTR 기준선 (%)
  championSource?: "ai" | "existing"; // 출발 챔피언 출처 (undefined=ai 하위호환)
  championSourceName?: string; // existing 일 때 원본 캠페인명 (provenance 표기용)
  championConfirmed?: boolean; // 출발 광고 승인 결정 지점 통과 여부
  pendingChallenger?: TourVariant; // 결정 대기 중인 챌린저 제안 (게재 전)
  pendingHypothesis?: Hypothesis; // ADR-044 — pendingChallenger 와 짝인 가설 (게재 시 라운드로 이동)
  prohibitedWords?: string[]; // ADR-054 — 브랜드 금칙어. 챌린저 생성 Gemini 프롬프트에 주입해 구조 차단(브레이크 X)
  brandDescription?: string; // 셋업 시 고른 브랜드 컨텍스트 — 라운드별 Gemini 주입
  productDescription?: string; // 셋업 시 고른 제품 컨텍스트 — 라운드별 Gemini 주입
  variationIntensity?: VariationIntensity; // ADR-039 변형 폭 (토너먼트 상수, undefined=moderate)
  axisCursor: number; // 좌표상승 인덱스
  rounds: TourRound[];
  spentBudget: number; // 자동 봉투 누적
  status: "running" | "completed";
  completionReason?: "converged" | "budget-exhausted" | "cap-reached"; // ADR-061 — done 카드 sub-state. completed 종결 경로별 사유.
  createdAt: string;
  delivery?: TournamentDelivery; // 실 게재 봉투 (ADR-038). 데모는 undefined — 시뮬 경로
  lastError?: string; // ADR-053 — cron 라운드 게재 실패의 한국어 메시지. 있으면 자동 진행 중단 + 상세 배너
};

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

// id 생성 — 데모/실제 공용. 순수 함수라 서버 오케스트레이터·클라 store 양쪽이 쓴다.
export function newTournamentId(): string {
  return `tourn_${Math.random().toString(36).slice(2, 10)}`;
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

// 라운드 광고별 KPI 생성 (split test = 셀당 동일 예산). ffDays=0 이면 데이터 없음(insufficient).
// 목표별 결정 지표가 셀 간 차이를 갖도록 분기 (ADR-037 V2 / objective-metric.ts):
//   rate(traffic·engagement·leads_call) — 노출·예산 동일, action 비율(championCtr vs ×factor)만 갈림 → CPC/단가 emergent.
//   cpm(awareness)                      — 예산 동일, 노출 볼륨이 갈림(challenger factor>1 = 더 낮은 CPM=더 많은 노출).
// factorOverride 는 시드 시연용 — 라운드별 승부를 authoring 하려고 challengerFactor 대신 쓴다(실 runner 는 미사용).
// championCtr = 챔피언 기준선 (rate=비율% / cpm=CPM원). objective 는 trailing — 기존 호출부는 traffic 폴백.
export function roundAdKpis(
  round: TourRound,
  championCtr: number,
  dailyBudget: number,
  factorOverride?: number,
  objective = "traffic",
): [AdKpi, AdKpi] {
  const ff = Math.max(0, round.fastForwardDays);
  if (ff === 0) {
    return [
      { ctr: 0, impressions: 0, clicks: 0, spend: 0 },
      { ctr: 0, impressions: 0, clicks: 0, spend: 0 },
    ];
  }
  const factor = factorOverride ?? challengerFactor(round.campaignId, round.index);
  const pace = 0.86 + seededUnit(round.campaignId + "pace") * 0.1; // 86~96% 예산 소진 (현실 페이싱)
  const spendPerCell = Math.round(((dailyBudget * ff) / 2) * pace);

  if (tourMetricSpec(objective).kind === "cpm") {
    // 인지도 — 동일 예산에 노출(도달) 볼륨이 갈린다. cpmB = cpmA / factor (factor>1 → 낮은 CPM=우세).
    const cpmA = championCtr;
    const cpmB = championCtr / factor;
    const noise = 0.95 + seededUnit(round.campaignId + "i") * 0.1;
    const impFrom = (cpm: number) => (cpm > 0 ? Math.max(0, Math.round((spendPerCell / cpm) * 1000 * noise)) : 0);
    const NOMINAL_CTR = 0.6; // 결정 지표 아님 — 표시 일관성(클릭·CPC)용 명목값.
    const mk = (imp: number): AdKpi => ({
      impressions: imp,
      clicks: Math.max(0, Math.round((imp * NOMINAL_CTR) / 100)),
      ctr: NOMINAL_CTR,
      spend: spendPerCell,
    });
    return [mk(impFrom(cpmA)), mk(impFrom(cpmB))];
  }

  const imp = Math.round(BASE_DAILY_IMP_PER_AD * ff * (0.9 + seededUnit(round.campaignId + "i") * 0.2));
  const ctrA = championCtr;
  const ctrB = championCtr * factor;
  const clicksA = Math.max(0, Math.round((imp * ctrA) / 100));
  const clicksB = Math.max(0, Math.round((imp * ctrB) / 100));
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

// 노출 볼륨 차의 유의도 (awareness CPM 판정용). 2-표본 카운트 z 를 데모 캘리브레이션 상수로 감쇠 —
// 노출 수천 회면 raw z 가 포화(항상 유의)하므로, 실 Meta CPM 일변동 분산을 반영해 스프레드를 만든다.
const COUNT_TEST_DAMP = 10;
export function confidenceFromCountTest(impA: number, impB: number): number {
  if (impA <= 0 || impB <= 0) return 0.5;
  const se = Math.sqrt(impA + impB);
  if (se === 0) return 0.5;
  return stdNormalCdf(Math.abs(impB - impA) / (se * COUNT_TEST_DAMP));
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

// 판정 코어 (ADR-037) — KPI 두 셀 → verdict + 승격. 데모(시드 KPI)·실제(Meta insights) 공유.
// 목표별 결정 지표 (objective-metric.ts):
//   rate — 챌린저 CPLC/단가(=spend/action) 우위 + z-검정 유의 → "B" 승격. verdict ctrA/ctrB = action 비율%.
//   cpm  — 챌린저 CPM 우위 + 노출 카운트 유의 → "B" 승격. verdict ctrA/ctrB = CPM원.
// 그 외(챔피언 유의 승리·inconclusive) → "A" 방어. 노출 0/최소 게재 기간 미달이면 insufficient(결산 보류).
// objective 는 trailing — 기존 호출부는 traffic 폴백.
export function judgeRoundKpis(kpis: [AdKpi, AdKpi], elapsedDays: number, objective = "traffic"): SettleResult {
  const [a, b] = kpis;
  const cpm = tourMetricSpec(objective).kind === "cpm";
  const primaryA = cpm ? metricCpm(a) : a.ctr;
  const primaryB = cpm ? metricCpm(b) : b.ctr;
  if (a.impressions === 0 || b.impressions === 0 || elapsedDays < MIN_ROUND_DAYS) {
    return { kpis, verdict: { state: "insufficient", ctrA: primaryA, ctrB: primaryB, confidence: 0 }, rawWinner: "A" };
  }
  const confidence = cpm ? confidenceFromCountTest(a.impressions, b.impressions) : confidenceFromZTest(a, b);
  const significant = confidence >= WINNER_CONFIDENCE;
  // winner = 결정 지표가 우위인 셀 (rate=cost per action 낮음 / cpm=CPM 낮음). 유의할 때만 승격.
  const challengerWins = cpm
    ? primaryB < primaryA
    : (b.clicks > 0 ? b.spend / b.clicks : Infinity) < (a.clicks > 0 ? a.spend / a.clicks : Infinity);
  const rawWinner: "A" | "B" = significant && challengerWins ? "B" : "A";
  return {
    kpis,
    verdict: { state: significant ? "winner" : "inconclusive", ctrA: primaryA, ctrB: primaryB, confidence },
    rawWinner,
  };
}

// 데모 결산 — 시드 KPI 생성기(roundAdKpis)로 KPI 만든 뒤 judgeRoundKpis 로 판정. 실 경로는
// Meta KpiSource 가 만든 KPI 를 judgeRoundKpis 에 직접 넘긴다(서버 오케스트레이터).
export function settleRound(
  round: TourRound,
  championCtr: number,
  dailyBudget: number,
  factorOverride?: number,
  objective = "traffic",
): SettleResult {
  const kpis = roundAdKpis(round, championCtr, dailyBudget, factorOverride, objective);
  return judgeRoundKpis(kpis, round.fastForwardDays, objective);
}

function daysBetweenIso(start: string, end: string): number {
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (isNaN(s) || isNaN(e)) return Infinity;
  return Math.round((e - s) / 86400000);
}

// 봉투 소진 (ADR-054) — 자동: 누적 예산 또는 목표일 도달. 소진 시 winner-handling 브레이크로 surface.
export function isEnvelopeExhausted(t: Tournament): boolean {
  const env = t.envelope ?? {};
  if (env.totalBudget != null && t.spentBudget >= env.totalBudget) return true;
  if (env.targetDate) {
    const simDays = t.rounds.filter((r) => r.status === "settled").reduce((s, r) => s + r.fastForwardDays, 0);
    const budgetDays = daysBetweenIso(t.createdAt, env.targetDate + "T00:00:00+09:00");
    if (simDays >= budgetDays) return true;
  }
  return false;
}

/* ─── ADR-061 자동충전 + 수렴 정지 ──────────────────────────── */

// 챔피언 N회 연속 방어 = 수렴 정지 기본 횟수. 자동충전이 예산을 채워줘 "봉투 먼저 터짐"이 사라지므로 신뢰(N=2)를 택함.
export const DEFAULT_DEFEND_STREAK = 2;

// 결산된 라운드를 역순으로 훑어 챔피언(A) 연속 방어 횟수. insufficient(미결산)는 카운트하지 않고 건너뛴다(0 회수).
export function championDefendStreak(t: Tournament): number {
  let streak = 0;
  for (let i = t.rounds.length - 1; i >= 0; i--) {
    const r = t.rounds[i];
    if (r.status !== "settled" || r.verdict?.state === "insufficient") continue;
    if (r.rawWinner === "A") streak += 1;
    else break;
  }
  return streak;
}

// 수렴 정지 판정 — 챔피언 방어 streak 이 임계(envelope.stopOnDefendStreak ?? DEFAULT_DEFEND_STREAK) 이상.
export function hasConverged(t: Tournament): boolean {
  const n = t.envelope?.stopOnDefendStreak ?? DEFAULT_DEFEND_STREAK;
  return championDefendStreak(t) >= n;
}

// 자동충전 가능 여부 — autoRefill opt-in & 누적 지출이 hardCap 미만(닿으면 winner-handling 으로 사람에게 재-surface).
export function canAutoRefill(t: Tournament): boolean {
  const ar = t.envelope?.autoRefill;
  return !!ar && t.spentBudget < ar.hardCap;
}

// 사람이 종료 결정 시 사유 — autoRefill 켜고 hardCap 까지 쓴 종결은 "상한도달", 그 외 봉투소진은 "예산소진".
export function endCompletionReason(t: Tournament): "cap-reached" | "budget-exhausted" {
  const ar = t.envelope?.autoRefill;
  return ar && t.spentBudget >= ar.hardCap ? "cap-reached" : "budget-exhausted";
}

/* ─── ADR-054 무인 루프 비트 — 예산(winner-handling)만 사람 ──────────────── */

export type TourBeat =
  | "champion-review" // 출발 챔피언 확인 게이트 (existing 1회 확인 / 레거시 미확정). AI 부트스트랩은 자동 확정.
  | "auto-running" // 무인 진행 — 사람 개입 없음 (라운드 라이브·라운드 전환 모두)
  | "winner-handling" // 봉투 소진 — 돈 방향 결정이라 사람 처리 대기 (유일한 자동 정지점)
  | "done";

// 현재 상태 → 비트 (ADR-054). 완전 무인: 예산 소진(winner-handling)에서만 멈춘다.
// 금칙어는 생성 단계에서 구조 차단, 정체는 selectNextLever 가 다른 레버로 자동 돌파하므로 정지 비트가 없다.
// 우선순위: done > champion-review > winner-handling > 진행.
export function deriveBeat(t: Tournament): TourBeat {
  if (!t.championConfirmed) return "champion-review";
  if (t.status === "completed") return "done";
  if (isEnvelopeExhausted(t)) return "winner-handling";
  return "auto-running";
}

// 대시보드 "결정 대기" = 꼭 사람이 봐야 하는 비트만. ADR-054 — 예산(winner-handling)만.
// champion-review 는 existing 출발 광고 1회 확인 경로 보존용(AI 부트스트랩은 자동 확정이라 실제론 미발동).
export function isDecisionBeat(b: TourBeat): boolean {
  return b === "winner-handling" || b === "champion-review";
}

export function isRunningBeat(b: TourBeat): boolean {
  return b === "auto-running";
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
