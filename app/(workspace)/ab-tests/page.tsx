"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Select } from "@shared/ui/Select";
import { listTournaments, roundAdKpis, deriveBeat, isDecisionBeat, isRunningBeat, AXIS_LABEL as TOUR_AXIS_LABEL, TOURNAMENT_CHANGE_EVENT, type Tournament, type TourBeat } from "@entities/ab-test/tournament/tournament";
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
          <Button variant="primary" type="button" className="mt-2" onClick={() => router.push("/connect")}>계정 연결</Button>
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
   A/B 토너먼트 대시보드 (Browse Mode) — 성과 → 결정 → 진행/완료 서사.
   상세(/ab-tests/[id])의 deriveBeat·ChampionCard·DecisionBanner🧑 시각 언어 계승.
   ════════════════════════════════════════════════════════════════ */

const krw = (n: number) => `₩${(n || 0).toLocaleString("ko-KR")}`;
const FONT_MONO = "font-[family-name:var(--w-font-mono)]";

// ADR-035 — 비트는 엔진 deriveBeat 단일 소스 (auto 무인 / manual-n 제어 분기).

const settledCount = (t: Tournament) => t.rounds.filter((r) => r.status === "settled").length;
const startCtrOf = (t: Tournament) => t.rounds[0]?.verdict?.ctrA ?? t.championCtr;
const liftOf = (t: Tournament) => {
  const s = startCtrOf(t);
  // 개선폭 — 목표 방향 보정 (rate=높을수록·cpm=낮을수록 우세).
  return s > 0 ? (primaryDelta(tourMetricSpec(t.objective), t.championCtr, s) / s) * 100 : 0;
};

// 누적 지출 — 상세 tournamentTotals 와 동일 집계 (결산 라운드는 저장 KPI, 진행 중은 즉석 산출).
function tournamentSpend(t: Tournament): number {
  let spend = 0;
  for (const r of t.rounds) {
    const k = r.status === "settled" ? r.adKpis : r.fastForwardDays > 0 ? roundAdKpis(r, t.championCtr, t.dailyBudget, undefined, t.objective) : undefined;
    if (k) spend += k[0].spend + k[1].spend;
  }
  return spend;
}

// 라운드 진행도 도트용 현재 위치 (1-based).
function roundPos(t: Tournament): number {
  const running = t.rounds.find((r) => r.status === "running");
  if (running) return running.index;
  return t.championConfirmed ? settledCount(t) + 1 : 1;
}

function decisionStage(b: TourBeat): string {
  if (b === "winner-handling") return "위너 처리 대기";
  if (b === "anomaly") return "이상 신호 감지";
  if (b === "champion-review") return "챔피언 검토 대기";
  if (b === "challenger-review") return "챌린저 검토 대기";
  return "다음 라운드 결정";
}

// 헤더 부제 — 정적 설명 대신 현황 한 줄. 우선순위: 결정 대기 > 진행 중 > 완료 평균 Lift.
function headerLine(decisions: number, running: number, completed: number, avgLift: number): string {
  const done = completed ? `완료 ${completed}건 평균 성과 +${avgLift}% 개선` : "";
  if (decisions) return done ? `지금 검토가 필요한 토너먼트가 ${decisions}개 있어요 · ${done}` : `지금 검토가 필요한 토너먼트가 ${decisions}개 있어요`;
  if (running) return done ? `진행 중인 토너먼트 ${running}개를 관전하고 있어요 · ${done}` : `진행 중인 토너먼트 ${running}개를 관전하고 있어요`;
  if (completed) return `토너먼트 ${completed}건을 끝냈어요 — 평균 성과 +${avgLift}% 개선`;
  return "챔피언-챌린저 체인으로 광고를 진화시켜요.";
}

function TrophyIcon({ size = 18, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h2.5a1.5 1.5 0 0 1 0 5H17M7 5H4.5a1.5 1.5 0 0 0 0 5H7" />
      <path d="M12 13v3M9 20h6M10 16h4l.5 4h-5l.5-4Z" />
    </svg>
  );
}
function SwordsIcon({ size = 18, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 17.5 4 21l3.5-10.5M3 5l4 4M21 5l-4 4M9.5 6.5 6 3 3 6l3.5 3.5M19 21l-3.5-3.5" />
    </svg>
  );
}

function TournamentDashboard({ tournaments, onOpen, onNew }: { tournaments: Tournament[]; onOpen: (id: string) => void; onNew: () => void }) {
  const [sort, setSort] = useState<"lift" | "rounds">("lift");

  const decisions = tournaments.filter((t) => t.status !== "completed" && isDecisionBeat(deriveBeat(t)));
  const running = tournaments.filter((t) => isRunningBeat(deriveBeat(t)));
  const completedList = tournaments.filter((t) => t.status === "completed");

  const completed = [...completedList].sort((a, b) =>
    sort === "lift" ? liftOf(b) - liftOf(a) : settledCount(b) - settledCount(a),
  );

  const best = completedList.length
    ? completedList.reduce((m, c) => (liftOf(c) > liftOf(m) ? c : m), completedList[0])
    : null;
  const avgLift = completedList.length
    ? Math.round(completedList.reduce((s, c) => s + liftOf(c), 0) / completedList.length)
    : 0;
  const totalSpend = tournaments.reduce((s, t) => s + tournamentSpend(t), 0);

  // 토너먼트가 하나도 없으면 단일 안내 (성과 0 대시보드 대신).
  if (tournaments.length === 0) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-12 py-10 pb-20" data-screen-label="A/B 토너먼트 대시보드">
        <Card className="py-12 px-8 flex flex-col items-center gap-3 text-center">
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center" }}>
            <Icon name="chart" size={24} />
          </div>
          <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)]">아직 토너먼트가 없어요</div>
          <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] max-w-[420px]">챔피언-챌린저 토너먼트로 라운드마다 더 나은 광고를 찾아보세요.</div>
          <Button variant="primary" type="button" className="mt-2" onClick={onNew}>
            <Icon name="plus" size={14} /> 새 토너먼트 시작
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-12 py-10 pb-20 flex flex-col gap-10" data-screen-label="A/B 토너먼트 대시보드">
      {/* ── 헤더 ── */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 font-bold text-[11px] leading-none tracking-[0.10em] uppercase text-[var(--w-fg-alternative)] mb-3 whitespace-nowrap">
            <span className="w-[22px] h-[22px] rounded-[7px] grid place-items-center bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)]">
              <Icon name="chart" size={14} />
            </span>
            A/B 테스트 · 토너먼트
          </span>
          <h1 className="m-0 font-bold text-[30px] leading-[1.2] tracking-[-0.026em] text-[var(--w-fg-strong)]">토너먼트 대시보드</h1>
          <p className="mt-2 mb-0 max-w-[640px] font-medium text-[14.5px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-neutral)] text-pretty">
            {headerLine(decisions.length, running.length, completedList.length, avgLift)}
          </p>
        </div>
        <Button variant="primary" size="lg" type="button" onClick={onNew}>
          <Icon name="plus" size={17} /> 새 토너먼트 시작
        </Button>
      </header>

      {/* ── ① 집계 KPI 스트립 ── */}
      <section className="grid gap-3.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.55fr_1fr_1fr_1fr]">
        {/* 히어로 — 누적 CTR 개선 */}
        <div
          className="md:col-span-2 xl:col-span-1 rounded-2xl p-5 flex flex-col gap-2 min-h-[132px]"
          style={{
            background: "radial-gradient(120% 140% at 100% 0%, rgba(0,191,64,0.10), transparent 60%), var(--w-bg-elevated)",
            border: "1px solid rgba(0,191,64,0.28)",
          }}
        >
          <span className="inline-flex items-center gap-[7px] font-semibold text-[12.5px] leading-none text-[var(--w-status-positive)]">
            <Icon name="trend-up" size={15} /> 누적 성과 개선
          </span>
          <div className="mt-auto flex items-baseline gap-1.5 font-extrabold text-[54px] leading-[0.95] tracking-[-0.03em] text-[var(--w-status-positive)]">
            {completedList.length ? <>+{avgLift}<span className="font-extrabold text-[28px] leading-none">%</span></> : "—"}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${FONT_MONO} font-bold text-[11px] leading-none px-[9px] py-1 rounded-full bg-[rgba(0,191,64,0.12)] text-[var(--w-status-positive)] whitespace-nowrap`}>완료 {completedList.length}건 평균</span>
            <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">출발 성과 대비 최종 Lift</span>
          </div>
        </div>

        {/* 진행/완료 */}
        <div className="rounded-2xl p-5 flex flex-col gap-2.5 min-h-[132px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)]">
          <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)]">진행 상황</span>
          <div className="mt-auto grid grid-cols-[1fr_1px_1fr] items-stretch gap-3.5">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[30px] leading-[1.02] tracking-[-0.026em] text-[var(--w-fg-strong)]">{running.length}</span>
              <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)]">진행 중</span>
            </div>
            <span className="self-stretch my-0.5 bg-[var(--w-line-alternative)]" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[30px] leading-[1.02] tracking-[-0.026em] text-[var(--w-fg-strong)]">{completedList.length}</span>
              <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)]">완료</span>
            </div>
          </div>
        </div>

        {/* 결정 대기 */}
        <div className="rounded-2xl p-5 flex flex-col gap-2.5 min-h-[132px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)]">
          <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)]">결정 대기</span>
          <span className="mt-auto font-bold text-[30px] leading-[1.02] tracking-[-0.026em] text-[var(--w-fg-strong)]">{decisions.length}</span>
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)] whitespace-nowrap">{decisions.length ? "검토가 필요해요" : "지금은 없어요"}</span>
        </div>

        {/* 누적 지출 */}
        <div className="rounded-2xl p-5 flex flex-col gap-2.5 min-h-[132px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)]">
          <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)]">누적 지출</span>
          <span className="mt-auto font-bold text-[30px] leading-[1.02] tracking-[-0.026em] text-[var(--w-fg-strong)]">{krw(totalSpend)}</span>
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)] whitespace-nowrap">전체 토너먼트 합계</span>
        </div>
      </section>

      {/* ── ② 결정 대기 ── */}
      <section className="flex flex-col gap-4">
        <DashHead emoji="🧑" title="결정 대기" count={decisions.length} countTone={decisions.length ? "decision" : "zero"} sub="AI 가 자동으로 돌리다가 — 꼭 사람이 봐야 할 것만 멈춰 세웠어요" />
        {decisions.length ? (
          <div className="flex flex-col gap-3">
            {decisions.map((t) => <DecisionCard key={t.id} t={t} onClick={() => onOpen(t.id)} />)}
          </div>
        ) : (
          <DashEmpty
            tone="decision"
            icon={<span className="text-[26px] leading-none">🤖</span>}
            title="지금은 전부 자동 진행 중"
            desc="AI 가 무인으로 챔피언-챌린저 라운드를 돌리고 있어요. 예산이 소진되거나 이상 신호가 잡히면 그때만 여기로 올라와요."
            onNew={onNew}
          />
        )}
      </section>

      {/* ── ③ 진행 중 ── */}
      <section className="flex flex-col gap-4">
        <DashHead title="진행 중" count={running.length} countTone={running.length ? "accent" : "zero"} sub="🤖 AI 가 무인으로 챌린저를 붙이고 결산·승격까지 알아서 돌리고 있어요" />
        {running.length ? (
          <div className="flex flex-col gap-3">
            {running.map((t) => <RunningCard key={t.id} t={t} onClick={() => onOpen(t.id)} />)}
          </div>
        ) : (
          <DashEmpty
            icon={<SwordsIcon size={26} />}
            title="진행 중인 토너먼트가 없어요"
            desc="새 토너먼트를 시작하면 라운드마다 AI 챌린저가 붙고, 진화 과정과 현재 챔피언의 성과를 여기서 실시간으로 지켜볼 수 있어요."
            onNew={onNew}
          />
        )}
      </section>

      {/* ── ④ 완료 + 최고 우승작 ── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <DashHead title="완료" count={completedList.length} countTone="accent" sub="진화를 마친 토너먼트와 역대 최고 우승작" />
          {completedList.length > 1 && (
            <div className="w-[170px] shrink-0">
              <Select
                value={sort}
                onChange={(v) => setSort(v as "lift" | "rounds")}
                options={[
                  { value: "lift", label: "Lift 높은 순" },
                  { value: "rounds", label: "라운드 많은 순" },
                ]}
              />
            </div>
          )}
        </div>

        {best ? (
          <>
            <TrophyHighlight t={best} onClick={() => onOpen(best.id)} />
            <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {completed.map((t) => <DoneCard key={t.id} t={t} isBest={t.id === best.id} onClick={() => onOpen(t.id)} />)}
            </div>
          </>
        ) : (
          <DashEmpty
            icon={<TrophyIcon size={26} />}
            title="완료된 토너먼트가 없어요"
            desc="토너먼트를 끝까지 진행하면 진화의 결과와 역대 최고 우승작이 여기에 모여요."
            onNew={onNew}
          />
        )}
      </section>
    </div>
  );
}

function DashHead({ emoji, title, count, countTone, sub }: { emoji?: string; title: string; count: number; countTone: "accent" | "decision" | "zero"; sub: string }) {
  const tone =
    countTone === "decision"
      ? "bg-[rgba(255,146,0,0.14)] text-[#9c5800] dark:bg-[rgba(255,146,0,0.18)] dark:text-[#ffb24d]"
      : countTone === "accent"
        ? "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]"
        : "bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)]";
  return (
    <div className="flex flex-col gap-[3px]">
      <h2 className="flex items-center gap-2.5 m-0 font-bold text-[18px] leading-[1.25] tracking-[-0.014em] text-[var(--w-fg-strong)] whitespace-nowrap">
        {emoji && <span className="text-[18px] leading-none">{emoji}</span>}
        {title}
        <span className={`${FONT_MONO} font-bold text-[12px] leading-none min-w-[22px] h-[22px] px-[7px] rounded-full inline-grid place-items-center ${tone}`}>{count}</span>
      </h2>
      <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">{sub}</p>
    </div>
  );
}

function DashEmpty({ icon, title, desc, onNew, tone }: { icon: ReactNode; title: string; desc: string; onNew: () => void; tone?: "decision" }) {
  const iconCls =
    tone === "decision"
      ? "bg-[rgba(255,146,0,0.12)] text-[#b06700] dark:bg-[rgba(255,146,0,0.16)] dark:text-[#ffb24d]"
      : "bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)]";
  return (
    <div className="flex flex-col items-center text-center gap-3.5 py-11 px-8 rounded-[18px] bg-[var(--w-bg-elevated)] border border-dashed border-[var(--w-line-normal)]">
      <div className={`w-14 h-14 rounded-2xl grid place-items-center ${iconCls}`}>{icon}</div>
      <div className="font-bold text-[16px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)]">{title}</div>
      <p className="m-0 -mt-1 max-w-[420px] font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-neutral)] text-pretty">{desc}</p>
      <Button variant="primary" type="button" className="mt-1" onClick={onNew}>
        <Icon name="plus" size={16} /> 새 토너먼트 시작
      </Button>
    </div>
  );
}

function RoundDots({ round, total }: { round: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-[5px]">
        {Array.from({ length: total }).map((_, i) => {
          const isFinal = i === total - 1;
          const done = i < round - 1;
          const now = i === round - 1;
          let cls = "bg-[var(--w-line-normal)]";
          if (done) cls = isFinal ? "bg-[var(--w-status-positive)]" : "bg-[var(--w-primary-normal)]";
          else if (now) cls = "bg-[var(--w-primary-normal)] shadow-[0_0_0_3px_var(--w-primary-soft)]";
          return <span key={i} className={`w-[9px] h-[9px] rounded-full ${cls}`} />;
        })}
      </span>
      <span className={`${FONT_MONO} font-bold text-[11.5px] leading-none text-[var(--w-fg-neutral)]`}>R{round}/{total}</span>
    </span>
  );
}

function RunningCard({ t, onClick }: { t: Tournament; onClick: () => void }) {
  const last = t.rounds.at(-1);
  const total = t.maxRounds ?? roundPos(t);
  const spec = tourMetricSpec(t.objective);
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-[18px] w-full text-left bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-2xl py-[18px] px-5 cursor-pointer transition-[border-color,box-shadow] duration-[120ms] hover:border-[var(--w-primary-weak)] hover:shadow-[var(--w-shadow-card)]"
    >
      {t.champion.imageUrl ? (
        <img src={t.champion.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-[var(--w-line-normal)]" />
      ) : (
        <div className="w-16 h-16 rounded-xl grid place-items-center bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)]"><Icon name="chart" size={26} /></div>
      )}
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip variant="live" dot>🤖 자동 진행 중</Chip>
          <RoundDots round={roundPos(t)} total={total} />
        </div>
        <div className="font-bold text-[15.5px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)] truncate">{t.productName}</div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-baseline gap-1.5">
            <span className="font-medium text-[11.5px] leading-none text-[var(--w-fg-alternative)]">현 챔피언 {spec.rateLabel}</span>
            <span className={`${FONT_MONO} font-bold text-[13px] leading-none text-[var(--w-primary-press)]`}>{formatPrimary(spec, t.championCtr)}</span>
          </span>
          {last && (
            <span className="font-semibold text-[11px] leading-none text-[var(--w-accent-violet)] bg-[var(--w-accent-violet-soft)] px-[9px] py-1 rounded-full">최근 비교 · {TOUR_AXIS_LABEL[last.axis]}</span>
          )}
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1.5 font-semibold text-[13px] leading-none text-[var(--w-fg-neutral)] whitespace-nowrap group-hover:text-[var(--w-primary-normal)]">
        관전하기 <Icon name="arrow-right" size={15} />
      </span>
    </div>
  );
}

function DecisionCard({ t, onClick }: { t: Tournament; onClick: () => void }) {
  const total = t.maxRounds ?? roundPos(t);
  const spec = tourMetricSpec(t.objective);
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-[18px] w-full text-left rounded-2xl py-[18px] px-5 cursor-pointer border border-[rgba(255,146,0,0.32)] hover:border-[rgba(255,146,0,0.55)] transition-[border-color] duration-[120ms]"
      style={{ background: "linear-gradient(90deg, rgba(255,146,0,0.05), transparent 36%)" }}
    >
      <span className="w-11 h-11 rounded-full grid place-items-center text-[22px] bg-[rgba(255,146,0,0.12)] border border-[rgba(255,146,0,0.30)]">🧑</span>
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip variant="paused" dot>{decisionStage(deriveBeat(t))}</Chip>
          <RoundDots round={roundPos(t)} total={total} />
        </div>
        <div className="font-bold text-[15.5px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)] truncate">{t.productName}</div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-baseline gap-1.5">
            <span className="font-medium text-[11.5px] leading-none text-[var(--w-fg-alternative)]">현 챔피언 {spec.rateLabel}</span>
            <span className={`${FONT_MONO} font-bold text-[13px] leading-none text-[var(--w-primary-press)]`}>{formatPrimary(spec, t.championCtr)}</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-medium text-[11.5px] leading-none text-[var(--w-fg-alternative)]">대기</span>
            <span className="font-bold text-[13px] leading-none text-[var(--w-fg-strong)]">당신의 검토</span>
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="shrink-0 inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[10px] bg-[var(--w-primary-normal)] text-white border-none cursor-pointer font-semibold text-[13px] leading-none transition-colors duration-[120ms] hover:bg-[var(--w-primary-hover)]"
      >
        검토하기 <Icon name="arrow-right" size={15} />
      </button>
    </div>
  );
}

function DoneCard({ t, isBest, onClick }: { t: Tournament; isBest: boolean; onClick: () => void }) {
  const lift = Math.round(liftOf(t));
  const spec = tourMetricSpec(t.objective);
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="flex flex-col gap-3.5 text-left bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-2xl py-[18px] px-5 cursor-pointer transition-[border-color,box-shadow] duration-[120ms] hover:border-[var(--w-primary-weak)] hover:shadow-[var(--w-shadow-card)]"
    >
      <div className="flex items-center justify-between gap-2.5">
        <Chip variant="ended" dot>완료</Chip>
        {isBest ? (
          <span className="inline-flex items-center gap-1.5 font-bold text-[10.5px] leading-none tracking-[0.02em] px-2 py-1 rounded-md text-[#b07d10] bg-[rgba(255,176,38,0.14)] dark:text-[#ffcf6b] dark:bg-[rgba(255,176,38,0.16)] whitespace-nowrap">
            <TrophyIcon size={12} /> 최고 우승작
          </span>
        ) : (
          <span className="font-medium text-[11.5px] leading-none text-[var(--w-fg-alternative)] whitespace-nowrap">{settledCount(t)}라운드</span>
        )}
      </div>
      <div className="font-bold text-[15px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)]">{t.productName}</div>
      <div className="flex items-center gap-2.5 py-2.5 border-y border-[var(--w-line-alternative)]">
        <span className={`${FONT_MONO} inline-flex items-center gap-[7px] font-bold text-[13.5px] leading-none text-[var(--w-fg-strong)]`}>
          {formatPrimary(spec, startCtrOf(t))} <span className="text-[var(--w-fg-alternative)]">→</span> {formatPrimary(spec, t.championCtr)}
        </span>
        <span className={`${FONT_MONO} ml-auto inline-flex items-center gap-1 font-bold text-[11.5px] leading-none px-[9px] py-[5px] rounded-full bg-[rgba(0,191,64,0.10)] text-[var(--w-status-positive)]`}>
          <Icon name="trend-up" size={12} /> +{lift}%
        </span>
      </div>
      <p className="m-0 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)] line-clamp-2 text-pretty">“{t.champion.headline}”</p>
    </div>
  );
}

function TrophyHighlight({ t, onClick }: { t: Tournament; onClick: () => void }) {
  const lift = Math.round(liftOf(t));
  const spec = tourMetricSpec(t.objective);
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-stretch gap-[26px] p-7 rounded-[22px] cursor-pointer border border-[rgba(212,150,30,0.34)] hover:border-[rgba(212,150,30,0.55)] dark:border-[rgba(255,176,38,0.30)] transition-[box-shadow,border-color] duration-[160ms]"
      style={{ background: "radial-gradient(130% 120% at 0% 0%, rgba(255,176,38,0.16), transparent 55%), var(--w-bg-elevated)" }}
    >
      <div
        className="w-[88px] h-[88px] shrink-0 self-center rounded-full grid place-items-center text-white"
        style={{ background: "radial-gradient(circle at 35% 30%, #ffd66b, #e8a019 70%)", boxShadow: "inset 0 -3px 8px rgba(120,80,0,0.28), 0 4px 14px rgba(200,140,20,0.30)" }}
      >
        <TrophyIcon size={42} strokeWidth={1.6} />
      </div>
      <div className="flex flex-col justify-center gap-2.5 min-w-0">
        <span className="inline-flex items-center gap-2 font-bold text-[11px] leading-none tracking-[0.10em] uppercase text-[#b07d10] dark:text-[#ffcf6b] whitespace-nowrap">
          <TrophyIcon size={13} /> 최고 우승작 · BEST LIFT
        </span>
        <div className="font-bold text-[22px] leading-[1.25] tracking-[-0.02em] text-[var(--w-fg-strong)]">{t.productName}</div>
        <p className="m-0 pl-3 border-l-2 border-[rgba(212,150,30,0.5)] font-semibold text-[14.5px] leading-[1.5] text-[var(--w-fg-neutral)] text-pretty">“{t.champion.headline}”</p>
        <div className="flex items-center gap-3.5 flex-wrap mt-0.5">
          <span className={`${FONT_MONO} inline-flex items-center gap-2 font-bold text-[14px] leading-none text-[var(--w-fg-strong)]`}>
            {formatPrimary(spec, startCtrOf(t))} <span className="text-[var(--w-fg-alternative)]">→</span> {formatPrimary(spec, t.championCtr)}
          </span>
          <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)]">{settledCount(t)}라운드 진화</span>
        </div>
      </div>
      <div className="self-center shrink-0 flex flex-col items-center justify-center gap-1 min-w-[132px] py-5 px-[22px] rounded-[18px] bg-[rgba(0,191,64,0.08)] border border-[rgba(0,191,64,0.22)]">
        <span className="font-extrabold text-[38px] leading-none tracking-[-0.03em] text-[var(--w-status-positive)]">+{lift}%</span>
        <span className="font-semibold text-[11px] leading-none tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">{spec.rateLabel} LIFT</span>
      </div>
    </div>
  );
}
