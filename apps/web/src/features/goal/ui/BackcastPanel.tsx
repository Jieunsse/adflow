"use client";

// 역산 지도 — 후행 목표 1개에서 뻗어 나온 선행지표 4개. 목표 세우기 위저드의 오른쪽 판.
// 어두운 판이라 전경색은 전부 on-narrative 토큰(테마가 뒤집혀도 대비가 유지된다).

import type { BackcastKind, BackcastMap, BackcastRow } from "@entities/insights/backcast";
import type { GoalMetric } from "@entities/insights/goal";
import { fmt, fmtKRW } from "@shared/lib/format";

export function fmtLagValue(metric: GoalMetric, value: number | null): string {
  if (value == null) return "—";
  return metric === "cpa" ? fmtKRW(Math.round(value)) : value.toFixed(1);
}

export function lagUnit(metric: GoalMetric): string {
  return metric === "cpa" ? "" : "x";
}

export function lagMetricLabel(metric: GoalMetric): string {
  if (metric === "cpa") return "CPA";
  if (metric === "contribution") return "공헌이익 흑자";
  return "ROAS";
}

export function fmtBackcastValue(kind: BackcastKind, value: number | null): string {
  if (value == null) return "—";
  if (kind === "ctr") return `${value.toFixed(1)}%`;
  if (kind === "cvr") return `${(value * 100).toFixed(1)}%`;
  return `${fmt(Math.round(value))}원`;
}

const SHORT_LABEL: Record<BackcastKind, string> = { ctr: "CTR", cvr: "CVR", aov: "AOV", cpc: "CPC" };

export function backcastShortLabel(kind: BackcastKind): string {
  return SHORT_LABEL[kind];
}

/** 델타가 좋은 방향인지 — 클릭당 비용은 내려가야 좋다. */
export function isGoodDelta(row: BackcastRow): boolean | null {
  if (row.current == null || row.target == null) return null;
  const up = row.target > row.current;
  return up === row.betterUp;
}

export function BackcastPanel({
  map,
  statusLabel,
  statusTone = "muted",
  empty = false,
  note,
  footer,
}: {
  map: BackcastMap;
  /** 헤더 오른쪽 상태 문구 — "아직 비어 있어요" · "가지 4개가 붙었어요" · "완성". */
  statusLabel: string;
  statusTone?: "muted" | "accent";
  /** 지표를 아직 안 고른 단계 — 실측이 있어도 지도를 비워 둔다. */
  empty?: boolean;
  /** 아래 안내 박스. footer 를 주면 그 자리를 대신 채운다. */
  note?: string;
  footer?: React.ReactNode;
}) {
  const hasLag = !empty && (map.lagTarget != null || map.lagCurrent != null);

  return (
    <div
      className="flex flex-col gap-5 p-7 sm:p-8 h-full min-h-0"
      style={{ background: "var(--w-surface-narrative)", color: "var(--w-on-narrative)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-[15px] leading-none">역산 지도</span>
        {statusTone === "accent" ? (
          <span
            className="inline-flex items-center h-[22px] px-2 rounded-md font-bold text-[11px] leading-none"
            style={{ background: "var(--w-on-narrative-primary-soft)", color: "var(--w-on-narrative-primary)" }}
          >
            {statusLabel}
          </span>
        ) : (
          <span className="font-semibold text-[12px] leading-none" style={{ color: "var(--w-on-narrative-alternative)" }}>
            {statusLabel}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-0" style={hasLag ? undefined : { opacity: 0.45 }}>
        <LagCard map={map} empty={!hasLag} />
        {/* 줄기 — 목표 카드에서 가지 척추까지. 세로 가운데는 lg:items-center 가 맞춰준다. */}
        <span className="hidden lg:block w-[38px] h-[1.5px] shrink-0" style={{ background: lineColor(hasLag) }} />
        <div className="relative flex-1 flex flex-col gap-2.5 lg:gap-3.5 lg:pl-10">
          {/* 척추 — 첫 줄 가운데(32px)부터 마지막 줄 가운데까지. 줄 높이가 바뀌어도 따라온다. */}
          <span
            className="hidden lg:block absolute left-0 top-8 bottom-8 w-[1.5px]"
            style={{ background: lineColor(hasLag) }}
          />
          {map.rows.map((row) => (
            <LeadRow key={row.kind} row={row} hasLag={hasLag} />
          ))}
        </div>
      </div>

      <div className="mt-auto">
        {footer ?? (
          note && (
            <div
              className="rounded-xl px-4 py-3.5 font-medium text-[13px] leading-[1.6] break-keep text-pretty"
              style={{ background: "var(--w-surface-narrative-raised)", color: "var(--w-on-narrative-neutral)" }}
            >
              {note}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function LagCard({ map, empty }: { map: BackcastMap; empty: boolean }) {
  const metricLabel = lagMetricLabel(map.metric);
  const target = map.lagTarget;
  const current = map.lagCurrent;

  if (empty) {
    return (
      <div
        className="lg:w-[174px] shrink-0 rounded-2xl p-[18px] border-[1.5px] border-dashed"
        style={{ borderColor: "var(--w-surface-narrative-line)", color: "var(--w-on-narrative-alternative)" }}
      >
        <div className="font-bold text-[11px] leading-none tracking-[0.02em]">후행 목표</div>
        <div className="mt-2 font-bold text-[15px] leading-none">미정</div>
        <div className="mt-1 font-extrabold text-[30px] leading-[1.1] tracking-[-0.03em]">—</div>
        <div className="mt-1.5 font-medium text-[12px] leading-[1.4]">지표를 고르면 채워져요</div>
      </div>
    );
  }

  return (
    <div
      className="lg:w-[174px] shrink-0 rounded-2xl p-[18px] text-white"
      style={{ background: "var(--w-on-narrative-primary)" }}
    >
      <div className="font-bold text-[11px] leading-none tracking-[0.02em] opacity-80">후행 목표</div>
      <div className="mt-2 font-bold text-[15px] leading-none">{metricLabel}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-extrabold text-[30px] leading-[1.05] tracking-[-0.03em] [font-variant-numeric:tabular-nums]">
          {target == null ? "?" : fmtLagValue(map.metric, target)}
        </span>
        <span className="font-semibold text-[15px] leading-none opacity-85">{lagUnit(map.metric)}</span>
      </div>
      <div className="mt-1.5 font-medium text-[12px] leading-[1.4] opacity-85">
        {current == null
          ? "실측이 아직 없어요"
          : map.liftPct == null
            ? `현재 ${fmtLagValue(map.metric, current)}${lagUnit(map.metric)} · 목표값 미정`
            : `현재 ${fmtLagValue(map.metric, current)}${lagUnit(map.metric)} · ${map.liftPct >= 0 ? "+" : "-"}${Math.abs(map.liftPct).toFixed(0)}%`}
      </div>
    </div>
  );
}

function lineColor(hasLag: boolean): string {
  return hasLag ? "var(--w-on-narrative-assistive)" : "var(--w-surface-narrative-line)";
}

function LeadRow({ row, hasLag }: { row: BackcastRow; hasLag: boolean }) {
  const measured = row.current != null;
  const good = isGoodDelta(row);

  // 후행 목표를 고르기 전에는 가지를 그리지 않는다 — 지도는 목표에서 뻗어 나오는 그림이라서.
  if (!hasLag) {
    return (
      <div className="relative h-16 rounded-xl border-[1.5px] border-dashed" style={{ borderColor: "var(--w-surface-narrative-line)" }}>
        <span
          className="hidden lg:block absolute -left-10 top-1/2 -translate-y-1/2 w-10 h-[1.5px]"
          style={{ background: "var(--w-surface-narrative-line)" }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2.5">
      {/* 가지 — 척추(컨테이너 왼쪽 끝)에서 이 줄의 세로 한가운데로. 줄이 몇 개든 스스로 맞는다. */}
      <span
        className="hidden lg:block absolute -left-10 top-1/2 -translate-y-1/2 w-10 h-[1.5px]"
        style={{ background: "var(--w-on-narrative-assistive)" }}
      />
      <span className="lg:hidden w-3.5 h-[1.5px] shrink-0" style={{ background: "var(--w-on-narrative-assistive)" }} />
      <div
        className="flex-1 min-w-0 h-16 px-4 rounded-xl flex items-center justify-between gap-3"
        style={{
          background: "var(--w-surface-narrative-raised)",
          boxShadow: "inset 0 0 0 1px var(--w-surface-narrative-line)",
        }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          {/* truncate = overflow hidden — leading-none 이면 한글 글립박스(1.2em)가 잘린다. */}
          <span className="font-bold text-[14px] leading-[1.3] truncate">{row.label}</span>
          <span
            className="font-medium text-[12px] leading-[1.4] [font-variant-numeric:tabular-nums] truncate"
            style={{ color: "var(--w-on-narrative-alternative)" }}
          >
            {!measured
              ? "실측이 아직 없어요"
              : row.target == null
                ? `현재 ${fmtBackcastValue(row.kind, row.current)}`
                : `${fmtBackcastValue(row.kind, row.current)} → ${fmtBackcastValue(row.kind, row.target)}`}
          </span>
        </div>
        <span
          className="font-bold text-[13px] leading-none shrink-0"
          style={{
            color:
              row.deltaLabel == null
                ? "var(--w-on-narrative-assistive)"
                : good === false
                  ? "var(--w-on-narrative-negative)"
                  : // 올려야 하는 지표는 강조색, 내려서 아끼는 비용은 절감색으로 구분한다.
                    row.betterUp
                    ? "var(--w-on-narrative-primary)"
                    : "var(--w-on-narrative-positive)",
          }}
        >
          {row.deltaLabel ?? "목표 —"}
        </span>
      </div>
    </div>
  );
}
