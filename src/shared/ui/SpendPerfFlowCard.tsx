// 효율 단일 라인 진단 카드 — 듀얼축 폐기(좌/우 독립 스케일 착시 제거).
// 효율(성과/지출) 1급 라인 + 지출 저채도 배경 막대(강등, 축눈금/hover 없음).
// DualChart 골격(좌표 매핑·점·라벨)만 참고하되 우측 독립축은 의도적으로 부재.
import { Chip } from "@shared/ui/Chip";
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
            {isDemo && <Chip variant="neutral" size="sm">예시</Chip>}
          </div>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-1">
          <span className="inline-flex items-center gap-1.5 font-medium text-[12px] leading-none text-[var(--w-fg-neutral)]">
            <span className="w-3.5 h-0.5 rounded-full bg-[var(--w-accent-violet)]" />
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
            <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)] max-w-[320px]">{emptyDesc ?? "광고가 며칠 더 게재되면 지출 대비 성과 흐름을 보여드려요."}</div>
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

// 세그먼트 점들을 부드러운 곡선(카디널 스플라인 → 베지어)으로 잇는다. 직선 꺾임 대신 완만한 흐름.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x} ${pts[0].y}` : "";
  const d = [`M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
  }
  return d.join(" ");
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

  // 효율 라인 — null(광고 쉰 날)에서 끊는다. 단일 톤 + 부드러운 곡선으로 정리(구간별 적/청 대비 제거).
  const LINE_COLOR = "var(--w-accent-violet)";
  type Pt = { x: number; y: number; v: number };
  const segments: Pt[][] = [];
  let cur: Pt[] = [];
  efficiency.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else {
      cur.push({ x: xOf(i), y: yOf(v), v });
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
        <defs>
          <linearGradient id="flowAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.16" />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = PAD_T + INNER_H * (1 - t);
          return <line key={i} x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--w-line-alternative)" strokeWidth="1" />;
        })}

        {/* 발산 밴드 — 둥근 하이라이트로 부드럽게 */}
        {divergeRange && (
          <rect
            x={bandX1}
            y={PAD_T}
            width={Math.max(0, bandX2 - bandX1)}
            height={INNER_H}
            rx="8"
            fill="var(--w-status-cautionary-soft)"
          />
        )}

        {/* 지출 배경 막대(강등) — 축눈금/hover 없음 */}
        {spend.map((v, i) => {
          const bw = stepX * 0.5;
          const bh = (v / maxBar) * INNER_H;
          const x = PAD_L + stepX * i + (stepX - bw) / 2;
          return <rect key={i} x={x} y={PAD_T + INNER_H - bh} width={bw} height={Math.max(0, bh)} rx="4" fill="var(--w-data-muted)" opacity="0.45" />;
        })}

        {/* mid 분할 수직선 */}
        <line x1={midX} y1={PAD_T} x2={midX} y2={PAD_T + INNER_H} stroke="var(--w-line-neutral)" strokeDasharray="3 3" />

        {/* 효율 라인(1급) — 세그먼트별 부드러운 곡선 + 아래 그라디언트 채움 */}
        {segments.map((seg, si) => (
          <path
            key={`fill-${si}`}
            d={`${smoothPath(seg)} L${seg[seg.length - 1].x.toFixed(1)} ${(PAD_T + INNER_H).toFixed(1)} L${seg[0].x.toFixed(1)} ${(PAD_T + INNER_H).toFixed(1)} Z`}
            fill="url(#flowAreaFill)"
          />
        ))}
        {segments.map((seg, si) => (
          <path key={`line-${si}`} d={smoothPath(seg)} fill="none" stroke={LINE_COLOR} strokeWidth="2.5" strokeLinecap="round" />
        ))}
        {segments.map((seg, si) =>
          seg.map((p, i) => (
            <circle key={`${si}-${i}`} cx={p.x} cy={p.y} r="3.5" fill="var(--w-common-100)" stroke={LINE_COLOR} strokeWidth="2" />
          )),
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
          앞 절반 평균 {earlyAvg.toFixed(1)} → 뒤 절반 평균 {lateAvg.toFixed(1)}
        </span>
        {restingDay && (
          <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">이 날은 광고를 쉬어서 효율이 없어요.</span>
        )}
      </div>
    </div>
  );
}
