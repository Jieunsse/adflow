"use client";

// "근거 지표" 레일 — 진단이 어디서 나왔는지 받쳐주는 우측 열.
// 지표 4개 + (목표 없으면) 목표 세우기 + 돈이 새는 단계.

import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { Skeleton } from "@shared/ui/Skeleton";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { fmt, fmtKRW } from "@shared/lib/format";
import { pickWorstDrop, type FunnelStage } from "@entities/insights/account-trend";

const CARD = "rounded-[var(--w-radius-12)] p-6";

export type EvidenceMetric = {
  label: string;
  value: string;
  /** 오른쪽 위 보조 표기 — 델타(색 있음) 또는 설명(회색) */
  note?: string;
  noteTone?: "positive" | "negative" | "neutral";
  valueTone?: "normal" | "cautionary" | "negative";
  caption?: string;
};

export type EvidenceRailProps = {
  loading: boolean;
  metrics: EvidenceMetric[];
  funnel: { stages: FunnelStage[]; hasData: boolean };
  funnelNote?: string;
  onFunnelStage: (key: FunnelStage["key"]) => void;
  /** 목표가 하나도 없을 때만 목표 세우기 카드를 낸다. */
  goalEmpty: boolean;
  onSetGoal: () => void;
};

const NOTE_COLOR = {
  positive: "var(--w-status-positive)",
  negative: "var(--w-status-negative)",
  neutral: "var(--w-fg-neutral)",
} as const;

const VALUE_COLOR = {
  normal: "var(--w-fg-strong)",
  cautionary: "var(--w-status-cautionary)",
  negative: "var(--w-status-negative)",
} as const;

export function EvidenceRail({
  loading,
  metrics,
  funnel,
  funnelNote,
  onFunnelStage,
  goalEmpty,
  onSetGoal,
}: EvidenceRailProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3">
        <h2 className="w-h2 m-0">근거 지표</h2>
      </div>

      {loading ? (
        <Skeleton className="h-[420px] rounded-2xl" />
      ) : (
        <Card className={`${CARD} grid grid-cols-2 gap-0 overflow-hidden p-0`}>
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className={cn(
                "flex min-h-32 flex-col gap-2 p-6",
                i % 2 === 1 && "border-l border-[var(--w-line-alternative)]",
                i >= 2 && "border-t border-[var(--w-line-alternative)]",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="w-caption">{m.label}</span>
                {m.note && (
                  <span className="w-caption font-semibold" style={{ color: NOTE_COLOR[m.noteTone ?? "neutral"] }}>
                    {m.note}
                  </span>
                )}
              </div>
              <span
                className="w-display-2 [font-variant-numeric:tabular-nums]"
                style={{ color: VALUE_COLOR[m.valueTone ?? "normal"] }}
              >
                {m.value}
              </span>
              {m.caption && <span className="w-caption">{m.caption}</span>}
            </div>
          ))}
        </Card>
      )}

      {goalEmpty && !loading && (
        <Card className={`${CARD} flex flex-col gap-3 items-start`}>
          <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)]">
            <Icon name="target" size={20} />
          </span>
          <span className="w-h4">목표를 세우면 더 정확해져요</span>
          <span className="w-caption">
            월 목표 매출과 마진율만 알려주시면, 매일 얼마를 써도 되는지 상한선을 계산해 드려요.
          </span>
          <Button variant="primary" size="md" type="button" block onClick={onSetGoal}>
            목표 세우기
          </Button>
        </Card>
      )}

      {!loading && funnel.hasData && (
        <Card className={`${CARD} flex flex-col gap-3.5`}>
          <span className="w-h4">돈이 새는 단계</span>
          <div className="flex flex-col gap-2.5">
            {funnel.stages.map((s) => (
              <LeakBar
                key={s.key}
                stage={s}
                leak={s.key === pickWorstDrop(funnel.stages)?.to.key}
                onClick={s.key !== "impressions" && s.measured ? () => onFunnelStage(s.key) : undefined}
              />
            ))}
          </div>
          {funnelNote && (
            <span className="w-caption">{funnelNote}</span>
          )}
        </Card>
      )}
    </div>
  );
}

function LeakBar({ stage, leak, onClick }: { stage: FunnelStage; leak: boolean; onClick?: () => void }) {
  // sqrt 스케일 — 노출 대비 %가 선형이면 클릭 아래가 전부 눌려 보이지 않는다(퍼널 특성상 항상 급감).
  const widthPct = Math.max(stage.value > 0 ? 4 : 0, Math.round(Math.sqrt(stage.pctOfImpressions) * 100));
  const color = leak ? "var(--w-status-negative)" : "var(--w-primary-normal)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={onClick ? `${stage.label} 단 기준으로 캠페인 정렬해서 보기` : undefined}
      className="flex items-center gap-2.5 w-full bg-transparent border-0 p-0 text-left enabled:cursor-pointer enabled:hover:opacity-80"
    >
      <span
        className="w-16 shrink-0 w-caption"
        style={{ color: leak ? "var(--w-status-negative)" : "var(--w-fg-neutral)", fontWeight: leak ? 700 : 500 }}
      >
        {stage.label}
      </span>
      {stage.measured ? (
        <span className="flex-1 h-2 rounded-full bg-[var(--w-bg-alternative)] overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${widthPct}%`, background: color }} />
        </span>
      ) : (
        <span className="flex-1 h-2 rounded-full border border-dashed border-[var(--w-line-normal)]" />
      )}
      <span
        className="w-16 shrink-0 text-right w-label [font-variant-numeric:tabular-nums]"
        style={{ color: leak ? "var(--w-status-negative)" : "var(--w-fg-strong)", fontWeight: leak ? 700 : 600 }}
      >
        {stage.measured ? fmt(stage.value) : "—"}
      </span>
    </button>
  );
}

/**
 * 가장 크게 새는 단계를 한 문장으로. 새는 지점이 없으면 문장을 만들지 않는다.
 * `loss` 가 아닐 때는 "손해의 대부분" 같은 단정을 붙이지 않는다.
 */
export function funnelLeakNote(stages: FunnelStage[], loss: boolean): string | undefined {
  const worst = pickWorstDrop(stages);
  if (!worst) return undefined;
  const head = `${worst.from.label} ${fmt(worst.from.value)} 중 ${fmt(worst.to.value)}만 ${worst.to.label}로 이어졌어요.`;
  return loss ? `${head} 이 한 단계가 이번 기간 손해의 대부분이에요.` : `${head} 여기가 가장 크게 줄어드는 지점이에요.`;
}

// ── 지표 4개 구성 — 화면이 아니라 여기서 한 번에 만든다(라벨·색 규칙의 단일 출처). ──

export function buildEvidenceMetrics(input: {
  roas: number | null;
  roasDeltaPct?: number;
  bep: number | null;
  conversionCount: number | null;
  revenue: number;
  revenueDeltaPct?: number;
  cpa: number | null;
  targetCpa: number | null;
}): EvidenceMetric[] {
  const out: EvidenceMetric[] = [];

  if (input.roas != null) {
    out.push({
      label: "ROAS",
      value: `${input.roas.toFixed(2)}x`,
      note: input.roasDeltaPct != null ? `${input.roasDeltaPct >= 0 ? "↗" : "↘"} ${Math.abs(input.roasDeltaPct).toFixed(1)}%` : undefined,
      noteTone: input.roasDeltaPct != null ? (input.roasDeltaPct >= 0 ? "positive" : "negative") : undefined,
      caption: input.bep != null ? `손익분기 ROAS는 ${input.bep.toFixed(2)}x예요` : undefined,
    });
  }

  if (input.conversionCount != null) {
    out.push({
      label: "전환수",
      value: fmt(input.conversionCount),
      note: "기간 누적",
    });
  }

  out.push({
    label: "전환매출",
    value: fmtKRW(input.revenue),
    note: input.revenueDeltaPct != null ? `${input.revenueDeltaPct >= 0 ? "↗" : "↘"} ${Math.abs(input.revenueDeltaPct).toFixed(1)}%` : undefined,
    noteTone: input.revenueDeltaPct != null ? (input.revenueDeltaPct >= 0 ? "positive" : "negative") : undefined,
  });

  if (input.cpa != null) {
    const over = input.targetCpa != null && input.cpa > input.targetCpa;
    out.push({
      label: "CPA",
      value: fmtKRW(Math.round(input.cpa)),
      note: input.targetCpa != null ? `손익분기 ${fmtKRW(input.targetCpa)}` : undefined,
      valueTone: over ? "cautionary" : "normal",
      caption: over ? `손익분기보다 ${fmtKRW(Math.round(input.cpa - input.targetCpa!))} 비싸요` : undefined,
    });
  }

  return out;
}
