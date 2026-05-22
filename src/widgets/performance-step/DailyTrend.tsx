"use client";

// 일별 추이 차트 + 일별 상세 테이블.

import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import DualChart, { ChartLegend } from "@shared/ui/DualChart";
import { fmt, fmtKRW, shortDate } from "@shared/lib/format";
import type { Insights } from "@entities/insights/types";

interface Props {
  data: Insights;
  labels: string[];
  clicks: number[];
  ctrs: number[];
  exampleMode: boolean;
}

export default function DailyTrend({ data, labels, clicks, ctrs, exampleMode }: Props) {
  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div>
            <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">일별 추이</h3>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">최근 {data.daily.length}일 클릭수와 CTR 변화</p>
          </div>
          <div className="flex gap-3">
            <ChartLegend color="var(--w-primary-normal)" label="클릭수" type="bar" />
            <ChartLegend color="var(--w-accent-violet)" label="CTR" type="line" />
          </div>
        </div>
        <DualChart labels={labels} clicks={clicks} ctrs={ctrs} />
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-[22px] pt-5 pb-4">
          <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)] mb-1">일별 상세</h3>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mb-0">날짜별 핵심 지표 · 전일 대비 CTR 변화 포함</p>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left px-[14px] py-3 font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">날짜</th>
              <th className="text-right px-[14px] py-3 font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">클릭</th>
              <th className="text-right px-[14px] py-3 font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">CTR</th>
              <th className="text-right px-[14px] py-3 font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">지출</th>
              <th className="w-24 text-right px-[14px] py-3 font-semibold text-[11px] leading-none tracking-[0.06em] uppercase text-[var(--w-fg-neutral)] border-b border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]">전일 대비</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((row, i) => {
              const prev = data.daily[i - 1];
              const delta = prev ? row.ctr - prev.ctr : null;
              const up = delta != null && delta > 0;
              const flat = delta != null && Math.abs(delta) < 0.01;
              return (
                <tr key={i} className="group">
                  <td className="px-[14px] py-[14px] border-b border-[var(--w-line-alternative)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)] align-middle group-hover:bg-[var(--w-bg-neutral)] font-semibold">{shortDate(row.date)}</td>
                  <td className="px-[14px] py-[14px] border-b border-[var(--w-line-alternative)] align-middle group-hover:bg-[var(--w-bg-neutral)] text-right font-[500_13px/1] font-mono text-[var(--w-fg-strong)]">{fmt(row.clicks)}</td>
                  <td className="px-[14px] py-[14px] border-b border-[var(--w-line-alternative)] align-middle group-hover:bg-[var(--w-bg-neutral)] text-right font-[500_13px/1] font-mono text-[var(--w-fg-strong)]">{row.ctr.toFixed(2)}%</td>
                  <td className="px-[14px] py-[14px] border-b border-[var(--w-line-alternative)] align-middle group-hover:bg-[var(--w-bg-neutral)] text-right font-[500_13px/1] font-mono text-[var(--w-fg-strong)]">{fmtKRW(row.spend)}</td>
                  <td className="px-[14px] py-[14px] border-b border-[var(--w-line-alternative)] align-middle group-hover:bg-[var(--w-bg-neutral)] text-right font-[500_13px/1] font-mono text-[var(--w-fg-strong)]">
                    {delta == null ? (
                      <span className="text-[var(--w-fg-alternative)]">—</span>
                    ) : flat ? (
                      <span className="text-[var(--w-fg-neutral)]">±0.00%p</span>
                    ) : (
                      <span className="inline-flex items-center gap-1" style={{ color: up ? "var(--w-status-positive)" : "var(--w-status-negative)" }}>
                        <Icon name={up ? "trend-up" : "trend-down"} size={12} />
                        {(up ? "+" : "")}{delta.toFixed(2)}%p
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-[22px] py-3 pb-[18px]">
          <span className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]">{exampleMode ? "예시 데이터" : "Meta 인사이트 기준 · 데이터는 몇 시간 단위로 갱신돼요"}</span>
        </div>
      </Card>
    </>
  );
}
