"use client";

// 일별 추이 차트 + 일별 상세 테이블.

import Icon from "@shared/ui/Icon";
import DualChart, { ChartLegend } from "@shared/ui/DualChart";
import { fmt, fmtKRW, shortDate } from "@shared/lib/format";
import type { Insights } from "./_types";

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
      <div className="card">
        <div className="between" style={{ marginBottom: 14 }}>
          <div>
            <h3 className="section-title">일별 추이</h3>
            <p className="section-sub">최근 {data.daily.length}일 클릭수와 CTR 변화</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <ChartLegend color="var(--w-primary-normal)" label="클릭수" type="bar" />
            <ChartLegend color="var(--w-accent-violet)" label="CTR" type="line" />
          </div>
        </div>
        <DualChart labels={labels} clicks={clicks} ctrs={ctrs} />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 22px 16px" }}>
          <h3 className="section-title" style={{ marginBottom: 4 }}>일별 상세</h3>
          <p className="section-sub" style={{ marginBottom: 0 }}>날짜별 핵심 지표 · 전일 대비 CTR 변화 포함</p>
        </div>
        <table className="dtable">
          <thead>
            <tr>
              <th>날짜</th>
              <th style={{ textAlign: "right" }}>클릭</th>
              <th style={{ textAlign: "right" }}>CTR</th>
              <th style={{ textAlign: "right" }}>지출</th>
              <th style={{ width: 96, textAlign: "right" }}>전일 대비</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((row, i) => {
              const prev = data.daily[i - 1];
              const delta = prev ? row.ctr - prev.ctr : null;
              const up = delta != null && delta > 0;
              const flat = delta != null && Math.abs(delta) < 0.01;
              return (
                <tr key={i} className="dtable__row">
                  <td style={{ font: "600 13px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{shortDate(row.date)}</td>
                  <td className="dtable__num">{fmt(row.clicks)}</td>
                  <td className="dtable__num">{row.ctr.toFixed(2)}%</td>
                  <td className="dtable__num">{fmtKRW(row.spend)}</td>
                  <td className="dtable__num">
                    {delta == null ? (
                      <span style={{ color: "var(--w-fg-alternative)" }}>—</span>
                    ) : flat ? (
                      <span style={{ color: "var(--w-fg-neutral)" }}>±0.00%p</span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: up ? "var(--w-status-positive)" : "var(--w-status-negative)" }}>
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
        <div style={{ padding: "12px 22px 18px" }}>
          <span className="field__hint">{exampleMode ? "예시 데이터" : "Meta 인사이트 기준 · 데이터는 몇 시간 단위로 갱신돼요"}</span>
        </div>
      </div>
    </>
  );
}
