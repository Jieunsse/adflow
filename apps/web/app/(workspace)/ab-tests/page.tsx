"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { listTournaments, roundAdKpis, deriveBeat, isDecisionBeat, AXIS_LABEL as TOUR_AXIS_LABEL, TOURNAMENT_CHANGE_EVENT, type Tournament, type TourBeat, type TourRound } from "@entities/ab-test/tournament/tournament";
import { leverLabel } from "@entities/ab-test/tournament/lever";
import { tourMetricSpec, formatPrimary, primaryDelta } from "@entities/ab-test/tournament/objective-metric";
import { tournamentClient } from "@entities/ab-test/tournament/client";
import { seedTournamentDemo } from "@entities/ab-test/tournament/seed";
import PresenterTournamentListBar from "@widgets/presenter-fast-forward/tournament-list";

export default function AbTestsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const connected = !!(session?.adAccountName && session?.pageName);

  // ADR-033 — Browse Mode 시연: localStorage 토너먼트(흐름2)를 노출.
  const [demoTournaments, setDemoTournaments] = useState<Tournament[]>([]);
  useEffect(() => {
    if (!browseMode) return;
    const reload = () => setDemoTournaments(listTournaments());
    seedTournamentDemo(); // 비어 있으면 시연용 토너먼트 멱등 seed (흐름1 seedAutoPilotDemo 대칭)
    reload();
    window.addEventListener(TOURNAMENT_CHANGE_EVENT, reload);
    return () => window.removeEventListener(TOURNAMENT_CHANGE_EVENT, reload);
  }, [browseMode]);

  // ADR-038 섬2 — 실 유저: Supabase 토너먼트를 API 로 조회(소유분만). 데모 분기와 동일 대시보드.
  const realQ = useQuery({
    queryKey: ["tournaments", "real"],
    queryFn: () => tournamentClient(false).list(),
    enabled: !browseMode && connected,
    retry: false,
    refetchInterval: 30000, // 서버 cron 이 라운드를 진행하므로 주기적으로 최신화
  });

  if (browseMode) {
    return (
      <>
        <TournamentDashboard
          tournaments={demoTournaments}
          onOpen={(id) => router.push(`/ab-tests/${id}`)}
          onNew={() => router.push("/ab-tests/new")}
        />
        <PresenterTournamentListBar tournaments={demoTournaments} />
      </>
    );
  }

  // 미연결 실 유저 — 토너먼트는 실 Meta 게재 위에서만 돌아간다. 연결 유도.
  if (!connected) {
    return (
      <div className="px-12 py-9 pb-16 max-w-[760px] w-full mx-auto" data-screen-label="A/B 테스트">
        <Card className="py-12 px-8 flex flex-col items-center gap-3 text-center">
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center" }}>
            <Icon name="chart" size={24} />
          </div>
          <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)]">A/B 토너먼트를 시작하려면 계정 연결이 필요해요</div>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] max-w-[420px]">실제 Meta 광고 위에서 챔피언-챌린저 라운드를 돌려요. 광고 계정·페이지를 연결하면 토너먼트를 열 수 있어요.</div>
          <Button variant="primary" type="button" className="mt-2" onClick={() => router.push("/setup")}>계정 연결</Button>
        </Card>
      </div>
    );
  }

  if (realQ.isLoading) {
    return (
      <div className="px-12 py-9 pb-16 max-w-[1200px] w-full mx-auto" data-screen-label="A/B 테스트">
        <Card className="flex flex-col items-center gap-3 py-12 px-8">
          <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-7 h-7" />
          <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">불러오는 중…</div>
        </Card>
      </div>
    );
  }

  if (realQ.isError) {
    return (
      <div className="px-12 py-9 pb-16 max-w-[760px] w-full mx-auto" data-screen-label="A/B 테스트">
        <Card className="py-12 px-8 flex flex-col items-center gap-3 text-center">
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-bg-alternative)", color: "var(--w-fg-alternative)", display: "grid", placeItems: "center" }}>
            <Icon name="warn" size={24} />
          </div>
          <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)]">불러오지 못했어요</div>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] max-w-[420px]">{realQ.error instanceof Error ? realQ.error.message : "잠시 후 다시 시도해 주세요"}</div>
          <Button variant="secondary" type="button" className="mt-2" onClick={() => realQ.refetch()}>다시 시도</Button>
        </Card>
      </div>
    );
  }

  return (
    <TournamentDashboard
      tournaments={realQ.data ?? []}
      onOpen={(id) => router.push(`/ab-tests/${id}`)}
      onNew={() => router.push("/ab-tests/new")}
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   "이기는 광고 찾기" — /ab-tests 리디자인 (Claude Design 시안 이식).
   북극성: "맡겨둬 — 알아서 더 좋게 만들고 있어. 문제 생기면 부를게."
   세로 위계 ① 내 손이 필요한 것(멈춤·승자) > ② AI가 진화시키는 중 > ③ 끝낸 토너먼트.
   밀도 적응형(원칙 2): 행동 카드=압축 / 이해 카드=진화 서사 풍부.
   ════════════════════════════════════════════════════════════════ */

const krw = (n: number) => `₩${(n || 0).toLocaleString("ko-KR")}`;
const FONT_MONO = "font-[family-name:var(--w-font-mono)]";
const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n)}%`;

// 디자인 4상태로 토너먼트를 가른다. lastError(게재 실패) 가 최우선 — "AI 작동 중"이 아니라 "고장".
type AbState = "stopped" | "winner" | "running" | "completed";
function abState(t: Tournament): AbState {
  if (t.lastError) return "stopped"; // ADR-053 — cron 게재 실패. 자동 진행 멈춤.
  const b = deriveBeat(t);
  if (b === "done" || t.status === "completed") return "completed";
  if (isDecisionBeat(b)) return "winner"; // winner-handling(예산 소진) / champion-review
  return "running";
}

const settledRounds = (t: Tournament) => t.rounds.filter((r) => r.status === "settled");
const settledCount = (t: Tournament) => settledRounds(t).length;
const startCtrOf = (t: Tournament) => t.rounds[0]?.verdict?.ctrA ?? t.championCtr;
const liftOf = (t: Tournament) => {
  const s = startCtrOf(t);
  // 개선폭 — 목표 방향 보정 (rate=높을수록·cpm=낮을수록 우세).
  return s > 0 ? (primaryDelta(tourMetricSpec(t.objective), t.championCtr, s) / s) * 100 : 0;
};

// 챔피언 지표 진화 궤적 — 출발 + 결산 라운드마다의 챔피언 값. 끝점 없음(정직성 게이트).
function trajectory(t: Tournament): number[] {
  const pts = [startCtrOf(t)];
  for (const r of settledRounds(t)) {
    if (!r.verdict) continue;
    pts.push(r.rawWinner === "B" ? r.verdict.ctrB : r.verdict.ctrA);
  }
  pts[pts.length - 1] = t.championCtr; // 최종점은 현 챔피언으로 고정
  return pts;
}

// "N라운드째" — 결산 + 라이브 1. 분모 없는 진화 표현(R3/3 금지).
function roundsSoFar(t: Tournament): number {
  return settledCount(t) + (t.rounds.some((r) => r.status === "running") ? 1 : 0);
}

// 라운드가 어느 레버/축을 검증했는지 — 가설 레버 우선, 없으면 축.
function roundLabel(r: TourRound): string {
  return r.hypothesis ? leverLabel(r.hypothesis.lever) : TOUR_AXIS_LABEL[r.axis];
}

// 누적 지출 — 상세 tournamentTotals 와 동일 집계 (결산 라운드는 저장 KPI, 진행 중은 즉석 산출).
function tournamentSpend(t: Tournament): number {
  let spend = 0;
  for (const r of t.rounds) {
    const k = r.status === "settled" ? r.adKpis : r.fastForwardDays > 0 ? roundAdKpis(r, t.championCtr, t.dailyBudget, undefined, t.objective) : undefined;
    if (k) spend += k[0].spend + k[1].spend;
  }
  return spend;
}

function decisionStage(b: TourBeat): string {
  if (b === "champion-review") return "출발 광고 확인 대기";
  return "예산 소진 · 승자 처리 대기"; // ADR-054 — 결정 대기는 예산 소진(winner-handling)이 기본
}

/* ─── 디자인 전용 라인 아이콘 (shared Icon 미보유분, icons.jsx 1.7 stroke 이식) ─── */
type SvgIconProps = { size?: number; strokeWidth?: number };
function svgWrap(size: number, sw: number, children: ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function TrophyIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M17 5h2.5a1.5 1.5 0 0 1 0 5H17M7 5H4.5a1.5 1.5 0 0 0 0 5H7" /><path d="M12 13v3M9 20h6M10 16h4l.5 4h-5l.5-4Z" /></>);
}
function SwordsIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <path d="M14.5 17.5 4 21l3.5-10.5M3 5l4 4M21 5l-4 4M9.5 6.5 6 3 3 6l3.5 3.5M19 21l-3.5-3.5" />);
}
// 멈춤 — 끊긴 플러그. 일부러 스피너/펄스가 아님("살아 있음" 금지).
function PlugOffIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <path d="M18.36 6.64 12 13M2 22l3.5-3.5M9 9l-.5.5a4 4 0 0 0 0 5.66l.5.5 5.5-5.5M14.5 7.5 20 2M16 8l1.5-1.5M9 5l-1.5 1.5" />);
}
function OctagonAlertIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2Z" /><path d="M12 8v4M12 16h.01" /></>);
}
function FlaskIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <path d="M9 3h6M10 3v6.5L5 19a1.5 1.5 0 0 0 1.3 2.5h11.4A1.5 1.5 0 0 0 19 19l-5-9.5V3M7.5 14h9" />);
}
function ShieldIcon({ size = 18, strokeWidth = 1.7 }: SvgIconProps) {
  return svgWrap(size, strokeWidth, <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>);
}

/* ─── 미니 시각화 (viz.jsx 이식) ─── */

// 챔피언 지표 궤적 스파크라인. 우상향=이기는 중. 끝점 없음(open=라이브).
function Sparkline({ points, w = 132, h = 44, open = false, tone = "primary", fluid = false }: { points: number[]; w?: number; h?: number; open?: boolean; tone?: "primary" | "positive"; fluid?: boolean }) {
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
function Lineage({ rounds, compact = false }: { rounds: TourRound[]; compact?: boolean }) {
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

function LiftBadge({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
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
function CtrTrack({ from, to }: { from: string; to: string }) {
  return (
    <span className={`${FONT_MONO} inline-flex items-center gap-[7px] font-bold text-[13px] text-[var(--w-fg-strong)]`}>
      <span className="text-[var(--w-fg-alternative)]">{from}</span>
      <Icon name="arrow-right" size={13} />
      <span>{to}</span>
    </span>
  );
}

/* ─── ① 행동 카드 — 멈춤 (1순위, 경보, 압축) ─── */
function StoppedCard({ t, onOpen }: { t: Tournament; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl cursor-pointer bg-[var(--w-bg-elevated)] border border-[var(--w-status-negative-line)] p-4 outline-none focus-visible:shadow-[0_0_0_3px_var(--w-focus-ring)]"
      style={{ borderLeft: "3px solid var(--w-status-negative)" }}
    >
      <div className="grid place-items-center shrink-0 rounded-xl w-[50px] h-[50px] text-[var(--w-status-negative)] bg-[var(--w-status-negative-soft)] border border-[var(--w-status-negative-line)]">
        <PlugOffIcon size={24} />
      </div>
      <div className="min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full font-bold text-[12px] leading-none bg-[var(--w-status-negative-soft)] text-[var(--w-status-negative)]">
            <span className="w-2 h-2 rounded-sm bg-[var(--w-status-negative)] shrink-0" /> 게재 멈춤 · 복구 필요
          </span>
        </div>
        <div className="font-bold text-[16px] tracking-[-0.01em] text-[var(--w-fg-strong)]">{t.productName}</div>
        <div className="text-[13px] font-medium leading-[1.5] text-[var(--w-fg-neutral)] max-w-[560px] text-pretty">
          <span className="font-bold text-[var(--w-status-negative)]">고장 —</span> {t.lastError || "게재가 중단됐어요. 상세에서 원인을 확인하고 복구해 주세요."}
        </div>
      </div>
      <div className="flex flex-col gap-2 items-stretch shrink-0">
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="inline-flex items-center justify-center gap-[7px] h-10 px-[18px] rounded-lg font-bold text-[14px] text-white border-none cursor-pointer transition-opacity bg-[var(--w-status-negative)] hover:opacity-90">
          <Icon name="refresh" size={15} /> 복구하기
        </button>
        <span className="text-[12px] font-semibold text-center text-[var(--w-fg-alternative)]">자동 진행은 멈춰 있어요</span>
      </div>
    </div>
  );
}

/* ─── ① 행동 카드 — 승자 처리 대기 (2순위, 기회, 압축) ─── */
function WinnerCard({ t, onOpen }: { t: Tournament; onOpen: () => void }) {
  const lf = liftOf(t);
  const spec = tourMetricSpec(t.objective);
  const isChampionReview = deriveBeat(t) === "champion-review";
  return (
    <div
      onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl cursor-pointer bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] p-4 outline-none focus-visible:shadow-[0_0_0_3px_var(--w-focus-ring)]"
      style={{ borderLeft: "3px solid var(--w-primary-normal)" }}
    >
      <div className="relative shrink-0">
        {t.champion.imageUrl ? (
          <img src={t.champion.imageUrl} alt="" className="w-[54px] h-[54px] rounded-xl object-cover border-2 border-[var(--w-primary-normal)]" />
        ) : (
          <div className="w-[54px] h-[54px] rounded-xl grid place-items-center bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)] border-2 border-[var(--w-primary-normal)]"><Icon name="chart" size={24} /></div>
        )}
        <span className="absolute -right-1.5 -bottom-1.5 w-[26px] h-[26px] rounded-full grid place-items-center bg-[var(--w-primary-normal)] text-white border-2 border-[var(--w-bg-elevated)]">
          <TrophyIcon size={14} />
        </span>
      </div>
      <div className="min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full font-bold text-[12px] leading-none bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]">
            <TrophyIcon size={13} /> {decisionStage(deriveBeat(t))}
          </span>
          {!isChampionReview && <LiftBadge value={lf} size="sm" />}
        </div>
        <div className="font-bold text-[16px] tracking-[-0.01em] text-[var(--w-fg-strong)]">{t.productName}</div>
        <div className="text-[13px] font-medium leading-[1.5] text-[var(--w-fg-neutral)] max-w-[560px] text-pretty">
          {isChampionReview ? (
            <>출발 광고를 확인해 주세요. 확정하면 AI가 챌린저를 붙여 자동 진화를 시작해요.</>
          ) : (
            <><span className="font-bold text-[var(--w-fg-strong)]">{settledCount(t)}라운드 진화로 이긴 광고를 찾았어요.</span> 최종 {spec.rateLabel} {formatPrimary(spec, t.championCtr)} · 이제 어떻게 쓸지 골라주세요. 돈이 드는 결정이라 자동으로 넘기지 않아요.</>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 items-stretch shrink-0">
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="inline-flex items-center justify-center gap-[7px] h-10 px-[18px] rounded-lg font-bold text-[14px] text-white border-none cursor-pointer transition-colors bg-[var(--w-primary-normal)] hover:bg-[var(--w-primary-hover)]">
          <Icon name="sparkles" size={15} /> {isChampionReview ? "출발 광고 확인" : "승자 선택"}
        </button>
        <span className="text-[12px] font-semibold text-center text-[var(--w-primary-press)]">{isChampionReview ? "확인 · 수정 · 다시 생성 중 선택" : "승격 · 리필 · 종료 중 선택"}</span>
      </div>
    </div>
  );
}

/* ─── ② 이해 카드 — 진행 중 (진화 서사 풍부) ─── */
function RunningCard({ t, onOpen }: { t: Tournament; onOpen: () => void }) {
  const tr = trajectory(t), lf = liftOf(t);
  const spec = tourMetricSpec(t.objective);
  const liveRound = t.rounds.find((r) => r.status === "running");
  const liveDays = liveRound?.fastForwardDays ?? 0;
  return (
    <div
      onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="group grid grid-cols-[72px_1fr] xl:grid-cols-[72px_1fr_200px] gap-[22px] items-stretch rounded-2xl cursor-pointer bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] p-5 transition-[border-color,box-shadow] duration-150 outline-none hover:border-[rgba(0,102,255,0.35)] hover:shadow-[var(--w-shadow-card)] focus-visible:shadow-[0_0_0_3px_var(--w-focus-ring)]"
    >
      {t.champion.imageUrl ? (
        <img src={t.champion.imageUrl} alt="" className="w-[72px] h-[72px] rounded-xl object-cover border border-[var(--w-line-normal)] shrink-0" />
      ) : (
        <div className="w-[72px] h-[72px] rounded-xl grid place-items-center bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)] shrink-0 border border-[var(--w-line-normal)]"><Icon name="chart" size={28} /></div>
      )}

      <div className="min-w-0 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip variant="live" dot>자동 진화 중</Chip>
          <span className={`${FONT_MONO} text-[12px] font-bold text-[var(--w-fg-neutral)]`}>{roundsSoFar(t)}라운드째</span>
        </div>
        <div className="font-bold text-[17px] tracking-[-0.01em] text-[var(--w-fg-strong)] truncate">{t.productName}</div>
        {/* 진화 사다리 — 무엇을 이겼고/지켰는지 */}
        <div className="mt-0.5 max-w-[360px]">
          <Lineage rounds={t.rounds} />
        </div>
        {/* 지금 겨루는 중 */}
        {liveRound && (
          <div className="inline-flex items-center gap-[9px] mt-1 px-3 py-2 rounded-lg bg-[var(--w-bg-alternative)] self-start max-w-full">
            <span className="grid place-items-center shrink-0 text-[var(--w-primary-normal)]"><FlaskIcon size={15} /></span>
            <span className="text-[13px] font-semibold leading-[1.4] text-[var(--w-fg-neutral)]">
              지금 <span className="text-[var(--w-fg-strong)] font-bold">{roundLabel(liveRound)}</span> 레버로 겨루는 중{liveDays > 0 ? ` · ${liveDays}일째` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="col-span-2 xl:col-span-1 flex flex-col justify-between items-stretch gap-3 xl:border-l border-t xl:border-t-0 border-[var(--w-line-alternative)] pt-3.5 xl:pt-0 xl:pl-[22px]">
        <div className="w-full flex flex-col items-stretch gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold tracking-[0.04em] uppercase text-[var(--w-fg-alternative)]">챔피언 {spec.rateLabel} 진화</span>
            <LiftBadge value={lf} size="sm" />
          </div>
          <div className="w-full"><Sparkline points={spec.higherBetter ? tr : tr.map((v) => -v)} w={200} h={84} open fluid /></div>
          <div className="flex items-baseline gap-[7px]">
            <span className={`${FONT_MONO} font-extrabold text-[19px] tracking-[-0.01em] text-[var(--w-fg-strong)]`}>{formatPrimary(spec, t.championCtr)}</span>
            <span className="text-[11px] font-semibold text-[var(--w-fg-alternative)]">현재 챔피언</span>
          </div>
        </div>
        <span className="inline-flex self-end items-center gap-1.5 text-[13px] font-bold text-[var(--w-fg-neutral)] group-hover:text-[var(--w-primary-normal)] transition-colors">
          관전하기 <Icon name="arrow-right" size={15} />
        </span>
      </div>
    </div>
  );
}

/* ─── ② 이해 카드 — 완료 (신뢰 자산) ─── */
function CompletedCard({ t, onOpen, best }: { t: Tournament; onOpen: () => void; best?: boolean }) {
  const tr = trajectory(t), lf = liftOf(t);
  const spec = tourMetricSpec(t.objective);
  const converged = t.completionReason === "converged";
  return (
    <div
      onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="flex flex-col gap-[13px] rounded-2xl cursor-pointer bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] p-[18px] transition-[border-color,box-shadow] duration-150 outline-none hover:border-[rgba(0,102,255,0.35)] hover:shadow-[var(--w-shadow-card)] focus-visible:shadow-[0_0_0_3px_var(--w-focus-ring)]"
    >
      <div className="flex items-center justify-between gap-2.5">
        <Chip variant={converged ? "live" : "ended"} dot={converged}>{converged ? "수렴 종료" : "완료"}</Chip>
        {best ? (
          <span className="inline-flex items-center gap-1.5 font-bold text-[11px] leading-none tracking-[0.02em] px-[9px] py-[5px] rounded-md text-[#a9740a] bg-[rgba(255,176,38,0.16)] dark:text-[#ffcf6b]"><TrophyIcon size={12} /> 최고 우승작</span>
        ) : (
          <span className={`${FONT_MONO} text-[12px] font-semibold text-[var(--w-fg-alternative)]`}>{settledCount(t)}라운드</span>
        )}
      </div>
      <div className="font-bold text-[16px] tracking-[-0.01em] text-[var(--w-fg-strong)]">{t.productName}</div>
      <div className="flex items-center justify-between gap-3 py-2.5 border-y border-[var(--w-line-alternative)]">
        <div className="flex flex-col gap-1.5">
          <CtrTrack from={formatPrimary(spec, startCtrOf(t))} to={formatPrimary(spec, t.championCtr)} />
          <Lineage rounds={t.rounds} compact />
        </div>
        <div className="flex flex-col items-end gap-[5px]">
          {/* 스파크라인은 우상향=이기는 중 서사 — CPM 등 낮을수록 우세인 지표는 부호 반전해 그린다 */}
          <Sparkline points={spec.higherBetter ? tr : tr.map((v) => -v)} w={92} h={38} tone="positive" />
          <LiftBadge value={lf} size="sm" />
        </div>
      </div>
      <p className="m-0 text-[13px] font-medium leading-[1.5] text-[var(--w-fg-neutral)] text-pretty line-clamp-2">“{t.champion.headline}”</p>
    </div>
  );
}

/* ─── 최고 우승작 하이라이트 (신뢰 hero) ─── */
function TrophyHighlight({ t, onOpen }: { t: Tournament; onOpen: () => void }) {
  const lf = liftOf(t);
  const spec = tourMetricSpec(t.objective);
  return (
    <div
      onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-[26px] rounded-[20px] p-6 cursor-pointer transition-[border-color,box-shadow] duration-150 outline-none hover:shadow-[var(--w-shadow-card)] focus-visible:shadow-[0_0_0_3px_var(--w-focus-ring)]"
      style={{ background: "radial-gradient(130% 120% at 0% 0%, rgba(255,176,38,0.14), transparent 55%), var(--w-bg-elevated)", border: "1px solid rgba(212,150,30,0.34)" }}
    >
      <div className="w-[78px] h-[78px] rounded-full grid place-items-center text-white shrink-0" style={{ background: "radial-gradient(circle at 35% 30%, #ffd66b, #e8a019 70%)", boxShadow: "inset 0 -3px 8px rgba(120,80,0,0.28), 0 4px 14px rgba(200,140,20,0.3)" }}>
        <TrophyIcon size={38} strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex flex-col gap-2">
        <span className="inline-flex items-center gap-[7px] font-bold text-[11px] leading-none tracking-[0.1em] uppercase text-[#a9740a] dark:text-[#ffcf6b]">
          <TrophyIcon size={13} /> 최고 우승작 · 가장 큰 개선
        </span>
        <div className="font-bold text-[21px] tracking-[-0.02em] text-[var(--w-fg-strong)]">{t.productName}</div>
        <p className="m-0 pl-3 border-l-2 border-[rgba(212,150,30,0.5)] font-semibold text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] text-pretty">“{t.champion.headline}”</p>
        <div className="flex items-center gap-3.5 mt-0.5 flex-wrap">
          <CtrTrack from={formatPrimary(spec, startCtrOf(t))} to={formatPrimary(spec, t.championCtr)} />
          <span className="text-[13px] font-semibold text-[var(--w-fg-neutral)]">{settledCount(t)}라운드 진화</span>
        </div>
      </div>
      <div className="self-center shrink-0 flex flex-col items-center gap-1 min-w-[128px] py-[18px] px-[22px] rounded-[16px] bg-[rgba(0,191,64,0.08)] border border-[rgba(0,191,64,0.22)]">
        <span className="font-extrabold text-[36px] leading-none tracking-[-0.03em] text-[var(--w-status-positive)]">{signedPct(lf)}</span>
        <span className="font-bold text-[11px] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">{spec.rateLabel} 개선</span>
      </div>
    </div>
  );
}

/* ─── 섹션 헤드 ─── */
function SectionHead({ rank, title, count, tone, sub }: { rank?: string; title: string; count?: number; tone?: "attention" | "running" | "done" | "zero"; sub: string }) {
  const toneMap: Record<string, [string, string]> = {
    attention: ["var(--w-status-negative-soft)", "var(--w-status-negative)"],
    running: ["var(--w-primary-soft)", "var(--w-primary-press)"],
    done: ["rgba(255,176,38,0.16)", "#a9740a"],
    zero: ["var(--w-bg-alternative)", "var(--w-fg-alternative)"],
  };
  const [cbg, cfg] = toneMap[tone || "zero"];
  return (
    <div className="flex flex-col gap-1">
      <h2 className="m-0 flex items-center gap-2.5 font-bold text-[19px] tracking-[-0.016em] text-[var(--w-fg-strong)]">
        {rank && <span className={`${FONT_MONO} font-bold text-[14px] text-[var(--w-fg-alternative)]`}>{rank}</span>}
        {title}
        {count != null && (
          <span className={`${FONT_MONO} font-bold text-[12px] leading-none min-w-[22px] h-[22px] px-[7px] rounded-full inline-grid place-items-center`} style={{ background: cbg, color: cfg }}>{count}</span>
        )}
      </h2>
      <p className="m-0 text-[13px] font-medium leading-[1.5] text-[var(--w-fg-neutral)]">{sub}</p>
    </div>
  );
}

/* ① 평시 안심 밴드 — 개입할 게 0건일 때 ("맡겨둬" 정서). dashed empty 가 아님. */
function CalmBand({ runningCount }: { runningCount: number }) {
  return (
    <div className="flex items-center gap-4 px-[22px] py-5 rounded-2xl bg-[var(--w-bg-elevated)] border border-[var(--w-status-positive-line)]">
      <div className="w-[46px] h-[46px] rounded-xl grid place-items-center shrink-0 bg-[var(--w-status-positive-soft)] text-[var(--w-status-positive)]">
        <Icon name="check-circle" size={24} />
      </div>
      <div className="min-w-0">
        <div className="font-bold text-[16px] tracking-[-0.01em] text-[var(--w-fg-strong)]">지금 손볼 건 없어요 — 맡겨두셔도 돼요</div>
        <div className="text-[13px] font-medium leading-[1.5] text-[var(--w-fg-neutral)] mt-0.5 text-pretty">
          {runningCount > 0
            ? `AI가 토너먼트 ${runningCount}개를 알아서 진화시키고 있어요. 예산이 다하거나 게재가 멈추면 그때 바로 여기로 알려드릴게요.`
            : "예산이 다하거나 게재가 멈추면 그때 바로 여기로 알려드릴게요."}
        </div>
      </div>
    </div>
  );
}

/* 진행 중 비어 있을 때 안내 (dashed) */
function RunningEmpty() {
  return (
    <div className="px-[22px] py-[26px] rounded-[16px] bg-[var(--w-bg-elevated)] border border-dashed border-[var(--w-line-normal)] text-center text-[14px] font-medium text-[var(--w-fg-neutral)]">
      지금 진행 중인 토너먼트가 없어요. 새로 시작하면 여기서 진화 과정을 실시간으로 지켜볼 수 있어요.
    </div>
  );
}

/* 전체 빈 상태 */
function EmptyAll({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-3.5 px-8 py-[72px] rounded-2xl bg-[var(--w-bg-elevated)] border border-dashed border-[var(--w-line-normal)]">
      <div className="w-[60px] h-[60px] rounded-xl grid place-items-center bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)]"><SwordsIcon size={28} /></div>
      <div className="font-bold text-[19px] tracking-[-0.01em] text-[var(--w-fg-strong)]">아직 토너먼트가 없어요</div>
      <p className="m-0 max-w-[440px] text-[14px] font-medium leading-[1.6] text-[var(--w-fg-neutral)] text-pretty">
        광고 하나를 올려두면, AI가 챌린저를 붙여 라운드마다 더 나은 버전으로 진화시켜요. 예산이 다할 때까지 끝점 없이 계속 더 좋은 광고를 찾아요.
      </p>
      <Button variant="primary" size="lg" type="button" className="mt-1" onClick={onNew}>
        <Icon name="plus" size={17} /> 새 토너먼트 시작
      </Button>
    </div>
  );
}

/* ③ 한눈 요약 리본 — 포트폴리오 전체를 한 줄로. ①과 경쟁하지 않게 얇게. */
function GlanceRibbon({ list }: { list: Tournament[] }) {
  const running = list.filter((t) => abState(t) === "running").length;
  const completedList = list.filter((t) => abState(t) === "completed");
  const al = completedList.length ? Math.round(completedList.reduce((s, c) => s + liftOf(c), 0) / completedList.length) : 0;
  const Cell = ({ value, label, accent }: { value: ReactNode; label: string; accent?: string }) => (
    <div className="flex items-baseline gap-[7px]">
      <span className={`${FONT_MONO} font-bold text-[16px] tracking-[-0.01em]`} style={{ color: accent || "var(--w-fg-strong)" }}>{value}</span>
      <span className="text-[12px] font-semibold text-[var(--w-fg-neutral)]">{label}</span>
    </div>
  );
  const Div = () => <span className="w-px h-[18px] bg-[var(--w-line-alternative)]" />;
  return (
    <div className="flex items-center gap-[18px] flex-wrap px-[18px] py-3 rounded-xl bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)]">
      <Cell value={list.length} label="토너먼트" />
      <Div />
      <Cell value={running} label="자동 진행" />
      <Div />
      <Cell value={completedList.length} label="완료" />
      {completedList.length > 0 && <><Div /><Cell value={signedPct(al)} label="평균 성과 개선" accent="var(--w-status-positive)" /></>}
    </div>
  );
}

function headerSub(stopped: number, winner: number, running: number, completed: number, al: number): string {
  if (stopped) return "지금 바로 손봐야 할 토너먼트가 있어요. 멈춘 게재부터 복구해 주세요.";
  if (winner) return "AI가 이긴 광고를 찾아 두고 당신의 결정을 기다리고 있어요.";
  if (running) return completed ? `AI가 ${running}개를 진화시키는 중 · 끝낸 ${completed}개는 평균 ${signedPct(al)} 개선했어요.` : `AI가 ${running}개 토너먼트를 알아서 진화시키고 있어요.`;
  if (completed) return `토너먼트 ${completed}개를 끝냈어요 — 평균 ${signedPct(al)} 개선.`;
  return "광고 하나를 챔피언으로, AI 챌린저와 끝점 없이 겨루게 해요.";
}

function TournamentDashboard({ tournaments, onOpen, onNew }: { tournaments: Tournament[]; onOpen: (id: string) => void; onNew: () => void }) {
  const stopped = tournaments.filter((t) => abState(t) === "stopped");
  const winner = tournaments.filter((t) => abState(t) === "winner");
  const running = tournaments.filter((t) => abState(t) === "running");
  const completed = tournaments.filter((t) => abState(t) === "completed");
  const attention = stopped.length + winner.length;
  const al = completed.length ? Math.round(completed.reduce((s, c) => s + liftOf(c), 0) / completed.length) : 0;
  const best = completed.length ? completed.reduce((m, c) => (liftOf(c) > liftOf(m) ? c : m), completed[0]) : null;
  const completedRest = best ? completed.filter((t) => t.id !== best.id) : completed;

  return (
    <div className="w-full max-w-[1080px] mx-auto px-12 py-10 pb-24 flex flex-col gap-[30px]" data-screen-label="A/B 토너먼트 대시보드">
      {/* ── 헤더 ── */}
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 font-bold text-[11px] leading-none tracking-[0.1em] uppercase text-[var(--w-fg-alternative)] mb-3 whitespace-nowrap">
            <span className="w-[22px] h-[22px] rounded-md grid place-items-center bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)]"><SwordsIcon size={13} /></span>
            A/B 테스트 · 토너먼트
          </span>
          <h1 className="m-0 font-bold text-[31px] leading-[1.15] tracking-[-0.028em] text-[var(--w-fg-strong)]">이기는 광고 찾기</h1>
          <p className="mt-2 mb-0 max-w-[600px] font-medium text-[15px] leading-[1.6] text-[var(--w-fg-neutral)] text-pretty">
            {headerSub(stopped.length, winner.length, running.length, completed.length, al)}
          </p>
        </div>
        {tournaments.length > 0 && (
          <Button variant="primary" size="lg" type="button" onClick={onNew}>
            <Icon name="plus" size={17} /> 새 토너먼트 시작
          </Button>
        )}
      </header>

      {tournaments.length === 0 ? (
        <EmptyAll onNew={onNew} />
      ) : (
        <>
          {/* ③ 한눈 요약 리본 */}
          <GlanceRibbon list={tournaments} />

          {/* ① 내 손이 필요한 것 — 최상단 무게중심 */}
          <section className="flex flex-col gap-3.5">
            <SectionHead rank="①" title="지금 내 손이 필요해요"
              count={attention || undefined}
              tone={attention ? "attention" : "zero"}
              sub="AI가 알아서 돌리다가, 꼭 사람이 봐야 할 것만 멈춰 세웠어요. 위에서부터 급한 순서예요." />
            {attention ? (
              <div className="flex flex-col gap-3">
                {stopped.map((t) => <StoppedCard key={t.id} t={t} onOpen={() => onOpen(t.id)} />)}
                {winner.map((t) => <WinnerCard key={t.id} t={t} onOpen={() => onOpen(t.id)} />)}
              </div>
            ) : (
              <CalmBand runningCount={running.length} />
            )}
          </section>

          {/* ② AI가 진화시키는 중 */}
          {(running.length > 0 || completed.length > 0) && (
            <section className="flex flex-col gap-3.5">
              <SectionHead rank="②" title="AI가 진화시키는 중"
                count={running.length || undefined}
                tone="running"
                sub="🤖 챌린저를 붙이고, 결산하고, 이긴 쪽을 챔피언으로 올리는 걸 알아서 반복해요." />
              {running.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {running.map((t) => <RunningCard key={t.id} t={t} onOpen={() => onOpen(t.id)} />)}
                </div>
              ) : (
                <RunningEmpty />
              )}
            </section>
          )}

          {/* ③ 끝낸 토너먼트 */}
          {completed.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <SectionHead title="끝낸 토너먼트" count={completed.length} tone="done"
                sub={`진화를 마친 광고들 — 이 자동화가 실제로 효과 있다는 증거예요 (평균 ${signedPct(al)} 개선).`} />
              {best && <TrophyHighlight t={best} onOpen={() => onOpen(best.id)} />}
              {completedRest.length > 0 && (
                <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {completedRest.map((t) => <CompletedCard key={t.id} t={t} best={false} onOpen={() => onOpen(t.id)} />)}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
