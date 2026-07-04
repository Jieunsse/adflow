"use client";

// ADR-044/050 + PRD-learning-tab-lever-aggregate — 브랜드 프로필 '학습' 탭.
// 1순위 축을 제품→레버(키워드)로 뒤집어 "이 브랜드에서 어떤 방식이 통하나"를 한눈에 답한다(Ledger 세 번째 투영).
// 3층: (B)결론 헤드라인 + ①키워드 성과 리스트 + ②제품 칩→모달(기존 상세 row 재사용).

import { useState } from "react";
import Panel from "./Panel";
import Icon from "@shared/ui/Icon";
import { Chip } from "@shared/ui/Chip";
import { Callout } from "@shared/ui/Callout";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import { OBJECTIVES_ALL, type ObjectiveId } from "@entities/creative/options";
import {
  HypothesisDetailRow,
  latestByProduct,
  aggregateByLever,
  deriveLearningHeadline,
  formatLift,
  type LeverAggregate,
} from "@entities/ab-test/tournament/ui/ledger-view";
import type { Hypothesis } from "@entities/ab-test/tournament/tournament";
import type { Lever } from "@entities/ab-test/tournament/lever";

const VERDICT_RANK: Record<NonNullable<Hypothesis["verdict"]>, number> = {
  confirmed: 0,
  refuted: 1,
  inconclusive: 2,
};

function objectiveLabel(objective: string): string {
  return OBJECTIVES_ALL.find((o) => o.id === (objective as ObjectiveId))?.outcomeLabel ?? objective;
}

const CLASS_META: Record<LeverAggregate["klass"], { label: string; chip: "live" | "paused" | "neutral" }> = {
  works: { label: "통함", chip: "live" },
  neutral: { label: "중립", chip: "neutral" },
  backfires: { label: "안통함", chip: "paused" },
};

function LeverRow({
  agg,
  top,
  expanded,
  items,
  onToggle,
}: {
  agg: LeverAggregate;
  top: boolean;
  expanded: boolean;
  items: Hypothesis[];
  onToggle: () => void;
}) {
  const meta = CLASS_META[agg.klass];
  const liftText =
    agg.avgLift != null ? `${agg.liftMetricLabel} 평균 ${formatLift(agg.avgLift)}` : "미결";
  return (
    <div className="rounded-xl bg-[var(--w-bg-alternative)] border border-[var(--w-line-normal)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 py-2.5 px-4 text-left hover:bg-[var(--w-bg-neutral)] transition-colors"
      >
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
        <Icon
          name="chev-down"
          size={16}
          className={`shrink-0 text-[var(--w-fg-alternative)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
          {items.map((h) => (
            <HypothesisDetailRow key={h.id} h={h} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductModal({
  open,
  name,
  items,
  onClose,
}: {
  open: boolean;
  name: string;
  items: Hypothesis[];
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 560 }}>
        <div className="flex items-center justify-between">
          <DialogTitle className="m-0 font-bold text-[18px] leading-[1.3] tracking-[-0.016em] text-[var(--w-fg-strong)]">
            {name}
          </DialogTitle>
          <button type="button" onClick={onClose} className="p-1 text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {items.map((h) => (
            <HypothesisDetailRow key={h.id} h={h} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
  const [openLever, setOpenLever] = useState<Lever | null>(null);
  const [openHeadline, setOpenHeadline] = useState(false);

  const aggs = aggregateByLever(entries);
  const headline = deriveLearningHeadline(entries);
  const groups = latestByProduct(entries);
  const nameOf = (pid: string) => products.find((p) => p.id === pid)?.name ?? "삭제된 제품";
  const topLever = aggs.find((a) => a.klass === "works")?.lever ?? null;
  const openGroup = openProduct ? groups.find((g) => g.productId === openProduct) : null;
  const leverItems = (lever: Lever) =>
    entries
      .filter((h) => h.lever === lever && h.verdict)
      .sort((a, b) => VERDICT_RANK[a.verdict!] - VERDICT_RANK[b.verdict!]);

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
            topLever ? (
              <button
                type="button"
                onClick={() => setOpenHeadline((v) => !v)}
                aria-expanded={openHeadline}
                className="w-full text-left flex items-start gap-2.5 py-3.5 px-4 rounded-xl bg-[var(--w-primary-soft)] border border-[var(--w-line-normal)] hover:border-[var(--w-primary-normal)] transition-colors"
              >
                <span className="text-[16px] leading-none mt-0.5">💡</span>
                <p className="flex-1 m-0 font-bold text-[14px] leading-[1.5] tracking-[-0.006em] text-[var(--w-fg-strong)]">
                  {headline}
                </p>
                <Icon
                  name="chev-down"
                  size={16}
                  className={`shrink-0 mt-0.5 text-[var(--w-fg-alternative)] transition-transform ${openHeadline ? "rotate-180" : ""}`}
                />
              </button>
            ) : (
              <div className="flex items-start gap-2.5 py-3.5 px-4 rounded-xl bg-[var(--w-primary-soft)] border border-[var(--w-line-normal)]">
                <span className="text-[16px] leading-none mt-0.5">💡</span>
                <p className="m-0 font-bold text-[14px] leading-[1.5] tracking-[-0.006em] text-[var(--w-fg-strong)]">
                  {headline}
                </p>
              </div>
            )
          )}

          {topLever && openHeadline && (() => {
            const topAgg = aggs.find((a) => a.lever === topLever);
            if (!topAgg) return null;
            const items = leverItems(topLever);
            const refutedItems = items.filter((h) => h.verdict === "refuted");
            const backfires = aggs.find((a) => a.klass === "backfires");
            const productCount = new Set(items.map((h) => h.contextTags.productId)).size;
            const objectiveCount = new Set(items.map((h) => h.contextTags.objective)).size;
            const refutedContexts = [...new Set(refutedItems.map((h) => objectiveLabel(h.contextTags.objective)))];
            return (
              <div className="flex flex-col gap-2.5 px-1">
                <div className="flex items-baseline gap-2 flex-wrap bg-[var(--w-bg-alternative)] border border-[var(--w-line-normal)] rounded-lg py-2.5 px-3.5">
                  <span className="text-[12px] text-[var(--w-fg-neutral)]">
                    입증 <span className="font-bold text-[13px] text-[var(--w-fg-strong)]">{topAgg.confirmed}</span>건 / 전체{" "}
                    <span className="font-bold text-[13px] text-[var(--w-fg-strong)]">{topAgg.total}</span>건
                  </span>
                  <span className="text-[12px] text-[var(--w-fg-alternative)]">
                    ✓{topAgg.confirmed} · ✗{topAgg.refuted} · ~{topAgg.inconclusive}
                  </span>
                </div>

                {topAgg.confirmed <= 2 && (
                  <Callout tone="cautionary" size="sm" icon="info">
                    <span className="text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
                      아직 표본이 적어요 — 더 검증하면 확신이 올라가요.
                    </span>
                  </Callout>
                )}

                {refutedContexts.length > 0 ? (
                  <Callout tone="cautionary" size="sm" icon="info">
                    <span className="text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
                      단, &apos;{refutedContexts.join(", ")}&apos;에선 역효과였어요.
                    </span>
                  </Callout>
                ) : backfires ? (
                  <div className="flex items-center gap-2 text-[12.5px] text-[var(--w-fg-neutral)] px-1">
                    반대로 이 브랜드에서 안 통한 방식:
                    <Chip variant="paused">{backfires.label}</Chip>
                  </div>
                ) : null}

                <p className="m-0 text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] px-1">
                  검증한 맥락: 제품 {productCount}종 · 목표 {objectiveCount}종
                </p>
              </div>
            );
          })()}

          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-bold text-[13px] leading-[1.3] text-[var(--w-fg-neutral)]">키워드 성과</h3>
            {aggs.map((agg) => (
              <LeverRow
                key={agg.lever}
                agg={agg}
                top={agg.lever === topLever}
                expanded={openLever === agg.lever}
                items={leverItems(agg.lever)}
                onToggle={() => setOpenLever((cur) => (cur === agg.lever ? null : agg.lever))}
              />
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

      <ProductModal
        open={!!openGroup}
        name={openGroup ? nameOf(openGroup.productId) : ""}
        items={openGroup?.items ?? []}
        onClose={() => setOpenProduct(null)}
      />
    </Panel>
  );
}
