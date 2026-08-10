"use client";

// 대시보드 히어로 — "이번 주에 무슨 일이 있었나"를 문장으로 먼저 말하고, 숫자는 오른쪽에서 받친다.
// 어두운 판(--w-surface-narrative) 위라 전경색은 전부 on-narrative 토큰.

import { Skeleton } from "@shared/ui/Skeleton";
import { fmt, fmtKRW, fmtManwon, shortDate } from "@shared/lib/format";
import type { HeroNarrative } from "@entities/insights/action-queue";

export type DashboardHeroProps = {
  loading: boolean;
  narrative: HeroNarrative | null;
  /** 기간 라벨 — "7/27 – 8/2" */
  rangeLabel: string | null;
  periodLabel: string;
  /** 마진율 미입력 시 노출되는 CTA */
  onSetMargin: () => void;
};

const ROW = "flex items-baseline justify-between gap-3";

export function DashboardHero({ loading, narrative, rangeLabel, periodLabel, onSetMargin }: DashboardHeroProps) {
  if (loading) return <Skeleton className="h-[280px] rounded-[20px]" />;
  if (!narrative) return null;

  const { contribution, marginRevenue, revenue, spend, roas, bep, bepFillPct, conversionCount, cpa, supportLine } = narrative;
  const profitable = contribution != null && contribution >= 0;
  const amountColor = profitable ? "var(--w-on-narrative-positive)" : "var(--w-on-narrative-negative)";

  return (
    <section
      className="rounded-[20px] px-11 py-10 grid gap-12 items-center grid-cols-1 lg:grid-cols-[1.35fr_1fr]"
      style={{ background: "var(--w-surface-narrative)", color: "var(--w-on-narrative)" }}
    >
      <div className="flex flex-col gap-4">
        <span
          className="w-overline"
          style={{ color: "var(--w-on-narrative-alternative)" }}
        >
          {rangeLabel ? `${rangeLabel} · ` : ""}
          {periodLabel}
        </span>

        <h1
          className="w-display-2 m-0"
          style={{ color: "inherit", textWrap: "balance" }}
        >
          광고비 <span className="[font-variant-numeric:tabular-nums]">{fmtManwon(spend)}</span>을 써서
          <br />
          {marginRevenue != null ? (
            <>
              마진 <span className="[font-variant-numeric:tabular-nums]">{fmtManwon(marginRevenue)}</span>을 벌었어요.
              <br />
              <span style={{ color: amountColor }}>
                {fmtManwon(Math.abs(contribution ?? 0))}이 {profitable ? "남았어요." : "손해예요."}
              </span>
            </>
          ) : (
            <>
              매출 <span className="[font-variant-numeric:tabular-nums]">{fmtManwon(revenue)}</span>을 만들었어요.
              <br />
              <span style={{ color: "var(--w-on-narrative-alternative)" }}>남는 이익은 아직 몰라요.</span>
            </>
          )}
        </h1>

        {supportLine && (
          <p
            className="w-body m-0 max-w-[520px]"
            style={{ color: "var(--w-on-narrative-neutral)" }}
          >
            {supportLine}
          </p>
        )}
      </div>

      <div
        className="flex flex-col gap-3.5 rounded-2xl p-6"
        style={{ background: "var(--w-surface-narrative-raised)" }}
      >
        <div className={ROW}>
          <span className="font-medium text-[13px]" style={{ color: "var(--w-on-narrative-alternative)" }}>
            공헌이익
          </span>
          {contribution != null ? (
            <span className="font-bold text-[26px] leading-none [font-variant-numeric:tabular-nums]" style={{ color: amountColor }}>
              {contribution < 0 ? "−" : ""}
              {fmtKRW(Math.abs(contribution))}
            </span>
          ) : (
            <button
              type="button"
              onClick={onSetMargin}
              className="font-bold text-[15px] underline underline-offset-4 cursor-pointer bg-transparent border-0"
              style={{ color: "var(--w-on-narrative)" }}
            >
              마진율 넣기
            </button>
          )}
        </div>

        <div className="h-px" style={{ background: "var(--w-surface-narrative-line)" }} />

        <div className={ROW}>
          <span className="font-medium text-[13px]" style={{ color: "var(--w-on-narrative-alternative)" }}>
            ROAS {bep != null && "· 손익분기"}
          </span>
          <span className="font-bold text-[16px]">
            <span className="[font-variant-numeric:tabular-nums]">{roas.toFixed(2)}x</span>
            {bep != null && (
              <span className="font-medium" style={{ color: "var(--w-on-narrative-assistive)" }}>
                {" "}
                / {bep.toFixed(2)}x
              </span>
            )}
          </span>
        </div>

        {bepFillPct != null && (
          <div className="relative h-2 rounded-full" style={{ background: "var(--w-surface-narrative-fill)" }}>
            <div
              className="absolute left-0 top-0 h-2 rounded-full"
              style={{ width: `${bepFillPct}%`, background: amountColor }}
            />
            {/* 손익분기선 = 트랙의 끝. 넘으면 막대가 트랙을 가득 채운다. */}
            <div className="absolute left-full top-[-4px] w-0.5 h-4" style={{ background: "var(--w-on-narrative)" }} />
          </div>
        )}

        <div className={ROW}>
          <span className="font-medium text-[13px]" style={{ color: "var(--w-on-narrative-alternative)" }}>
            전환수 · CPA
          </span>
          <span className="font-bold text-[16px] [font-variant-numeric:tabular-nums]">
            {fmt(conversionCount)}건 · {fmtKRW(Math.round(cpa))}
          </span>
        </div>
      </div>
    </section>
  );
}

/** 전환 측정이 하나도 없는 계정 — 손익을 말할 수 없으니 트래픽까지만 말하고 멈춘다. */
export function DashboardHeroNoConversion({
  loading,
  spend,
  clicks,
  impressions,
  ctr,
  cpc,
  rangeLabel,
  periodLabel,
  onMeasure,
}: {
  loading: boolean;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  rangeLabel: string | null;
  periodLabel: string;
  onMeasure: () => void;
}) {
  if (loading) return <Skeleton className="h-[280px] rounded-[20px]" />;

  return (
    <section
      className="rounded-[20px] px-11 py-10 grid gap-12 items-center grid-cols-1 lg:grid-cols-[1.35fr_1fr]"
      style={{ background: "var(--w-surface-narrative)", color: "var(--w-on-narrative)" }}
    >
      <div className="flex flex-col gap-4">
        <span className="w-overline" style={{ color: "var(--w-on-narrative-alternative)" }}>
          {rangeLabel ? `${rangeLabel} · ` : ""}
          {periodLabel}
        </span>
        <h1 className="w-display-2 m-0" style={{ color: "inherit", textWrap: "balance" }}>
          광고비 <span className="[font-variant-numeric:tabular-nums]">{fmtManwon(spend)}</span>을 써서
          <br />
          클릭 <span className="[font-variant-numeric:tabular-nums]">{fmt(clicks)}</span>번을 만들었어요.
          <br />
          <span style={{ color: "var(--w-on-narrative-alternative)" }}>매출은 아직 알 수 없어요.</span>
        </h1>
        <p className="w-body m-0 max-w-[520px]" style={{ color: "var(--w-on-narrative-neutral)" }}>
          전환을 측정하는 캠페인이 없어서 손익을 계산하지 못했어요. 전환 측정을 설정하면 이 자리에 남긴 금액을 보여드려요.
        </p>
      </div>

      <div className="flex flex-col gap-3.5 rounded-2xl p-6" style={{ background: "var(--w-surface-narrative-raised)" }}>
        {(
          [
            ["노출", fmt(impressions)],
            ["클릭 · CTR", `${fmt(clicks)} · ${ctr.toFixed(2)}%`],
            ["CPC", fmtKRW(Math.round(cpc))],
          ] as const
        ).map(([label, value], i) => (
          <div key={label} className="flex flex-col gap-3.5">
            {i > 0 && <div className="h-px" style={{ background: "var(--w-surface-narrative-line)" }} />}
            <div className={ROW}>
              <span className="font-medium text-[13px]" style={{ color: "var(--w-on-narrative-alternative)" }}>
                {label}
              </span>
              <span className="font-bold text-[16px] [font-variant-numeric:tabular-nums]">{value}</span>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onMeasure}
          className="mt-1 h-10 rounded-[10px] font-semibold text-[14px] cursor-pointer border-0"
          style={{ background: "var(--w-primary-normal)", color: "var(--w-fg-on-color)" }}
        >
          전환 측정 붙이기
        </button>
      </div>
    </section>
  );
}

/** dailyCurrent 의 첫·마지막 날짜로 "7/27 – 8/2" 라벨을 만든다. */
export function heroRangeLabel(dates: string[]): string | null {
  if (dates.length === 0) return null;
  return `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}`;
}
