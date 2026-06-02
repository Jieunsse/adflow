"use client";

// ADR-044/050 + PRD-learning-tab-lever-aggregate — 브랜드 프로필 '학습' 탭.
// 1순위 축을 제품→레버(키워드)로 뒤집어 "이 브랜드에서 어떤 방식이 통하나"를 한눈에 답한다(Ledger 세 번째 투영).
// 3층: (B)결론 헤드라인 + ①키워드 성과 리스트 + ②제품 칩→모달(기존 상세 row 재사용).

import { useState } from "react";
import Panel from "./Panel";
import Icon from "@shared/ui/Icon";
import { Chip } from "@shared/ui/Chip";
import {
  HypothesisDetailRow,
  latestByProduct,
  aggregateByLever,
  deriveLearningHeadline,
  formatLift,
  type LeverAggregate,
} from "@entities/ab-test/tournament/ui/ledger-view";
import type { Hypothesis } from "@entities/ab-test/tournament/tournament";

const CLASS_META: Record<LeverAggregate["klass"], { label: string; chip: "live" | "paused" | "neutral" }> = {
  works: { label: "통함", chip: "live" },
  neutral: { label: "중립", chip: "neutral" },
  backfires: { label: "안통함", chip: "paused" },
};

function LeverRow({ agg, top }: { agg: LeverAggregate; top: boolean }) {
  const meta = CLASS_META[agg.klass];
  const liftText =
    agg.avgLift != null ? `${agg.liftMetricLabel} 평균 ${formatLift(agg.avgLift)}` : "미결";
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-[var(--w-bg-alternative)] border border-[var(--w-line-normal)]">
      <span className="w-4 shrink-0 text-[13px] leading-none text-[var(--w-status-cautionary)]">
        {top ? "★" : ""}
      </span>
      <span className="font-bold text-[13.5px] leading-[1.4] text-[var(--w-fg-strong)] shrink-0">{agg.label}</span>
      <Chip variant={meta.chip}>{meta.label}</Chip>
      <span className="ml-auto flex items-center gap-2 font-semibold text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
        <span>{agg.confirmed}/{agg.total} 입증</span>
        <span className="text-[var(--w-fg-alternative)]">·</span>
        <span className={agg.klass === "works" ? "text-[var(--w-status-positive)]" : agg.klass === "backfires" ? "text-[var(--w-status-cautionary)]" : ""}>
          {liftText}
        </span>
      </span>
    </div>
  );
}

function ProductModal({
  name,
  items,
  onClose,
}: {
  name: string;
  items: Hypothesis[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-[var(--w-bg-elevated)] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="m-0 font-bold text-[18px] leading-[1.3] tracking-[-0.016em] text-[var(--w-fg-strong)]">
            {name}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((h) => (
            <HypothesisDetailRow key={h.id} h={h} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LearningSection({
  entries,
  products,
}: {
  entries: Hypothesis[];
  products: { id: string; name: string }[];
}) {
  const [openProduct, setOpenProduct] = useState<string | null>(null);

  const aggs = aggregateByLever(entries);
  const headline = deriveLearningHeadline(entries);
  const groups = latestByProduct(entries);
  const nameOf = (pid: string) => products.find((p) => p.id === pid)?.name ?? "삭제된 제품";
  const topLever = aggs.find((a) => a.klass === "works")?.lever ?? null;
  const openGroup = openProduct ? groups.find((g) => g.productId === openProduct) : null;

  return (
    <Panel
      title="학습"
      icon="sparkles"
      count={aggs.length}
      desc="A/B 테스트로 검증해 이 브랜드에 쌓인 방식이에요. 카피를 만들 때 추천 훅에도 반영돼요."
      bodyClassName="flex flex-col gap-5"
    >
      {aggs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--w-line-normal)] py-10 text-center font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)]">
          아직 검증된 가설이 없어요.
          <br />
          A/B 테스트(이기는 광고 찾기)를 돌리면 결과가 여기 쌓여요.
        </div>
      ) : (
        <>
          {headline && (
            <div className="flex items-start gap-2.5 py-3.5 px-4 rounded-xl bg-[var(--w-primary-soft)] border border-[var(--w-line-normal)]">
              <span className="text-[16px] leading-none mt-0.5">💡</span>
              <p className="m-0 font-bold text-[14px] leading-[1.5] tracking-[-0.006em] text-[var(--w-fg-strong)]">
                {headline}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-bold text-[13px] leading-[1.3] text-[var(--w-fg-neutral)]">키워드 성과</h3>
            {aggs.map((agg) => (
              <LeverRow key={agg.lever} agg={agg} top={agg.lever === topLever} />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-bold text-[13px] leading-[1.3] text-[var(--w-fg-neutral)]">제품별</h3>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.productId}
                  type="button"
                  onClick={() => setOpenProduct(g.productId)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] font-semibold text-[13px] text-[var(--w-fg-strong)] hover:border-[var(--w-primary-normal)] transition-colors"
                >
                  {nameOf(g.productId)}
                  <span className="inline-flex items-center px-[7px] py-[1px] rounded-full bg-[var(--w-bg-neutral)] font-semibold text-[11px] leading-none text-[var(--w-fg-neutral)]">
                    {g.items.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {openGroup && (
        <ProductModal name={nameOf(openGroup.productId)} items={openGroup.items} onClose={() => setOpenProduct(null)} />
      )}
    </Panel>
  );
}
