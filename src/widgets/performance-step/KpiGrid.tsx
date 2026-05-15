"use client";

import { KpiCard } from "@shared/ui/primitives";
import { fmt, fmtKRW } from "@shared/lib/format";
import type { Insights, CampaignObjective } from "./_types";

interface Props {
  objective: CampaignObjective;
  data: Insights;
  exampleMode: boolean;
  scenario: "good" | "poor";
  clicks: number[];
  ctrs: number[];
}

export default function KpiGrid({ objective, data, exampleMode, scenario, clicks, ctrs }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      {objective === "OUTCOME_AWARENESS" ? (
        <>
          <KpiCard label="도달" value={fmt(data.reach ?? 0)} delta={exampleMode ? "+9.2%" : undefined} up trend={clicks} />
          <KpiCard label="빈도" value={(data.frequency ?? 0).toFixed(2)} suffix="회" delta={exampleMode ? "+0.12" : undefined} up trend={ctrs} />
          <KpiCard label="CPM" value={fmtKRW(data.cpm ?? 0)} delta={exampleMode ? "−4.8%" : undefined} up trend={ctrs} color="var(--w-accent-violet)" />
          <KpiCard label="총 노출" value={fmt(data.impressions)} delta={exampleMode ? "+8.4%" : undefined} up trend={[120, 145, 162, 180, 175, 210, 225, 240, 268, 254, 285]} />
        </>
      ) : objective === "OUTCOME_ENGAGEMENT" ? (
        <>
          <KpiCard label="게시물 반응" value={fmt(data.postReaction ?? 0)} delta={exampleMode ? "+22.4%" : undefined} up trend={clicks} />
          <KpiCard label="댓글" value={fmt(data.postComment ?? 0)} delta={exampleMode ? "+18.0%" : undefined} up trend={ctrs} />
          <KpiCard label="공유" value={fmt(data.postShare ?? 0)} delta={exampleMode ? "+12.6%" : undefined} up trend={clicks} />
          <KpiCard label="페이지 좋아요 증가" value={fmt(data.pageLike ?? 0)} delta={exampleMode ? "+14" : undefined} up trend={ctrs} color="var(--w-accent-violet)" />
        </>
      ) : (
        <>
          <KpiCard label="총 노출수" value={fmt(data.impressions)} delta={exampleMode ? "+8.4%" : undefined} up trend={[120, 145, 162, 180, 175, 210, 225, 240, 268, 254, 285]} />
          <KpiCard label="총 클릭수" value={fmt(data.clicks)} delta={exampleMode ? "+12.1%" : undefined} up trend={clicks} />
          <KpiCard label="CTR" value={data.ctr.toFixed(2)} suffix="%" delta={exampleMode ? (scenario === "good" ? "+0.18%p" : "−0.34%p") : undefined} up={scenario === "good"} down={scenario === "poor"} trend={ctrs} />
          <KpiCard label="총 지출" value={fmtKRW(data.spend)} delta={exampleMode ? (scenario === "good" ? "−3.2%" : "+18.4%") : undefined} up={scenario === "good"} down={scenario === "poor"} trend={data.daily.map((x) => x.spend / 1000)} color="var(--w-accent-violet)" />
        </>
      )}
    </div>
  );
}
