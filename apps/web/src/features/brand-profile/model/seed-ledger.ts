"use client";

// 둘러보기 데모 전용 — '학습'(Ledger) 탭 목업 시드. 데모 토너먼트를 전부 돌려도 resolved 가설이
// 한두 건뿐이라 "표본이 적어요"에 걸려 시연이 안 되는 문제를 푼다(실 유저 경로는 토너먼트 sync 가 채움).
// appendResolved 가 id 멱등이라 토너먼트가 쌓은 엔트리와 충돌 없이 합쳐진다 — 데모 브랜드에서만 동작.

import { appendResolved } from "@entities/ab-test/tournament/ledger";
import { LEVER_HYPOTHESIS, type Lever } from "@entities/ab-test/tournament/lever";
import type { Hypothesis } from "@entities/ab-test/tournament/engine";

const DEMO_PROFILE_ID = "demo-greenroutine-001";

// [lever, productId, objective, metric, verdict, effectSize, source, personaId?]
type Row = [
  Lever,
  string,
  string,
  string,
  Hypothesis["verdict"],
  number,
  Hypothesis["rationaleSource"],
  string?,
];

const P = {
  cream: "demo-product-cream",
  serum: "demo-product-serum",
  toner: "demo-product-toner",
  cleanser: "demo-product-cleanser",
  pad: "demo-product-pad",
  ample: "browse_demo_tourn_ample",
};

// 그린루틴(비건 스킨케어) 브랜드 지식 — 신뢰가 1순위(CTR +25%·4건), 긴박감은 역효과.
const ROWS: Row[] = [
  // trust(신뢰) — works, CTR 평균 +25%
  ["trust", P.cream, "traffic", "CTR", "confirmed", 28, "brand-profile"],
  ["trust", P.serum, "traffic", "CTR", "confirmed", 24, "performance-archive"],
  ["trust", P.ample, "traffic", "CTR", "confirmed", 26, "persona", "demo-persona-002"],
  ["trust", P.toner, "traffic_page_visit", "CTR", "confirmed", 22, "ledger"],
  ["trust", P.cleanser, "traffic", "CTR", "inconclusive", 1, "platform-prior"],
  // number(숫자) — works
  ["number", P.cream, "traffic", "CTR", "confirmed", 20, "performance-archive"],
  ["number", P.ample, "traffic", "CTR", "confirmed", 16, "brand-profile"],
  // story(이야기) — works
  ["story", P.serum, "traffic", "CTR", "confirmed", 12, "brand-profile"],
  ["story", P.toner, "traffic", "CTR", "confirmed", 10, "persona", "demo-persona-001"],
  // benefit(혜택) — neutral
  ["benefit", P.cream, "traffic", "CTR", "confirmed", 9, "principle"],
  ["benefit", P.pad, "traffic", "CTR", "refuted", -8, "platform-prior"],
  // rush(긴박감) — backfires
  ["rush", P.ample, "traffic", "CTR", "refuted", -14, "principle"],
  ["rush", P.cream, "traffic", "CTR", "refuted", -9, "platform-prior"],
  // surprise(반전) — backfires
  ["surprise", P.serum, "traffic", "CTR", "refuted", -7, "brand-profile"],
];

function build(): Hypothesis[] {
  const base = Date.now() - 1000 * 60 * 60 * 24 * 7;
  return ROWS.map(([lever, productId, objective, metric, verdict, effectSize, source, personaId], i) => {
    const t = LEVER_HYPOTHESIS[lever];
    return {
      id: `demo-ledger-${lever}-${i}`,
      lever,
      statement: t.claim.replace("{metric}", metric),
      predictedMetric: metric,
      predictedDirection: "up",
      rationale: t.rationale,
      rationaleSource: source,
      contextTags: { productId, objective, ...(personaId ? { personaId } : {}) },
      status: "resolved",
      verdict,
      effectSize,
      resolvedAt: new Date(base + i * 1000 * 60 * 60 * 6).toISOString(),
    };
  });
}

// 데모 브랜드 프로필이면 목업 Ledger 를 멱등 주입한다(그 외 id 는 no-op).
export function seedDemoLedger(brandProfileId: string): void {
  if (typeof window === "undefined" || brandProfileId !== DEMO_PROFILE_ID) return;
  for (const h of build()) appendResolved(DEMO_PROFILE_ID, h);
}
