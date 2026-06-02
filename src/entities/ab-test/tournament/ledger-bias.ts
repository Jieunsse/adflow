// PRD Ledger → /create 카피 훅 편향 (ADR-050) — 순수 편향 코어.
// 토너먼트가 검증한 가설(Hypothesis Ledger)을 읽어 /create 의 추천 카피 훅을 재배열한다.
// CopyLever===CopyHook(동일 union)이라 새 주입 메커니즘 없이 recommendedHooks 순서만 바꾼다.
// I/O·React·LLM 의존 0 → 격리 단위 테스트 대상(PRD §5). "use client" 없음(서버에서도 호출 가능).

import { recommendedHooks, type CopyHook, type ObjectiveId } from "@entities/creative/options";
import { COPY_LEVER_IDS, isCopyLever } from "./lever";
import type { Hypothesis } from "./engine";

// 한 카피 훅에 붙는 편향 신호 — UI 배지 메타. 중립(미탐색·미결)은 담지 않는다.
export type HookBias = {
  verdict: "confirmed" | "refuted";
  effectSize: number; // 입증=양수 lift%, 반증=음수
  tier: "product" | "brand"; // 1단(제품 전용) / 2단(브랜드 집계)
};

export type BiasedHooks = {
  hooks: [CopyHook, CopyHook, CopyHook]; // 본문 3개 — 입증 승격·반증 제외·backfill 적용. 항상 3개.
  bias: Partial<Record<CopyHook, HookBias>>; // 입증/반증 레버만. UI 배지·옅은 한 줄용.
};

type Agg = { confirmed: number[]; refuted: number[]; resolved: number };

// 한 층(제품 or 브랜드)의 resolved 카피 레버 가설을 레버별로 집계. effectSize 는 verdict 별로 모은다.
function aggregate(entries: Hypothesis[]): Map<CopyHook, Agg> {
  const m = new Map<CopyHook, Agg>();
  for (const h of entries) {
    if (h.status !== "resolved" || !isCopyLever(h.lever)) continue;
    const lever = h.lever;
    const a = m.get(lever) ?? { confirmed: [], refuted: [], resolved: 0 };
    a.resolved += 1;
    if (h.verdict === "confirmed") a.confirmed.push(h.effectSize ?? 0);
    else if (h.verdict === "refuted") a.refuted.push(h.effectSize ?? 0);
    m.set(lever, a);
  }
  return m;
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

type Decision = { kind: "confirmed" | "refuted" | "neutral"; bias?: HookBias };

// 한 레버의 verdict 결정 — 1단(제품)이 신호가 있으면 override, 없으면 2단(브랜드 집계)로 폴백.
// 제품: 순입증>0=입증 / <0=반증(제외) / ==0(동률·미결)=중립. 브랜드: 순입증>0 만 승격, 그 외 중립(제외 안 함).
function decide(lever: CopyHook, prod?: Agg, brand?: Agg): Decision {
  if (prod && prod.resolved > 0) {
    const net = prod.confirmed.length - prod.refuted.length;
    if (net > 0) return { kind: "confirmed", bias: { verdict: "confirmed", effectSize: avg(prod.confirmed), tier: "product" } };
    if (net < 0) return { kind: "refuted", bias: { verdict: "refuted", effectSize: avg(prod.refuted), tier: "product" } };
    return { kind: "neutral" };
  }
  if (brand && brand.confirmed.length - brand.refuted.length > 0) {
    return { kind: "confirmed", bias: { verdict: "confirmed", effectSize: avg(brand.confirmed), tier: "brand" } };
  }
  return { kind: "neutral" };
}

// 편향의 전부 — outcome 추천 3종을 기준으로, 2단 Ledger 를 읽어 입증 승격·반증 제외·중립 유지로 재배열한다.
// 본문은 항상 3개를 보장(반증 제외로 부족하면 나머지 카피훅에서 backfill).
export function ledgerBiasedHooks(
  outcome: ObjectiveId,
  ledger: { product: Hypothesis[]; brand: Hypothesis[] },
): BiasedHooks {
  const base = recommendedHooks(outcome); // 콜드스타트 기준 3종
  const baseIdx = (h: CopyHook) => {
    const i = base.indexOf(h);
    return i < 0 ? COPY_LEVER_IDS.length + COPY_LEVER_IDS.indexOf(h) : i; // base 우선, 그 외 taxonomy 순
  };
  const ordered = [...COPY_LEVER_IDS].sort((a, b) => baseIdx(a) - baseIdx(b)); // 8종, base 3 먼저

  const prodAgg = aggregate(ledger.product);
  const brandAgg = aggregate(ledger.brand);

  const bias: Partial<Record<CopyHook, HookBias>> = {};
  const confirmed: CopyHook[] = [];
  const neutral: CopyHook[] = [];
  const refuted: CopyHook[] = [];

  for (const lever of ordered) {
    const d = decide(lever, prodAgg.get(lever), brandAgg.get(lever));
    if (d.bias) bias[lever] = d.bias;
    if (d.kind === "confirmed") confirmed.push(lever);
    else if (d.kind === "refuted") refuted.push(lever);
    else neutral.push(lever);
  }

  // 입증 = effectSize 내림차순(동률은 base 순서 유지). 중립 = base 순서. 반증 = 제외.
  confirmed.sort((a, b) => (bias[b]!.effectSize - bias[a]!.effectSize) || (baseIdx(a) - baseIdx(b)));
  const live = [...confirmed, ...neutral];
  // backfill — 반증 과다로 3개 미만이면 반증 레버를 끝에서 채워 본문 3개 계약을 지킨다.
  const filled = [...live, ...refuted].slice(0, 3);

  return { hooks: [filled[0], filled[1], filled[2]], bias };
}
