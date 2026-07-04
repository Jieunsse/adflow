// 효율 단일 라인 진단 카드 — 듀얼축 폐기(좌/우 독립 스케일 착시 제거).
// 효율(성과/지출) 1급 라인 + 지출 저채도 배경 막대(강등, 축눈금/hover 없음).
// DualChart 골격(좌표 매핑·점·라벨)만 참고하되 우측 독립축은 의도적으로 부재.
import { Badge } from "@shared/ui/primitives";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";

export type TrendVerdict = "diverge" | "co-rise" | "co-fall" | "stable" | "insufficient";

export interface SpendPerfFlowCardProps {
  labels: string[];
  spend: number[];
  efficiency: (number | null)[];
  verdict: TrendVerdict;
  perfLabel: string;
  shortLabel: string;
  subtitle: string;
  midIndex: number;
  earlyAvg: number;
  lateAvg: number;
  divergeRange?: [number, number];
  isDemo?: boolean;
  loading?: boolean;
  enough?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
  onSeeCampaigns?: () => void;
}

const W = 800;
const H = 260;
const PAD_L = 16;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 28;
const INNER_W = W - PAD_L - PAD_R;
const INNER_H = H - PAD_T - PAD_B;

export default function SpendPerfFlowCard(props: SpendPerfFlowCardProps) {
  const {
    labels, spend, efficiency, verdict, perfLabel, shortLabel, subtitle,
    midIndex, earlyAvg, lateAvg, divergeRange, isDemo, loading, enough = true,
    emptyTitle, emptyDesc, onSeeCampaigns,
  } = props;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">지출 대비 성과 흐름</h2>
            {isDemo && <Badge kind="neutral" size="sm">예시</Badge>}
          </div>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-1">
          <span className="inline-flex items-center gap-1.5 font-medium text-[12px] leading-none text-[var(--w-fg-neutral)]">
            <span className="w-3.5 h-0.5 rounded-full bg-[var(--w-primary-normal)]" />
            효율 ({perfLabel})
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[12px] leading-none text-[var(--w-fg-alternative)]">
            <span className="w-3 h-3 rounded-[2px] bg-[var(--w-data-muted)]" />
            지출
          </span>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[260px] rounded-xl" />
      ) : !enough || verdict === "insufficient" ? (
        <div
          className="rounded-xl border border-dashed border-[var(--w-line-normal)] grid place-items-center text-center px-8"
          style={{ height: H }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-neutral)]">{emptyTitle ?? "성과 흐름이 모이는 중"}</div>
            <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-alternative)] max-w-[320px]">{emptyDesc ?? "광고가 며칠 더 게재되면 지출 대비 성과 흐름을 보여드려요."}</div>
          </div>
        </div>
      ) : (
        <FlowChart
          labels={labels}
          spend={spend}
          efficiency={efficiency}
          verdict={verdict}
          shortLabel={shortLabel}
          midIndex={midIndex}
          earlyAvg={earlyAvg}
          lateAvg={lateAvg}
          divergeRange={divergeRange}
        />
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onSeeCampaigns}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] hover:underline"
        >
          캠페인별로 자세히 보기 →
        </button>
      </div>
    </Card>
  );
}

function FlowChart({
  labels, spend, efficiency, verdict, shortLabel, midIndex, earlyAvg, lateAvg, divergeRange,
}: {
  labels: string[]; spend: number[]; efficiency: (number | null)[]; verdict: TrendVerdict;
  shortLabel: string; midIndex: number; earlyAvg: number; lateAvg: number; divergeRange?: [number, number];
}) {
  const n = efficiency.length;
  const effVals = efficiency.filter((v): v is number => v != null);
  const maxEff = Math.max(...effVals, earlyAvg, lateAvg, 0.1) * 1.2;
  const maxBar = Math.max(...spend, 1);
  const stepX = INNER_W / n;

  const yOf = (v: number) => PAD_T + INNER_H - (v / maxEff) * INNER_H;
  const xOf = (i: number) => PAD_L + stepX * i + stepX / 2;

  // 효율 라인 — null(광고 쉰 날)에서 끊는다.
  const segments: (readonly [number, number])[][] = [];
  let cur: (readonly [number, number])[] = [];
  efficiency.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else {
      cur.push([xOf(i), yOf(v)] as const);
    }
  });
  if (cur.length) segments.push(cur);

  const midX = PAD_L + stepX * midIndex;
  const bandX1 = divergeRange ? PAD_L + stepX * divergeRange[0] : 0;
  const bandX2 = divergeRange ? PAD_L + stepX * (divergeRange[1] + 1) : 0;

  const a11yDesc =
    verdict === "diverge"
      ? `지출 대비 성과 흐름 차트. 후반으로 갈수록 지출은 늘지만 ${shortLabel} 효율은 떨어지는 추세입니다.`
      : `지출 대비 성과 흐름 차트.`;

  const restingDay = efficiency.includes(null);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: "100%", height: H }}>
        <title>지출 대비 성과 흐름 차트</title>
        <desc>{a11yDesc}</desc>

        {[0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = PAD_T + INNER_H * (1 - t);
          return <line key={i} x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--w-line-alternative)" />;
        })}

        {/* 지출 배경 막대(강등) — 축눈금/hover 없음 */}
        {spend.map((v, i) => {
          const bw = stepX * 0.55;
          const bh = (v / maxBar) * INNER_H;
          const x = PAD_L + stepX * i + (stepX - bw) / 2;
          return <rect key={i} x={x} y={PAD_T + INNER_H - bh} width={bw} height={Math.max(0, bh)} rx="3" fill="var(--w-data-muted)" opacity="0.5" />;
        })}

        {/* 발산 밴드 */}
        {divergeRange && (
          <rect
            x={bandX1}
            y={PAD_T}
            width={Math.max(0, bandX2 - bandX1)}
            height={INNER_H}
            fill="var(--w-status-cautionary-soft)"
            stroke="var(--w-status-cautionary-line)"
            strokeDasharray="4 3"
          />
        )}

        {/* 전·후반 평균 가로 기준선 */}
        <line x1={PAD_L} y1={yOf(earlyAvg)} x2={midX} y2={yOf(earlyAvg)} stroke="var(--w-line-normal)" strokeDasharray="5 4" />
        <line x1={midX} y1={yOf(lateAvg)} x2={W - PAD_R} y2={yOf(lateAvg)} stroke="var(--w-line-normal)" strokeDasharray="5 4" />

        {/* mid 분할 수직선 */}
        <line x1={midX} y1={PAD_T} x2={midX} y2={PAD_T + INNER_H} stroke="var(--w-line-neutral)" strokeDasharray="3 3" />

        {/* 효율 라인(1급) — null 에서 끊김 */}
        {segments.map((seg, si) => (
          <path
            key={si}
            d={seg.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")}
            fill="none"
            stroke="var(--w-primary-normal)"
            strokeWidth="2.2"
          />
        ))}
        {efficiency.map((v, i) =>
          v == null ? null : (
            <circle key={i} cx={xOf(i)} cy={yOf(v)} r="3.4" fill="var(--w-common-100)" stroke="var(--w-primary-normal)" strokeWidth="2" />
          ),
        )}

        {labels.map((l, i) => (
          <text key={i} x={xOf(i)} y={H - 8} fontSize="11" fill="var(--w-fg-neutral)" textAnchor="middle" style={{ fontFamily: "var(--w-font-sans)", fontWeight: 500 }}>
            {l}
          </text>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {divergeRange && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--w-status-cautionary-soft)] font-semibold text-[11px] leading-none text-[var(--w-fg-normal)]">
            <span className="w-2 h-2 rounded-full bg-[var(--w-status-cautionary)]" />
            효율이 떨어지는 구간
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">
          <span className="w-3.5 h-px bg-[var(--w-line-normal)]" />
          앞 절반 평균 / 뒤 절반 평균
        </span>
        {restingDay && (
          <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">이 날은 광고를 쉬어서 효율이 없어요.</span>
        )}
      </div>
    </div>
  );
}
