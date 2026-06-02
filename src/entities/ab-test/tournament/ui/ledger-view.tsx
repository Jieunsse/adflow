"use client";

// ADR-044/050 — Hypothesis Ledger 표시 레이어. "신뢰 ✓ 입증" 칩이 추상적이던 문제를 풀기 위해
// 각 가설의 statement·effectSize(왜)·근거를 펼쳐 보여주는 상세 row + 집계 헬퍼.
// 토너먼트 상세(접힘 패널)와 브랜드 프로필 '학습' 탭(전체 아카이브) 두 곳이 공유한다.

import { Chip } from "@shared/ui/Chip";
import { leverLabel } from "../lever";
import type { Hypothesis, HypothesisVerdict } from "../engine";

export const VERDICT_META: Record<HypothesisVerdict, { label: string; mark: string; chip: "live" | "paused" | "neutral" }> = {
  confirmed: { label: "입증", mark: "✓", chip: "live" },
  refuted: { label: "반증", mark: "✗", chip: "paused" },
  inconclusive: { label: "미결", mark: "~", chip: "neutral" },
};

export const RATIONALE_SOURCE_LABEL: Record<Hypothesis["rationaleSource"], string> = {
  "brand-profile": "브랜드 프로필",
  persona: "페르소나",
  "performance-archive": "성과 아카이브",
  "platform-prior": "플랫폼 통계",
  ledger: "누적 학습",
  principle: "마케팅 원칙",
};

// "왜 입증/반증인지" — 실험 결과를 평문으로. effectSize 부호: 입증>0·반증<0·미결≈0 (resolveHypothesis).
function whyLine(h: Hypothesis): string {
  const m = h.predictedMetric;
  const e = h.effectSize;
  if (h.verdict === "confirmed")
    return `챌린저가 ${m} ${e != null ? `+${e}% ` : ""}끌어올려 — 가설이 맞았어요.`;
  if (h.verdict === "refuted")
    return `챌린저가 ${m} ${e != null ? `${e}% ` : ""}— 오히려 챔피언이 좋았어요.`;
  return `${m} 차이 ${e != null ? `±${Math.abs(e)}% ` : ""}— 결론을 보류했어요.`;
}

// 가설 한 건의 상세 — 레버·가설 문장·verdict·왜(실험 결과)·근거. 두 표면 공통 렌더러.
export function HypothesisDetailRow({ h }: { h: Hypothesis }) {
  const v = h.verdict ? VERDICT_META[h.verdict] : null;
  return (
    <div className="flex items-start gap-3 py-3 px-4 rounded-xl bg-[var(--w-bg-alternative)] border border-[var(--w-line-normal)]">
      <span className="text-[16px] leading-none mt-0.5">🔬</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Chip variant="neutral">{leverLabel(h.lever)}</Chip>
          <span className="font-bold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">{h.statement}</span>
          {v && (
            <Chip variant={v.chip} className="ml-auto">
              {v.mark} {v.label}
            </Chip>
          )}
        </div>
        <div className="font-semibold text-[12px] leading-[1.5] text-[var(--w-fg-strong)] mb-0.5">{whyLine(h)}</div>
        <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
          근거 〈{RATIONALE_SOURCE_LABEL[h.rationaleSource]}〉 · {h.rationale}
        </div>
      </div>
    </div>
  );
}

const VERDICT_ORDER: HypothesisVerdict[] = ["confirmed", "refuted", "inconclusive"];

// 같은 레버 재검증 시 최신 resolved 만 — 단일 맥락(토너먼트)의 "현재 지식" 상태.
export function latestResolvedByLever(entries: Hypothesis[]): Hypothesis[] {
  const byLever = new Map<string, Hypothesis>();
  for (const h of entries) if (h.verdict) byLever.set(h.lever, h);
  return [...byLever.values()].sort((a, b) => VERDICT_ORDER.indexOf(a.verdict!) - VERDICT_ORDER.indexOf(b.verdict!));
}

// 제품별 묶음 — 브랜드 전체 아카이브용. 제품 안에서 (레버+목표) 단위 최신본만.
export function latestByProduct(entries: Hypothesis[]): { productId: string; items: Hypothesis[] }[] {
  const groups = new Map<string, Map<string, Hypothesis>>();
  for (const h of entries) {
    if (!h.verdict) continue;
    const pid = h.contextTags.productId;
    if (!groups.has(pid)) groups.set(pid, new Map());
    groups.get(pid)!.set(`${h.lever}__${h.contextTags.objective}`, h);
  }
  return [...groups.entries()].map(([productId, m]) => ({
    productId,
    items: [...m.values()].sort((a, b) => VERDICT_ORDER.indexOf(a.verdict!) - VERDICT_ORDER.indexOf(b.verdict!)),
  }));
}

export function verdictCounts(entries: Hypothesis[]): Record<HypothesisVerdict, number> {
  const c: Record<HypothesisVerdict, number> = { confirmed: 0, refuted: 0, inconclusive: 0 };
  for (const h of entries) if (h.verdict) c[h.verdict]++;
  return c;
}
