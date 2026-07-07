// "이기는 광고 찾기" 공유 시각 언어 — /ab-tests 목록·상세가 같은 진화 서사 어휘를 쓴다.
// 정직성 게이트: 궤적은 끝점 없음(open sparkline), "N라운드째"는 분모 없음, lift 는 목표 방향 보정.

import type { ReactNode } from "react";
import Icon from "@shared/ui/Icon";
import { roundAdKpis, AXIS_LABEL as TOUR_AXIS_LABEL, type Tournament, type TourRound } from "@entities/ab-test/tournament/tournament";
import { leverLabel } from "@entities/ab-test/tournament/lever";
import { tourMetricSpec, primaryDelta } from "@entities/ab-test/tournament/objective-metric";

export const FONT_MONO = "font-[family-name:var(--w-font-mono)]";
export const krw = (n: number) => `₩${(n || 0).toLocaleString("ko-KR")}`;

/* ─── 순수 helper (진화 지표) ─── */

export const settledRounds = (t: Tournament) => t.rounds.filter((r) => r.status === "settled");
export const settledCount = (t: Tournament) => settledRounds(t).length;
export const startCtrOf = (t: Tournament) => t.rounds[0]?.verdict?.ctrA ?? t.championCtr;

// 개선폭 — 목표 방향 보정 (rate=높을수록·cpm=낮을수록 우세).
export function liftOf(t: Tournament): number {
  const s = startCtrOf(t);
  return s > 0 ? (primaryDelta(tourMetricSpec(t.objective), t.championCtr, s) / s) * 100 : 0;
}

// 챔피언 지표 진화 궤적 — 출발 + 결산 라운드마다의 챔피언 값. 끝점 없음(정직성 게이트).
export function trajectory(t: Tournament): number[] {
  const pts = [startCtrOf(t)];
  for (const r of settledRounds(t)) {
    if (!r.verdict) continue;
    pts.push(r.rawWinner === "B" ? r.verdict.ctrB : r.verdict.ctrA);
  }
  pts[pts.length - 1] = t.championCtr; // 최종점은 현 챔피언으로 고정
  return pts;
}

// 라운드가 어느 레버/축을 검증했는지 — 가설 레버 우선, 없으면 축.
export function roundLabel(r: TourRound): string {
  return r.hypothesis ? leverLabel(r.hypothesis.lever) : TOUR_AXIS_LABEL[r.axis];
}

// 누적 지출 — 결산 라운드는 저장 KPI, 진행 중은 즉석 산출.
export function tournamentSpend(t: Tournament): number {
  let spend = 0;
  for (const r of t.rounds) {
    const k = r.status === "settled" ? r.adKpis : r.fastForwardDays > 0 ? roundAdKpis(r, t.championCtr, t.dailyBudget, undefined, t.objective) : undefined;
    if (k) spend += k[0].spend + k[1].spend;
  }
  return spend;
}

/* ─── 라인 아이콘 (shared Icon 미보유분, icons.jsx 1.7 stroke 이식) ─── */

type SvgIconProps = { size?: number; strokeWidth?: number };
function svgWrap(size: number, sw: number, children: ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
export function TrophyIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M17 5h2.5a1.5 1.5 0 0 1 0 5H17M7 5H4.5a1.5 1.5 0 0 0 0 5H7" /><path d="M12 13v3M9 20h6M10 16h4l.5 4h-5l.5-4Z" /></>);
}
export function SwordsIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <path d="M14.5 17.5 4 21l3.5-10.5M3 5l4 4M21 5l-4 4M9.5 6.5 6 3 3 6l3.5 3.5M19 21l-3.5-3.5" />);
}
// 멈춤 — 끊긴 플러그. 일부러 스피너/펄스가 아님("살아 있음" 금지).
export function PlugOffIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <path d="M18.36 6.64 12 13M2 22l3.5-3.5M9 9l-.5.5a4 4 0 0 0 0 5.66l.5.5 5.5-5.5M14.5 7.5 20 2M16 8l1.5-1.5M9 5l-1.5 1.5" />);
}
export function FlaskIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <path d="M9 3h6M10 3v6.5L5 19a1.5 1.5 0 0 0 1.3 2.5h11.4A1.5 1.5 0 0 0 19 19l-5-9.5V3M7.5 14h9" />);
}
export function ShieldIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>);
}

/* ─── 미니 시각화 ─── */

// 챔피언 지표 궤적 스파크라인. 우상향=이기는 중. 끝점 없음(open=라이브).
export function Sparkline({ points, w = 132, h = 44, open = false, tone = "primary", fluid = false }: { points: number[]; w?: number; h?: number; open?: boolean; tone?: "primary" | "positive"; fluid?: boolean }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const pad = (max - min) * 0.25 || 0.1;
  const lo = min - pad, hi = max + pad;
  const px = 4, py = 6;
  const iw = w - px * 2, ih = h - py * 2;
  const X = (i: number) => px + (iw * i) / (points.length - 1);
  const Y = (v: number) => py + ih - (ih * (v - lo)) / (hi - lo);
  const line = points.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${X(points.length - 1).toFixed(1)} ${(h - py).toFixed(1)} L${px} ${(h - py).toFixed(1)} Z`;
  const stroke = tone === "positive" ? "var(--w-status-positive)" : "var(--w-primary-normal)";
  const fill = tone === "positive" ? "rgba(0,191,64,0.10)" : "rgba(0,102,255,0.09)";
  const last = points.length - 1;
  return (
    <svg width={fluid ? "100%" : w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio={fluid ? "none" : "xMidYMid meet"} style={{ display: "block", overflow: "visible" }}>
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {open && (
        <path d={`M${X(last).toFixed(1)} ${Y(points[last]).toFixed(1)} l 14 ${Y(points[last]) - Y(points[last - 1]) > 0 ? 4 : -4}`}
          fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 4" opacity="0.7" />
      )}
      {points.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r={i === last ? 3 : 2}
          fill={i === last ? stroke : "var(--w-bg-elevated)"} stroke={stroke} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// 라운드 노드 사다리. 승격(챌린저 승)=파랑 상승노드 / 방어(챔피언 유지)=중립 방패 / 라이브=파랑 VS 펄스.
export function Lineage({ rounds, compact = false }: { rounds: TourRound[]; compact?: boolean }) {
  const sz = compact ? 22 : 26;
  return (
    <div className="flex items-start">
      {rounds.map((r, i) => {
        const isWin = r.status === "settled" && r.rawWinner === "B";
        const isLive = r.status === "running";
        const isHold = r.status === "settled" && !isWin;
        let bg = "var(--w-primary-soft)", bd = "var(--w-primary-normal)", fg = "var(--w-primary-press)", ic: ReactNode = null;
        if (isWin) { bg = "var(--w-primary-normal)"; bd = "var(--w-primary-normal)"; fg = "#fff"; ic = <Icon name="trend-up" size={compact ? 12 : 13} />; }
        else if (isHold) { bg = "var(--w-bg-elevated)"; bd = "var(--w-line-strong)"; fg = "var(--w-fg-neutral)"; ic = <ShieldIcon size={compact ? 11 : 12} />; }
        else { ic = <span style={{ fontWeight: 800, fontSize: compact ? 9 : 10, letterSpacing: "-0.02em", lineHeight: 1 }}>VS</span>; }
        const prevLive = i > 0 && rounds[i - 1].status === "running";
        const connColor = i === 0 ? "transparent" : prevLive ? "var(--w-primary-normal)" : "var(--w-line-strong)";
        const tailColor = i === rounds.length - 1 ? "transparent" : isLive ? "var(--w-primary-normal)" : "var(--w-line-strong)";
        return (
          <div key={i} className="flex flex-col items-center flex-1 min-w-0">
            <div className="flex items-center w-full">
              <div className="h-0.5 flex-1 rounded-sm" style={{ background: connColor }} />
              <div className="grid place-items-center shrink-0 relative rounded-full" style={{ width: sz, height: sz, background: bg, border: `1.5px solid ${bd}`, color: fg }}>
                {ic}
                {isLive && <span className="absolute -inset-1 rounded-full border-[1.5px] border-[var(--w-primary-normal)] opacity-40 animate-ping" />}
              </div>
              <div className="h-0.5 flex-1 rounded-sm" style={{ background: tailColor }} />
            </div>
            {!compact && (
              <>
                <div className={`${FONT_MONO} text-[11px] font-bold text-[var(--w-fg-alternative)] mt-1.5`}>R{r.index}</div>
                <div className="text-[11px] font-semibold mt-px leading-[1.2] text-center text-[var(--w-fg-neutral)]">
                  {isLive ? "겨루는 중" : roundLabel(r)}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LiftBadge({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const sm = size === "sm";
  const up = value >= 0;
  const col = up ? "var(--w-status-positive)" : "var(--w-status-negative)";
  const bg = up ? "rgba(0,191,64,0.10)" : "var(--w-status-negative-soft)";
  return (
    <span className={`${FONT_MONO} inline-flex items-center font-bold whitespace-nowrap rounded-full`}
      style={{ gap: sm ? 3 : 4, fontSize: sm ? 11 : 12.5, lineHeight: 1, padding: sm ? "4px 8px" : "5px 10px", background: bg, color: col }}>
      <Icon name="trend-up" size={sm ? 11 : 13} /> {up ? "+" : ""}{Math.round(value)}%
    </span>
  );
}

// CTR 전이 "1.95% → 2.42%"
export function CtrTrack({ from, to }: { from: string; to: string }) {
  return (
    <span className={`${FONT_MONO} inline-flex items-center gap-[7px] font-bold text-[13px] text-[var(--w-fg-strong)]`}>
      <span className="text-[var(--w-fg-alternative)]">{from}</span>
      <Icon name="arrow-right" size={13} />
      <span>{to}</span>
    </span>
  );
}
