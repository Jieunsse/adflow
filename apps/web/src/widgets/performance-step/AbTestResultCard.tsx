"use client";

// PRD-ab-testing.md §5 — A/B 결과 비교 카드. 순수 props 컴포넌트 (fetcher 분리).
// PerformanceStep + /campaigns/[id] 두 화면 공유.

import { useState } from "react";
import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { fmt, fmtKRW } from "@shared/lib/format";
import type { AbTestAxis } from "@entities/campaign/model";
import type { AbVerdict } from "@entities/insights/ab-verdict";

const AXIS_LABEL: Record<AbTestAxis, string> = {
  headline: "헤드라인",
  primary_text: "광고 카피",
  image: "이미지",
};

interface Props {
  axis: AbTestAxis;
  variantA: string;
  variantB: string;
  verdict: AbVerdict;
  // 우세 판정 시 [{우세안} 으로 새 캠페인] 클릭 — /create?prefill=campaign:{id}
  onCreateWithWinner?: () => void;
  // PRD-ab-testing.md §5.2 / §12 Q8 — 개발모드 chip 배지 + hover tooltip.
  demoMode?: boolean;
}

export default function AbTestResultCard({ axis, variantA, variantB, verdict, onCreateWithWinner, demoMode }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-4">
      <div className="flex justify-between items-center mb-3.5">
        <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">A/B 시험 결과 — {AXIS_LABEL[axis]}</h3>
        {demoMode && (
          <span
            title="라이브모드 전환 전에는 시뮬레이션 결과입니다"
            className="font-semibold text-[11px] leading-none text-[var(--w-fg-neutral)] bg-[var(--w-bg-alternative)] px-2 py-1 rounded-full border border-[var(--w-line-alternative)]"
          >
            데모 데이터
          </span>
        )}
      </div>

      {verdict.state === "insufficient" && <InsufficientBody verdict={verdict} />}
      {verdict.state === "inconclusive" && <InconclusiveBody axis={axis} />}
      {verdict.state === "winner" && (
        <WinnerBody
          axis={axis}
          variantA={variantA}
          variantB={variantB}
          verdict={verdict}
          expanded={expanded}
          setExpanded={setExpanded}
          onCreateWithWinner={onCreateWithWinner}
        />
      )}
    </Card>
  );
}

// PRD-ab-testing.md §5.4 — "데이터 더 쌓이는 중. 보통 7일 정도" + 진행 막대 (액션 X).
function InsufficientBody({ verdict }: { verdict: Extract<AbVerdict, { state: "insufficient" }> }) {
  const { reason, thresholds, current } = verdict;
  const minImp = thresholds.impressions;
  const minClicks = thresholds.clicks;
  // 두 광고 중 진척 더 작은 쪽을 막대로.
  const impProgress = Math.min(1, Math.min(current.a.impressions, current.b.impressions) / minImp);
  const clkProgress = Math.min(1, Math.min(current.a.clicks, current.b.clicks) / minClicks);
  return (
    <div>
      <p style={{ font: "500 13px/1.6 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: 0 }}>
        데이터 더 쌓이는 중. 보통 7일 정도 걸려요.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        <Bar label={`노출 ${fmt(Math.min(current.a.impressions, current.b.impressions))} / ${fmt(minImp)}`} progress={impProgress} highlight={reason === "impressions"} />
        <Bar label={`클릭 ${fmt(Math.min(current.a.clicks, current.b.clicks))} / ${fmt(minClicks)}`} progress={clkProgress} highlight={reason === "clicks"} />
      </div>
    </div>
  );
}

function Bar({ label, progress, highlight }: { label: string; progress: number; highlight: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ font: "500 12.5px/1 var(--w-font-sans)", color: highlight ? "var(--w-fg-strong)" : "var(--w-fg-neutral)" }}>{label}</span>
      </div>
      <div style={{ height: 6, background: "var(--w-bg-alternative)", borderRadius: 999 }}>
        <div
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: "100%",
            background: highlight ? "var(--w-accent-violet)" : "var(--w-line-normal)",
            borderRadius: 999,
            transition: "width 240ms ease",
          }}
        />
      </div>
    </div>
  );
}

// PRD-ab-testing.md §5.4 v0.2 Q2 — 차이 미미 = 액션 버튼 없음, 안내만.
function InconclusiveBody({ axis }: { axis: AbTestAxis }) {
  return (
    <p style={{ font: "500 13px/1.7 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: 0 }}>
      두 광고 비슷해요. {AXIS_LABEL[axis]}은(는) 큰 영향이 아닐 수 있어요.<br />
      조금 더 기다리거나 새 캠페인을 자유롭게 시작해 보세요.
    </p>
  );
}

function WinnerBody({
  axis, variantA, variantB, verdict, expanded, setExpanded, onCreateWithWinner,
}: {
  axis: AbTestAxis;
  variantA: string;
  variantB: string;
  verdict: Extract<AbVerdict, { state: "winner" }>;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  onCreateWithWinner?: () => void;
}) {
  const winnerLabel = verdict.winner === "A" ? "A안" : "B안";
  const ratio = Math.round(verdict.ratio * 10) / 10;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Panel label="A안" winner={verdict.winner === "A"} axis={axis} variant={variantA} kpi={verdict.a} />
        <Panel label="B안" winner={verdict.winner === "B"} axis={axis} variant={variantB} kpi={verdict.b} />
      </div>

      <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg bg-[var(--w-primary-soft)] mb-3">
        <p className="font-semibold text-[13px] leading-[1.6] text-[var(--w-fg-strong)] m-0">
          💡 {winnerLabel}이 CTR {ratio}배 더 높아요.
        </p>
        <p className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-normal)] mt-1 mb-0">
          다음 캠페인을 {winnerLabel} {AXIS_LABEL[axis]}(으)로 만드시겠어요?
          만든 캠페인은 검토 후 직접 집행 버튼을 눌러야 시작돼요.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {onCreateWithWinner && (
          <Button variant="primary" size="sm" onClick={onCreateWithWinner}>
            <Icon name="sparkles" size={13} /> {winnerLabel}(으)로 새 캠페인 만들기
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? "접기" : "상세 보기"} <Icon name="chev-down" size={12} style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 160ms ease" }} />
        </Button>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, padding: 12, background: "var(--w-bg-alternative)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", font: "500 12.5px/1.5 var(--w-font-sans)" }}>
            <thead>
              <tr style={{ color: "var(--w-fg-neutral)" }}>
                <th style={{ textAlign: "left", padding: "6px 0" }}>지표</th>
                <th style={{ textAlign: "right", padding: "6px 0" }}>A안</th>
                <th style={{ textAlign: "right", padding: "6px 0" }}>B안</th>
              </tr>
            </thead>
            <tbody style={{ color: "var(--w-fg-strong)" }}>
              <DetailRow label="CTR" a={`${verdict.a.ctr.toFixed(2)}%`} b={`${verdict.b.ctr.toFixed(2)}%`} />
              <DetailRow label="클릭" a={fmt(verdict.a.clicks)} b={fmt(verdict.b.clicks)} />
              <DetailRow label="노출" a={fmt(verdict.a.impressions)} b={fmt(verdict.b.impressions)} />
              <DetailRow label="지출" a={fmtKRW(verdict.a.spend)} b={fmtKRW(verdict.b.spend)} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Panel({ label, winner, axis, variant, kpi }: {
  label: string;
  winner: boolean;
  axis: AbTestAxis;
  variant: string;
  kpi: { ctr: number; clicks: number; impressions: number; spend: number };
}) {
  return (
    <div
      style={{
        padding: 12,
        border: `1.5px solid ${winner ? "var(--w-accent-violet)" : "var(--w-line-normal)"}`,
        background: winner ? "rgba(101,65,242,0.04)" : "var(--w-bg-normal)",
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ font: "700 13px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{label}</span>
        {winner && <span style={{ font: "700 13px/1 var(--w-font-sans)", color: "var(--w-accent-violet)" }}>⭐</span>}
      </div>
      <PanelContent axis={axis} variant={variant} />
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        <KpiRow label="CTR" value={`${kpi.ctr.toFixed(2)}%`} />
        <KpiRow label="클릭" value={fmt(kpi.clicks)} />
        <KpiRow label="노출" value={fmt(kpi.impressions)} />
        <KpiRow label="지출" value={fmtKRW(kpi.spend)} />
      </div>
    </div>
  );
}

// PRD-ab-testing.md §5.3 — 축별 좌·우 패널.
function PanelContent({ axis, variant }: { axis: AbTestAxis; variant: string }) {
  if (axis === "image") {
    return (
      <div>
        <img
          src={variant}
          alt=""
          style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 6, background: "var(--w-bg-alternative)" }}
        />
      </div>
    );
  }
  if (axis === "primary_text") {
    const short = variant.length > 80 ? variant.slice(0, 80) + "…" : variant;
    return <p style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: 0 }}>{short}</p>;
  }
  return <p style={{ font: "600 13.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: 0 }}>&ldquo;{variant}&rdquo;</p>;
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ font: "500 12px/1.4 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>{label}</span>
      <span style={{ font: "600 12.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{value}</span>
    </div>
  );
}

function DetailRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", color: "var(--w-fg-neutral)" }}>{label}</td>
      <td style={{ padding: "6px 0", textAlign: "right" }}>{a}</td>
      <td style={{ padding: "6px 0", textAlign: "right" }}>{b}</td>
    </tr>
  );
}
