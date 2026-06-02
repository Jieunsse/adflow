"use client";

// ADR-032/033 — A/B 토너먼트(흐름2) 상세. lib/demo 엔진을 승격한 실제 라우트. 현재 Browse Mode 시연 전용.
// journey 청사진(사람 의사결정 체인): setup → champion-review → [challenger-decision → live → result]×N → done.
// 결정 지점 🧑(DecisionBanner) = 발표자가 직접 누르며 설명, 자동 단계 🤖(AutoBanner) = 엔진이 판정·승격.
// 시간 경과(라이브 결산)는 하단 PresenterTournamentBar(+7일)가 구동한다.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { IgPostPreview } from "@shared/ui/IgPostPreview";
import { useToast } from "@shared/ui/Toast";
import {
  roundAdKpis,
  nextAxis,
  deriveAxis,
  deriveBeat,
  detectAnomaly,
  AXIS_LABEL,
  MIN_ROUND_DAYS,
  TOURNAMENT_CHANGE_EVENT,
  type Tournament,
  type TourVariant,
  type TourRound,
  type TourAxis,
  type Hypothesis,
  type HypothesisVerdict,
} from "@entities/ab-test/tournament/tournament";
import { leverLabel } from "@entities/ab-test/tournament/lever";
import { tournamentClient } from "@entities/ab-test/tournament/client";
import { buildRoundReport, type AdReport, type RoundReport } from "@entities/ab-test/tournament/report";
import {
  tourMetricSpec,
  formatPrimary,
  primaryDelta,
  primaryMetricValue,
  type TourMetricSpec,
} from "@entities/ab-test/tournament/objective-metric";
import PresenterTournamentBar from "@widgets/presenter-fast-forward/tournament";

// ADR-035 — 비트는 엔진 deriveBeat 단일 소스 (auto 무인 / manual-n 제어 분기).

// 라운드 경과일 — 실 게재 라운드는 launchedAt 기준(UTC 차분), 미게재면 0.
function elapsedDays(round: TourRound): number {
  if (!round.launchedAt) return 0;
  const start = Date.parse(round.launchedAt);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

// 누적 실적 — 데모: settled adKpis + running 즉석 산출(시드). 실: settled adKpis 실측만, running 은 결산 전이라 제외.
function tournamentTotals(t: Tournament, isReal: boolean): { spend: number; days: number } {
  let spend = 0;
  let days = 0;
  for (const r of t.rounds) {
    if (isReal) {
      if (r.adKpis) spend += r.adKpis[0].spend + r.adKpis[1].spend;
      days += r.status === "settled" ? MIN_ROUND_DAYS : elapsedDays(r);
    } else {
      days += Math.max(0, r.fastForwardDays);
      const k = r.status === "settled" ? r.adKpis : r.fastForwardDays > 0 ? roundAdKpis(r, t.championCtr, t.dailyBudget, undefined, t.objective) : undefined;
      if (k) spend += k[0].spend + k[1].spend;
    }
  }
  return { spend, days };
}

const krw = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

// ADR-044 — 가설 verdict 표시. 입증=positive / 반증=warning / 미결=neutral.
const VERDICT_META: Record<HypothesisVerdict, { label: string; mark: string; chip: "live" | "paused" | "neutral" }> = {
  confirmed: { label: "입증", mark: "✓", chip: "live" },
  refuted: { label: "반증", mark: "✗", chip: "paused" },
  inconclusive: { label: "미결", mark: "~", chip: "neutral" },
};

const RATIONALE_SOURCE_LABEL: Record<Hypothesis["rationaleSource"], string> = {
  "brand-profile": "브랜드 프로필",
  persona: "페르소나",
  "performance-archive": "성과 아카이브",
  "platform-prior": "플랫폼 통계",
  ledger: "누적 학습",
  principle: "마케팅 원칙",
};

export default function AbTournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const isReal = !browseMode;
  const showToast = useToast();
  const client = useMemo(() => tournamentClient(browseMode), [browseMode]);

  const [t, setT] = useState<Tournament | null>(null);
  const [ledger, setLedger] = useState<Hypothesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const reload = () => {
      client.get(id).then((next) => {
        if (!alive) return;
        setT(next);
        setLoading(false);
      });
      // ADR-047 학습 노트 — 데모=localStorage 투영, 실=brand-scoped 서버 투영. 본문 렌더를 막지 않게 별도 페치.
      client.getLedger(id).then((l) => { if (alive) setLedger(l); }).catch(() => {});
    };
    reload();
    if (browseMode) {
      // 데모 — localStorage 변경 이벤트로 즉시 반영.
      window.addEventListener(TOURNAMENT_CHANGE_EVENT, reload);
      return () => {
        alive = false;
        window.removeEventListener(TOURNAMENT_CHANGE_EVENT, reload);
      };
    }
    // 실 — 서버 cron 이 라운드를 결산·진행하므로 주기 폴링으로 최신화(라이브 대기 상태 동기화).
    const iv = setInterval(reload, 30000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [id, browseMode, client]);

  // mutation 헬퍼 — busy 토글 + 최신 스냅샷 반영 + 토스트/에러 처리. 데모·실 공통.
  const act = async (op: Promise<Tournament | null>, okMsg?: string) => {
    setBusy(true);
    try {
      const next = await op;
      if (next) setT(next);
      if (okMsg) showToast(okMsg);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "처리 중 문제가 발생했어요");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="px-12 py-9 max-w-[760px] mx-auto">
        <Card className="py-12 px-8 flex flex-col items-center gap-3 text-center">
          <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-7 h-7" />
          <div className="font-semibold text-[14px] text-[var(--w-fg-neutral)]">불러오는 중…</div>
        </Card>
      </div>
    );
  }

  if (!t) {
    return (
      <div className="px-12 py-9 max-w-[760px] mx-auto">
        <Card className="py-12 px-8 flex flex-col items-center gap-3 text-center">
          <div className="font-bold text-[17px] text-[var(--w-fg-strong)]">토너먼트를 찾을 수 없어요</div>
          <div className="font-medium text-[13px] text-[var(--w-fg-neutral)]">초기화되었거나 아직 시작하지 않았어요.</div>
          <Button variant="primary" type="button" className="mt-2" onClick={() => router.push("/ab-tests/new")}>새 토너먼트 시작</Button>
        </Card>
      </div>
    );
  }

  const beat = deriveBeat(t);
  const spec = tourMetricSpec(t.objective);
  const settledRounds = t.rounds.filter((r) => r.status === "settled");
  const lastSettled = settledRounds.at(-1) ?? null;
  const totals = tournamentTotals(t, isReal);
  const startCtr = t.rounds[0]?.verdict?.ctrA ?? t.championCtr;
  // 개선폭 — rate 는 높을수록·cpm 은 낮을수록 우세라 방향을 spec 으로 보정.
  const liftPct = startCtr > 0 ? (primaryDelta(spec, t.championCtr, startCtr) / startCtr) * 100 : 0;
  const promotionNote =
    beat === "between" && lastSettled?.rawWinner === "B"
      ? `R${lastSettled.index}에서 승격 · ${AXIS_LABEL[lastSettled.axis]} 교체`
      : settledRounds.length === 0 && t.championSource === "existing"
        ? `기존 광고 〈${t.championSourceName ?? "—"}〉에서 시작`
        : undefined;
  const nextAxisLabel = AXIS_LABEL[nextAxis(t.axisCursor)];
  // VS 상단 — 결정 대기 챌린저(pending) 또는 게재 중 라운드의 챌린저가 있으면 챔피언과 나란히 비교.
  const runningRound = t.rounds.find((r) => r.status === "running");
  const activeChallenger = t.pendingChallenger ?? runningRound?.challenger;
  const challengerAxis = activeChallenger ? deriveAxis(t.champion, activeChallenger) : undefined;
  // 게시중(running 라운드) VS = IG 풀 프리뷰 대신 헤드라인/광고카피 텍스트 비교. 게재 전(pending) 검토 단계는 그대로 IG.
  const liveVs = !t.pendingChallenger && !!runningRound;

  return (
    <div className="px-12 py-9 pb-28 max-w-[860px] w-full mx-auto flex flex-col gap-6" data-screen-label="A/B 토너먼트 상세">
      <button
        type="button"
        onClick={() => router.push("/ab-tests")}
        className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)] hover:underline"
      >
        <Icon name="arrow-left" size={13} /> A/B 테스트
      </button>

      {/* 헤더 */}
      <div className="flex justify-between items-start gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Chip
              variant={beat === "winner-handling" || beat === "anomaly" ? "paused" : beat === "done" ? "ended" : "live"}
              dot
            >
              {beat === "done"
                ? "완료"
                : beat === "winner-handling"
                  ? "위너 처리 대기"
                  : beat === "anomaly"
                    ? "이상 신호"
                    : beat === "auto-running" || beat === "live"
                      ? "🤖 자동 진행 중"
                      : "진행 중"}
            </Chip>
            <Chip variant="neutral">
              {settledRounds.length}
              {t.maxRounds ? `/${t.maxRounds}` : ""}라운드
            </Chip>
          </div>
          <h1 className="m-0 font-bold text-[26px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">{t.productName}</h1>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
            챔피언-챌린저 토너먼트
          </p>
        </div>
      </div>

      {/* 현황 스트립 */}
      {t.rounds.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-5 rounded-xl bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)]">
          <StatItem label="누적 지출" value={krw(totals.spend)} />
          <StatItem label="경과" value={`${totals.days}일`} />
        </div>
      )}

      {/* 챔피언 카드 — 챌린저가 있으면 VS 구도 */}
      <ChampionCard champion={t.champion} challenger={activeChallenger} axis={challengerAxis} ctr={t.championCtr} spec={spec} confirmed={!!t.championConfirmed} note={promotionNote} live={liveVs} />

      {/* 비트별 패널 */}
      {beat === "champion-review" && (
        <ChampionReview
          t={t}
          busy={busy}
          onRegenerate={() => act(client.regenerateChampion(t.id))}
          onConfirm={(edited) => act(client.confirmChampion(t.id, edited))}
        />
      )}

      {beat === "challenger-review" && t.pendingChallenger && (
        <ChallengerReview
          t={t}
          challenger={t.pendingChallenger}
          busy={busy}
          onPropose={() => act(client.proposeChallenger(t.id))}
          onManual={(v) => act(client.setChallenger(t.id, v))}
          onLaunch={() => act(client.launch(t.id), isReal ? "라운드를 게재했어요 — Meta 결산까지 기다려요" : undefined)}
        />
      )}

      {(beat === "live" || (beat === "auto-running" && t.rounds.some((r) => r.status === "running"))) &&
        (isReal ? <RealLivePanel t={t} /> : <LivePanel t={t} />)}

      {beat === "auto-running" && !t.rounds.some((r) => r.status === "running") && (
        <AutoBetweenPanel lastSettled={lastSettled} dailyBudget={t.dailyBudget} spec={spec} isReal={isReal} />
      )}

      {beat === "anomaly" && (
        <AnomalyPanel
          t={t}
          lastSettled={lastSettled}
          busy={busy}
          isReal={isReal}
          onPropose={() => act(client.proposeChallenger(t.id))}
          onManual={(v) => act(client.setChallenger(t.id, v))}
          onDiscard={() => act(client.discardChallenger(t.id))}
          onAccept={() => act(client.resolveAnomaly(t.id), "챌린저를 교체했어요 — 자동 진행을 재개해요")}
          onEnd={() => act(client.end(t.id), "토너먼트를 종료했어요")}
        />
      )}

      {beat === "winner-handling" && (
        <WinnerHandlingPanel
          t={t}
          onPromote={() => router.push("/create")}
          onRefill={() => act(client.refillEnvelope(t.id), "예산을 리필했어요 — 자동 진행을 재개해요")}
          onArchive={() => act(client.end(t.id), "토너먼트를 마치고 보관했어요")}
        />
      )}

      {beat === "between" && (
        <BetweenPanel
          lastSettled={lastSettled}
          dailyBudget={t.dailyBudget}
          spec={spec}
          nextAxisLabel={nextAxisLabel}
          busy={busy}
          isReal={isReal}
          onPropose={() => act(client.proposeChallenger(t.id))}
          onEnd={() => act(client.end(t.id))}
        />
      )}

      {beat === "done" && <DonePanel t={t} onCreate={() => router.push("/create")} />}

      {/* 라운드 기록 — 결산 ≥2 라운드일 때만 (N=1 이면 결산 카드와 완전 중복) */}
      {settledRounds.length >= 2 && (
        <RoundHistory
          rounds={settledRounds}
          dailyBudget={t.dailyBudget}
          spec={spec}
          isReal={isReal}
          summary={`${settledRounds.length}라운드 동안 ${spec.rateLabel} ${formatPrimary(spec, startCtr)} → ${formatPrimary(spec, t.championCtr)}${
            liftPct > 0.5 ? ` · +${liftPct.toFixed(0)}%` : ""
          }`}
        />
      )}

      {/* ADR-044/047 학습 노트 — 데모=localStorage Ledger, 실=tournaments 투영. 양쪽 공통. */}
      <LedgerPanel entries={ledger} />

      {/* 데모만 발표자 빨리감기 — 실 라운드는 서버 cron 이 결산·진행한다. */}
      {!isReal && <PresenterTournamentBar t={t} />}
    </div>
  );
}

/* ─── live 🤖 (실 유저) — cron 결산 대기 상태 카드 ────────── */

// 실 라운드는 발표자 빨리감기 없이 Meta 가 며칠 게재된다. 결산 전엔 세부 KPI 가 없으므로(폴러가 settle 시 채움)
// 게재 사실·경과·예정만 보여주고, 상세 폴링(30s)이 결산되면 자동으로 SettledResult 로 넘어간다.
function RealLivePanel({ t }: { t: Tournament }) {
  const round = t.rounds.find((r) => r.status === "running")!;
  const days = elapsedDays(round);
  const remain = Math.max(0, MIN_ROUND_DAYS - days);
  return (
    <div className="flex flex-col gap-4">
      <AutoBanner
        title={`라운드 ${round.index} 게재 중 — ${AXIS_LABEL[round.axis]} 비교`}
        desc="실제 Meta 광고로 챔피언(A)·챌린저(B)를 게재하고 있어요. 서버가 충분한 데이터가 쌓일 때까지 기다렸다가 자동으로 결산해요. 브라우저를 꺼도 진행돼요."
      />
      <div className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)]">
        <Icon name="spinner" size={13} spin />
        <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">
          게재 {days}일째 · {remain > 0 ? `최소 ${MIN_ROUND_DAYS}일 후 결산 (약 ${remain}일 남음)` : "결산 대기 중 — 곧 승자가 가려져요"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-bg-alternative)", border: "1.5px solid var(--w-line-normal)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center" }} className="font-bold text-[11px]">A</span>
            <span className="font-semibold text-[12.5px] text-[var(--w-fg-neutral)]">챔피언</span>
          </div>
          <VariantBody variant={round.champion} only={round.axis} />
        </Card>
        <Card className="p-4" style={{ borderColor: "var(--w-primary-normal)" }}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-primary-soft)", border: "1.5px solid var(--w-primary-normal)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }} className="font-bold text-[11px]">B</span>
            <span className="font-semibold text-[12.5px] text-[var(--w-primary-press)]">챌린저</span>
          </div>
          <VariantBody variant={round.challenger} highlight={round.axis} only={round.axis} />
        </Card>
      </div>
    </div>
  );
}

/* ─── 배너 ──────────────────────────────────────────────── */

function DecisionBanner({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-3 px-4 rounded-xl bg-[var(--w-primary-soft)] border border-[var(--w-primary-weak)]">
      <span className="text-[18px] leading-none mt-0.5">🧑</span>
      <div>
        <div className="font-bold text-[13.5px] leading-[1.4] text-[var(--w-primary-press)]">{title}</div>
        <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function AutoBanner({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-3 px-4 rounded-xl bg-[var(--w-bg-alternative)] border border-[var(--w-line-normal)]">
      <span className="text-[18px] leading-none mt-0.5">🤖</span>
      <div>
        <div className="font-bold text-[13.5px] leading-[1.4] text-[var(--w-fg-strong)]">{title}</div>
        <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

// ADR-044 — 라운드가 검증한 가설 + 근거 + verdict. SettledResult·라운드 기록·이상신호 카드 공용.
function HypothesisBanner({ h }: { h: Hypothesis }) {
  const v = h.verdict ? VERDICT_META[h.verdict] : null;
  return (
    <div className="flex items-start gap-3 py-3 px-4 rounded-xl bg-[var(--w-bg-alternative)] border border-[var(--w-line-normal)]">
      <span className="text-[16px] leading-none mt-0.5">🔬</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Chip variant="neutral">{leverLabel(h.lever)}</Chip>
          <span className="font-bold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">{h.statement}</span>
          {v && <Chip variant={v.chip} className="ml-auto">{v.mark} {v.label}{h.effectSize != null && h.verdict === "confirmed" ? ` +${h.effectSize}%` : ""}</Chip>}
        </div>
        <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">
          근거 〈{RATIONALE_SOURCE_LABEL[h.rationaleSource]}〉 · {h.rationale}
        </div>
      </div>
    </div>
  );
}

// ADR-044 Hypothesis Ledger 패널 — 이 제품 토너먼트에서 검증돼 브랜드에 누적된 가설(입증·반증·미결).
// 다음 가설 생성기가 읽는 학습 자산을 그대로 노출 — 음성 학습("긴박감 반증→회피")을 한눈에 보여준다.
function LedgerPanel({ entries }: { entries: Hypothesis[] }) {
  if (!entries.length) return null;
  // 레버별 최신 resolved 기준 집계 (같은 레버 재검증 시 마지막 판정).
  const byLever = new Map<string, Hypothesis>();
  for (const h of entries) if (h.verdict) byLever.set(h.lever, h);
  const list = [...byLever.values()];
  if (!list.length) return null;
  const order: HypothesisVerdict[] = ["confirmed", "refuted", "inconclusive"];
  list.sort((a, b) => order.indexOf(a.verdict!) - order.indexOf(b.verdict!));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="font-bold text-[14px] text-[var(--w-fg-strong)]">학습 노트</div>
        <div className="font-medium text-[12px] text-[var(--w-fg-neutral)]">브랜드에 누적된 검증 결과</div>
      </div>
      <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] mb-3">
        검증한 가설이 브랜드 지식으로 쌓여요. 다음 가설은 반증된 레버를 피하고 미탐색 레버를 우선해요. 이 학습은 카피를 만들 때 추천 훅에도 반영돼요.
      </div>
      <Card className="p-4 flex flex-wrap gap-2">
        {list.map((h) => {
          const v = VERDICT_META[h.verdict!];
          return (
            <span
              key={h.id}
              title={h.statement}
              className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border font-semibold text-[12px]"
              style={
                h.verdict === "confirmed"
                  ? { background: "var(--w-primary-soft)", borderColor: "var(--w-primary-weak)", color: "var(--w-primary-press)" }
                  : h.verdict === "refuted"
                    ? { background: "rgba(229,53,53,0.1)", borderColor: "rgba(229,53,53,0.34)", color: "#d92020" }
                    : { background: "var(--w-bg-alternative)", borderColor: "var(--w-line-normal)", color: "var(--w-fg-neutral)" }
              }
            >
              {leverLabel(h.lever)} <span className="opacity-70">{v.mark} {v.label}</span>
            </span>
          );
        })}
      </Card>
    </div>
  );
}

/* ─── 챔피언 카드 ───────────────────────────────────────── */

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-medium text-[11.5px] text-[var(--w-fg-alternative)]">{label}</span>
      <span className="font-bold text-[13px] text-[var(--w-fg-strong)]">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-[10.5px] text-[var(--w-fg-neutral)]">{label}</span>
      <span className="font-semibold text-[12.5px] text-[var(--w-fg-strong)]">{value}</span>
    </div>
  );
}

// Browse Mode 시연 광고 계정 — IG 프리뷰 핸들. 실연동 시 연결 IG 계정에서 도출.
const BRAND_HANDLE = "greenroutine_official";

// 변형 하나를 풀 IG 프리뷰로 — VS 컬럼/단독 공용. accent=챌린저(B) 강조, axisLabel=바뀐 축 배지.
// live=게시중 라운드 — 풀 IG 프리뷰 대신 헤드라인/광고카피 텍스트 비교(게재 전 검토 카드와 동일 스타일).
function VsPreviewColumn({ variant, likeCount, label, tag, accent, axisLabel, live, highlight }: {
  variant: TourVariant; likeCount: number; label: string; tag: string; accent?: boolean; axisLabel?: string; live?: boolean; highlight?: TourAxis;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <span
          style={{ width: 22, height: 22, borderRadius: "50%", background: accent ? "var(--w-primary-soft)" : "var(--w-bg-alternative)", border: `1.5px solid ${accent ? "var(--w-primary-normal)" : "var(--w-line-normal)"}`, color: accent ? "var(--w-primary-press)" : "var(--w-fg-neutral)", display: "grid", placeItems: "center" }}
          className="font-bold text-[11px]"
        >
          {label}
        </span>
        <span className="font-semibold text-[12.5px]" style={{ color: accent ? "var(--w-primary-press)" : "var(--w-fg-neutral)" }}>{tag}</span>
        {axisLabel && <Chip variant="review" className="ml-auto">{axisLabel} 변경</Chip>}
      </div>
      {live ? (
        <div className={`rounded-xl p-3 border ${accent ? "border-[var(--w-primary-normal)]" : "border-[var(--w-line-normal)]"}`}>
          <VariantBody variant={variant} highlight={highlight} noImage />
        </div>
      ) : (
        <div className={accent ? "rounded-[16px] p-1 -m-1 bg-[var(--w-primary-soft)]" : ""}>
          <IgPostPreview
            imageUrl={variant.imageUrl ?? ""}
            caption={variant.primaryText}
            headline={variant.headline}
            handle={BRAND_HANDLE}
            sponsored
            likeCount={likeCount}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

function ChampionCard({ champion, challenger, axis, ctr, spec, confirmed, note, live }: {
  champion: TourVariant; challenger?: TourVariant; axis?: TourAxis; ctr: number; spec: TourMetricSpec; confirmed: boolean; note?: string; live?: boolean;
}) {
  // 좋아요 수는 표시용 — cpm(원 단위)을 곱하면 비현실적이라 비율 지표일 때만 ctr 기반, 아니면 명목값.
  const likeBase = spec.kind === "cpm" ? 1.8 : ctr;
  const likeCount = Math.round(likeBase * 200);
  const vs = !!challenger;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--w-status-positive-soft)", color: "var(--w-status-positive)", display: "grid", placeItems: "center" }} className="font-bold text-[11px]">
          <Icon name="check-circle" size={15} />
        </span>
        <span className="font-bold text-[13px] text-[var(--w-fg-strong)]">{vs ? "챔피언 vs 챌린저" : "현재 챔피언"}</span>
        <Chip variant="neutral" className="ml-auto">{spec.rateLabel} {formatPrimary(spec, ctr)}</Chip>
        {!confirmed && <Chip variant="review">검토 대기</Chip>}
      </div>
      {note && (
        <div className="font-semibold text-[11.5px] text-[var(--w-status-positive)] -mt-1 mb-2.5">↑ {note}</div>
      )}
      {vs ? (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
          <VsPreviewColumn variant={champion} likeCount={likeCount} label="A" tag="챔피언" live={live} />
          <div className="self-center font-bold text-[12px] text-[var(--w-fg-alternative)] py-1.5 px-2.5 rounded-full bg-[var(--w-bg-alternative)] border border-[var(--w-line-normal)]">VS</div>
          <VsPreviewColumn variant={challenger!} likeCount={likeCount} label="B" tag="챌린저" accent axisLabel={axis ? AXIS_LABEL[axis] : undefined} live={live} highlight={axis} />
        </div>
      ) : (
        <div className="flex justify-center">
          <IgPostPreview
            imageUrl={champion.imageUrl ?? ""}
            caption={champion.primaryText}
            headline={champion.headline}
            handle={BRAND_HANDLE}
            sponsored
            likeCount={likeCount}
            className="w-full max-w-[360px]"
          />
        </div>
      )}
    </Card>
  );
}

// 금칙어가 들어간 부분을 빨간 글씨·배경으로 강조 (시연: 무엇이 걸렸는지 카드 안에서 바로 보이게).
function Prohibited({ text, words }: { text: string; words?: string[] }) {
  const hits = (words ?? []).map((w) => w.trim()).filter(Boolean);
  if (!hits.length || !text) return <>{text || "—"}</>;
  const re = new RegExp(`(${hits.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(re).map((p, i) =>
        hits.includes(p) ? (
          <span key={i} className="font-bold rounded px-1 mx-0.5" style={{ background: "rgba(229,53,53,0.14)", color: "#d92020" }}>{p}</span>
        ) : (
          p
        ),
      )}
    </>
  );
}

// only 가 주어지면 그 축 한 필드만 노출 (head-to-head 카드는 바뀐 축만, 앵커·검토 카드는 전문).
function VariantBody({ variant, highlight, only, prohibited, noImage }: { variant: TourVariant; highlight?: TourAxis; only?: TourAxis; prohibited?: string[]; noImage?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {variant.imageUrl && !noImage && (!only || only === "image") && (
        <div className={highlight === "image" ? "rounded-lg p-1 -m-1 bg-[var(--w-primary-soft)]" : ""}>
          <img src={variant.imageUrl} alt="광고 이미지" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: "1px solid var(--w-line-normal)" }} />
        </div>
      )}
      {(!only || only === "headline") && (
        <div className={highlight === "headline" ? "rounded-lg px-2 py-1 -mx-2 bg-[var(--w-primary-soft)]" : ""}>
          <div className="font-medium text-[11px] text-[var(--w-fg-alternative)] mb-0.5">헤드라인</div>
          <div className="font-semibold text-[14.5px] leading-[1.4] text-[var(--w-fg-strong)]"><Prohibited text={variant.headline} words={prohibited} /></div>
        </div>
      )}
      {(!only || only === "primary_text") && (
        <div className={highlight === "primary_text" ? "rounded-lg px-2 py-1 -mx-2 bg-[var(--w-primary-soft)]" : ""}>
          <div className="font-medium text-[11px] text-[var(--w-fg-alternative)] mb-0.5">광고 카피</div>
          <div className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]"><Prohibited text={variant.primaryText} words={prohibited} /></div>
        </div>
      )}
    </div>
  );
}

/* ─── champion-review 🧑 ───────────────────────────────── */

function ChampionReview({ t, busy, onRegenerate, onConfirm }: {
  t: Tournament; busy: boolean; onRegenerate: () => void; onConfirm: (edited?: TourVariant) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TourVariant>(t.champion);

  return (
    <div className="flex flex-col gap-4">
      <DecisionBanner title="출발 챔피언을 검토해주세요" desc="이 광고로 토너먼트를 시작해요. 마음에 들지 않으면 AI 에게 다시 받거나 직접 고칠 수 있어요." />
      {editing ? (
        <VariantEditor
          value={draft}
          onChange={setDraft}
          onCancel={() => { setDraft(t.champion); setEditing(false); }}
          onSave={() => { onConfirm(draft); setEditing(false); }}
          saveLabel="이 광고로 확정"
        />
      ) : (
        <div className="flex gap-2.5">
          <Button variant="secondary" type="button" disabled={busy} onClick={onRegenerate}>
            {busy ? <><Icon name="spinner" size={14} spin /> 생성 중…</> : <><Icon name="sparkles" size={14} /> 다시 생성</>}
          </Button>
          <Button variant="secondary" type="button" disabled={busy} onClick={() => { setDraft(t.champion); setEditing(true); }}>직접 수정</Button>
          <Button variant="primary" type="button" disabled={busy} className="ml-auto" onClick={() => onConfirm()}>
            <Icon name="check" size={14} /> 이 광고로 확정
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── challenger-review 🧑 ─────────────────────────────── */

function ChallengerReview({ t, challenger, busy, onPropose, onManual, onLaunch }: {
  t: Tournament; challenger: TourVariant; busy: boolean;
  onPropose: () => void; onManual: (v: TourVariant) => void; onLaunch: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TourVariant>(challenger);
  const roundIndex = t.rounds.length + 1;
  // 챔피언과 다른 필드 = 이번 라운드 축 (이미지 포함).
  const axis = deriveAxis(t.champion, challenger);

  return (
    <div className="flex flex-col gap-4">
      <DecisionBanner
        title={`라운드 ${roundIndex} 챌린저 — ${AXIS_LABEL[axis]}만 바꿔봤어요`}
        desc="챔피언(A)과 챌린저(B)를 나란히 비교해요. 게재하면 빨리감기로 성과를 쌓아 우세 안을 가립니다."
      />
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-bg-alternative)", border: "1.5px solid var(--w-line-normal)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center" }} className="font-bold text-[11px]">A</span>
            <span className="font-semibold text-[12.5px] text-[var(--w-fg-neutral)]">챔피언</span>
          </div>
          <VariantBody variant={t.champion} />
        </Card>
        <Card className="p-4" style={{ borderColor: "var(--w-primary-normal)" }}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-primary-soft)", border: "1.5px solid var(--w-primary-normal)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }} className="font-bold text-[11px]">B</span>
            <span className="font-semibold text-[12.5px] text-[var(--w-primary-press)]">챌린저</span>
          </div>
          {editing ? null : <VariantBody variant={challenger} highlight={axis} />}
        </Card>
      </div>

      {editing ? (
        <VariantEditor
          value={draft}
          onChange={setDraft}
          onCancel={() => { setDraft(challenger); setEditing(false); }}
          onSave={() => { onManual(draft); setEditing(false); }}
          saveLabel="챌린저로 반영"
        />
      ) : (
        <div className="flex gap-2.5">
          <Button variant="secondary" type="button" disabled={busy} onClick={onPropose}>
            {busy ? <><Icon name="spinner" size={14} spin /> 생성 중…</> : <><Icon name="sparkles" size={14} /> 다른 제안</>}
          </Button>
          <Button variant="secondary" type="button" disabled={busy} onClick={() => { setDraft(challenger); setEditing(true); }}>직접 수정</Button>
          <Button variant="primary" type="button" disabled={busy} className="ml-auto" onClick={onLaunch}>
            <Icon name="play" size={14} /> 게재하기
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── live 🤖 ───────────────────────────────────────────── */

function LivePanel({ t }: { t: Tournament }) {
  const spec = tourMetricSpec(t.objective);
  const round = t.rounds.find((r) => r.status === "running")!;
  const kpis = roundAdKpis(round, t.championCtr, t.dailyBudget, undefined, t.objective);
  const hasData = round.fastForwardDays > 0;
  const report = buildRoundReport(kpis, { seed: round.campaignId, dailyBudget: t.dailyBudget, days: round.fastForwardDays, objective: t.objective });
  const pa = primaryMetricValue(spec, report.ads[0]);
  const pb = primaryMetricValue(spec, report.ads[1]);

  return (
    <div className="flex flex-col gap-4">
      <AutoBanner
        title={`라운드 ${round.index} 게재 중 — ${AXIS_LABEL[round.axis]} 비교`}
        desc={hasData
          ? "성과가 쌓이고 있어요. 하단 발표자 빨리감기 +7일로 충분한 데이터가 모이면 자동 결산해요."
          : "방금 게재했어요. 하단 발표자 빨리감기 +7일을 눌러 성과를 쌓아보세요."}
      />
      <VerdictStrip live />
      <div className="grid grid-cols-2 gap-4">
        <AdMetricCard label="A" tag="챔피언" variant={round.champion} ad={report.ads[0]} spec={spec} hasData={hasData} accent={false} axis={round.axis} delta={primaryDelta(spec, pa, pb)} />
        <AdMetricCard label="B" tag="챌린저" variant={round.challenger} ad={report.ads[1]} spec={spec} hasData={hasData} accent axis={round.axis} delta={primaryDelta(spec, pb, pa)} />
      </div>
    </div>
  );
}

function MetricCat({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--w-bg-alternative)] p-3">
      <div className="grid grid-cols-2 gap-y-2 gap-x-4">{children}</div>
    </div>
  );
}

function AdMetricCard({ label, tag, variant, ad, spec, hasData, accent, mark, axis, prohibited, real, delta }: {
  label: string; tag: string; variant: TourVariant; ad: AdReport; spec: TourMetricSpec;
  hasData: boolean; accent: boolean; mark?: string; axis: TourAxis; prohibited?: string[]; real?: boolean; delta?: number;
}) {
  const v = (s: string) => (hasData ? s : "—");
  const lead = hasData && delta != null && delta > spec.leadEpsilon;
  const leadStr = spec.kind === "cpm" ? krw(Math.round(delta ?? 0)) : (delta ?? 0).toFixed(2);
  return (
    <Card className="p-4" style={accent ? { borderColor: "var(--w-primary-normal)" } : undefined}>
      <div className="flex items-center gap-1.5 mb-3">
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: accent ? "var(--w-primary-soft)" : "var(--w-bg-alternative)", border: `1.5px solid ${accent ? "var(--w-primary-normal)" : "var(--w-line-normal)"}`, color: accent ? "var(--w-primary-press)" : "var(--w-fg-neutral)", display: "grid", placeItems: "center" }} className="font-bold text-[11px]">{label}</span>
        <span className="font-semibold text-[12.5px]" style={{ color: accent ? "var(--w-primary-press)" : "var(--w-fg-neutral)" }}>{tag}</span>
        {mark && <Chip variant={mark === "승격" ? "live" : "neutral"}>{mark}</Chip>}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-semibold text-[10px] uppercase tracking-[0.05em] text-[var(--w-fg-alternative)]">{spec.rateLabel}</span>
        <span className="font-bold text-[26px] leading-none tabular-nums" style={{ color: accent ? "var(--w-primary-press)" : "var(--w-fg-strong)" }}>{hasData ? formatPrimary(spec, primaryMetricValue(spec, ad)) : "—"}</span>
        {lead && <span className="font-bold text-[12.5px] text-[var(--w-status-positive)]">▲ {leadStr}</span>}
      </div>
      <VariantBody variant={variant} only={axis} prohibited={prohibited} />
      {/* 실 유저 — Meta 실측 4지표 + 실측 파생 단가(CPM·CPC)만. reach·빈도·링크클릭은 시드 추정이라 숨김(ADR-038 fake-performance). */}
      {real ? (
        <div className="mt-3 pt-3 border-t border-[var(--w-line-normal)] flex flex-col gap-3">
          <MetricCat>
            <Metric label="노출" value={v(ad.impressions.toLocaleString("ko-KR"))} />
            <Metric label="클릭" value={v(ad.clicks.toLocaleString("ko-KR"))} />
          </MetricCat>
          <MetricCat>
            <Metric label="지출" value={v(krw(ad.spend))} />
            <Metric label="CPM" value={v(krw(ad.cpm))} />
            <Metric label="CPC" value={v(krw(ad.cpc))} />
          </MetricCat>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-[var(--w-line-normal)] flex flex-col gap-3">
          <MetricCat>
            <Metric label="노출" value={v(ad.impressions.toLocaleString("ko-KR"))} />
            <Metric label="도달" value={v(ad.reach.toLocaleString("ko-KR"))} />
            <Metric label="빈도" value={v(ad.frequency.toFixed(2))} />
            <Metric label="CPM" value={v(krw(ad.cpm))} />
          </MetricCat>
          <MetricCat>
            <Metric label="클릭" value={v(ad.clicks.toLocaleString("ko-KR"))} />
            <Metric label="링크 클릭" value={v(ad.linkClicks.toLocaleString("ko-KR"))} />
            <Metric label="CPC" value={v(krw(ad.cpc))} />
          </MetricCat>
          <MetricCat>
            <Metric label="지출" value={v(krw(ad.spend))} />
            <Metric label="남은 예산" value={v(krw(ad.budgetRemaining))} />
          </MetricCat>
        </div>
      )}
    </Card>
  );
}

// Meta A/B 최종 판정 박스 — winner/confidence_level/status. 결산 후에만 확정, 라이브는 측정 중.
function VerdictStrip({ report, winnerIsB, live }: { report?: RoundReport; winnerIsB?: boolean; live?: boolean }) {
  if (live || !report) {
    return (
      <div className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)]">
        <Icon name="spinner" size={13} spin />
        <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">측정 중 — 결산하면 승자·신뢰도가 확정돼요</span>
      </div>
    );
  }
  const completed = report.status === "COMPLETED";
  const pct = Math.round(report.confidenceLevel * 100);
  return (
    <div className="flex flex-col gap-2 py-3 px-4 rounded-xl" style={{ background: "var(--w-primary-soft)", border: "1px solid var(--w-primary-weak)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[15px] leading-none">🏆</span>
        <span className="font-bold text-[12.5px] text-[var(--w-primary-press)]">최종 판정</span>
        <span className="font-semibold text-[12.5px] text-[var(--w-fg-strong)]">승자 {winnerIsB ? "B안 (챌린저)" : "A안 (챔피언)"}</span>
        <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">· 신뢰도 {pct}%</span>
        <Chip variant={completed ? "live" : "neutral"} className="ml-auto">{report.status}</Chip>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--w-line-normal)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: completed ? "var(--w-primary-normal)" : "var(--w-fg-alternative)" }} />
      </div>
    </div>
  );
}

/* ─── between (result 🤖 + continue/end 🧑) ─────────────── */

function BetweenPanel({ lastSettled, dailyBudget, spec, nextAxisLabel, busy, isReal, onPropose, onEnd }: {
  lastSettled: TourRound | null; dailyBudget: number; spec: TourMetricSpec; nextAxisLabel: string; busy: boolean; isReal: boolean; onPropose: () => void; onEnd: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {lastSettled && <SettledResult round={lastSettled} dailyBudget={dailyBudget} spec={spec} isReal={isReal} />}
      <DecisionBanner
        title={lastSettled ? "다음 라운드를 진행할까요?" : "첫 챌린저를 붙여볼까요?"}
        desc={lastSettled
          ? `우세 안이 다음 챔피언으로 승격됐어요. 다음 라운드는 ${nextAxisLabel} 축을 바꿔 비교해요. 새 챌린저를 붙이거나 여기서 토너먼트를 마칠 수 있어요.`
          : `확정한 챔피언에 도전할 챌린저를 AI 가 제안해요. 이번 라운드는 ${nextAxisLabel} 축을 바꿔 비교합니다.`}
      />
      <div className="flex gap-2.5">
        <Button variant="primary" type="button" disabled={busy} onClick={onPropose}>
          {busy ? <><Icon name="spinner" size={14} spin /> 생성 중…</> : <><Icon name="sparkles" size={14} /> {lastSettled ? "다음 챌린저 제안" : "챌린저 제안 받기"}</>}
        </Button>
        <Button variant="secondary" type="button" disabled={busy} className="ml-auto" onClick={onEnd}>토너먼트 종료</Button>
      </div>
    </div>
  );
}

function SettledResult({ round, dailyBudget, spec, prohibited, isReal }: { round: TourRound; dailyBudget: number; spec: TourMetricSpec; prohibited?: string[]; isReal?: boolean }) {
  const winnerIsB = round.rawWinner === "B";
  const kpis = round.adKpis ?? [
    { ctr: round.verdict?.ctrA ?? 0, impressions: 0, clicks: 0, spend: 0 },
    { ctr: round.verdict?.ctrB ?? 0, impressions: 0, clicks: 0, spend: 0 },
  ];
  // 실 라운드는 fastForwardDays 가 없으므로 게재 기간(MIN_ROUND_DAYS)으로 예산 파생(표시 단가용).
  const reportDays = isReal ? MIN_ROUND_DAYS : round.fastForwardDays;
  const report = buildRoundReport(kpis, { seed: round.campaignId, dailyBudget, days: reportDays, objective: spec.id });
  const completed = report.status === "COMPLETED";
  const pct = Math.round(report.confidenceLevel * 100);
  const sig = completed ? `통계적으로 유의 (신뢰도 ${pct}%)` : `통계적으론 불충분 (신뢰도 ${pct}%)`;
  const promo = winnerIsB
    ? completed
      ? "챌린저가 새 챔피언으로 승격됐어요."
      : `그래도 ${spec.rateLabel} 우위라 챌린저를 잠정 승격 — 다음 라운드에서 재검증해요.`
    : "챔피언이 자리를 지켰어요.";
  const pa = primaryMetricValue(spec, report.ads[0]);
  const pb = primaryMetricValue(spec, report.ads[1]);
  return (
    <div className="flex flex-col gap-3">
      {round.hypothesis && <HypothesisBanner h={round.hypothesis} />}
      <AutoBanner
        title={`라운드 ${round.index} 결산 — ${winnerIsB ? "챌린저(B) 우세" : "챔피언(A) 방어"}`}
        desc={`${round.hypothesis ? leverLabel(round.hypothesis.lever) : AXIS_LABEL[round.axis]} 비교 · ${sig} · ${promo}`}
      />
      <VerdictStrip report={report} winnerIsB={winnerIsB} />
      <div className="grid grid-cols-2 gap-4">
        <AdMetricCard label="A" tag="챔피언" variant={round.champion} ad={report.ads[0]} spec={spec} hasData accent={!winnerIsB} mark={winnerIsB ? undefined : "방어"} axis={round.axis} real={isReal} delta={primaryDelta(spec, pa, pb)} />
        <AdMetricCard label="B" tag="챌린저" variant={round.challenger} ad={report.ads[1]} spec={spec} hasData accent={winnerIsB} mark={winnerIsB ? "승격" : undefined} axis={round.axis} prohibited={prohibited} real={isReal} delta={primaryDelta(spec, pb, pa)} />
      </div>
    </div>
  );
}

/* ─── auto-running (무인 라운드 전환) 🤖 ─────────────────── */

function AutoBetweenPanel({ lastSettled, dailyBudget, spec, isReal }: { lastSettled: TourRound | null; dailyBudget: number; spec: TourMetricSpec; isReal: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {lastSettled && <SettledResult round={lastSettled} dailyBudget={dailyBudget} spec={spec} isReal={isReal} />}
      <AutoBanner
        title="자동 진행 중 — 다음 챌린저를 준비하고 있어요"
        desc={isReal
          ? "AI 가 우세 안을 챔피언으로 올리고 다음 챌린저를 자동으로 붙여요. 서버가 다음 라운드를 게재하면 여기서 이어볼 수 있어요."
          : "AI 가 우세 안을 챔피언으로 올리고 다음 챌린저를 자동으로 붙여요. 하단 발표자 빨리감기 +7일로 다음 라운드를 굴려보세요."}
      />
    </div>
  );
}

/* ─── anomaly (이상 신호) 🧑 — ADR-035 ⓑ ───────────────── */

function AnomalyPanel({ t, lastSettled, busy, isReal, onPropose, onManual, onDiscard, onAccept, onEnd }: {
  t: Tournament; lastSettled: TourRound | null; busy: boolean; isReal: boolean;
  onPropose: () => Promise<void>; onManual: (v: TourVariant) => void; onDiscard: () => void;
  onAccept: () => void; onEnd: () => void;
}) {
  const a = detectAnomaly(t);
  const [revising, setRevising] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TourVariant>(t.champion);

  const reason =
    a?.kind === "prohibited"
      ? "최근 챌린저 문구가 브랜드 금칙어에 걸렸어요. 무인이라도 브랜드 리스크는 사람이 확인해요."
      : "새 챌린저가 연속 2라운드 챔피언을 이기지 못했어요. 성과가 정체됐는지 확인이 필요해요.";
  const fixHint =
    a?.kind === "prohibited"
      ? "금칙어를 뺀 새 챌린저로 교체하면 안전하게 이어갈 수 있어요."
      : "다른 각도의 챌린저로 교체해 정체를 깨보세요.";

  const Warning = (
    <div
      className="flex items-start gap-3 py-3 px-4 rounded-xl"
      style={{ background: "rgba(255,146,0,0.08)", border: "1px solid rgba(255,146,0,0.34)" }}
    >
      <span className="text-[18px] leading-none mt-0.5">⚠️</span>
      <div>
        <div className="font-bold text-[13.5px] leading-[1.4] text-[#9c5800] dark:text-[#ffb24d]">이상 신호로 자동 진행을 멈췄어요</div>
        <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-0.5">{reason}</div>
        {a?.kind === "prohibited" && !!a.words?.length && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">걸린 금칙어</span>
            {a.words.map((w) => (
              <span
                key={w}
                className="font-bold text-[12px] leading-none py-1 px-2 rounded-md"
                style={{ background: "rgba(229,53,53,0.12)", color: "#d92020", border: "1px solid rgba(229,53,53,0.4)" }}
              >
                {w}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // 손보기 흐름 — 다음 챌린저(pending)를 AI 재생성/직접 수정으로 교체한 뒤 재개.
  if (revising && t.pendingChallenger) {
    const challenger = t.pendingChallenger;
    const axis = deriveAxis(t.champion, challenger);
    return (
      <div className="flex flex-col gap-4">
        {Warning}
        <DecisionBanner title={`교체할 챌린저 — ${AXIS_LABEL[axis]} 변경`} desc={`${fixHint} AI 에게 다시 받거나 직접 고친 뒤 이걸로 재개해요.`} />
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-bg-alternative)", border: "1.5px solid var(--w-line-normal)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center" }} className="font-bold text-[11px]">A</span>
              <span className="font-semibold text-[12.5px] text-[var(--w-fg-neutral)]">챔피언</span>
            </div>
            <VariantBody variant={t.champion} />
          </Card>
          <Card className="p-4" style={{ borderColor: "var(--w-primary-normal)" }}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-primary-soft)", border: "1.5px solid var(--w-primary-normal)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }} className="font-bold text-[11px]">B</span>
              <span className="font-semibold text-[12.5px] text-[var(--w-primary-press)]">새 챌린저</span>
            </div>
            {editing ? null : <VariantBody variant={challenger} highlight={axis} />}
          </Card>
        </div>
        {editing ? (
          <VariantEditor
            value={draft}
            onChange={setDraft}
            onCancel={() => { setDraft(challenger); setEditing(false); }}
            onSave={() => { onManual(draft); setEditing(false); }}
            saveLabel="챌린저로 반영"
          />
        ) : (
          <div className="flex gap-2.5">
            <Button variant="secondary" type="button" disabled={busy} onClick={onPropose}>
              {busy ? <><Icon name="spinner" size={14} spin /> 생성 중…</> : <><Icon name="sparkles" size={14} /> 다시 생성</>}
            </Button>
            <Button variant="secondary" type="button" disabled={busy} onClick={() => { setDraft(challenger); setEditing(true); }}>직접 수정</Button>
            <Button variant="ghost" type="button" disabled={busy} onClick={() => { onDiscard(); setRevising(false); }}>취소</Button>
            <Button variant="primary" type="button" disabled={busy} className="ml-auto" onClick={onAccept}>
              <Icon name="check" size={14} /> 이걸로 재개
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {lastSettled && <SettledResult round={lastSettled} dailyBudget={t.dailyBudget} spec={tourMetricSpec(t.objective)} prohibited={a?.kind === "prohibited" ? a.words : undefined} isReal={isReal} />}
      {Warning}
      <div className="flex gap-2.5">
        <Button variant="primary" type="button" disabled={busy} onClick={async () => { await onPropose(); setRevising(true); }}>
          {busy ? <><Icon name="spinner" size={14} spin /> 생성 중…</> : <><Icon name="sparkles" size={14} /> 챌린저 수정하기</>}
        </Button>
        <Button variant="secondary" type="button" disabled={busy} className="ml-auto" onClick={onEnd}>토너먼트 종료</Button>
      </div>
    </div>
  );
}

/* ─── winner-handling (봉투 소진) 🧑 — ADR-035 ⓐ ────────── */

function WinnerHandlingPanel({ t, onPromote, onRefill, onArchive }: {
  t: Tournament; onPromote: () => void; onRefill: () => void; onArchive: () => void;
}) {
  const spec = tourMetricSpec(t.objective);
  const startCtr = t.rounds[0]?.verdict?.ctrA ?? t.championCtr;
  const lift = startCtr > 0 ? (primaryDelta(spec, t.championCtr, startCtr) / startCtr) * 100 : 0;
  const settled = t.rounds.filter((r) => r.status === "settled").length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 py-4 px-5 rounded-xl bg-[var(--w-primary-soft)] border border-[var(--w-primary-weak)]">
        <span className="text-[22px] leading-none">🏆</span>
        <div>
          <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-primary-press)]">예산을 다 썼어요 — 위너 처리를 결정해주세요</div>
          <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">
            {settled}개 라운드 무인 진행 · 최종 {spec.rateLabel} {formatPrimary(spec, t.championCtr)}
            {lift > 0.5 && <span className="text-[var(--w-status-positive)] font-semibold"> · 출발 대비 +{lift.toFixed(0)}%</span>}
            . 돈이 드는 결정이라 자동으로 넘기지 않아요.
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" type="button" onClick={onPromote}>
          <Icon name="sparkles" size={14} /> 실제 캠페인으로 승격
        </Button>
        <Button variant="secondary" type="button" onClick={onRefill}>예산 리필해서 계속</Button>
        <Button variant="secondary" type="button" className="ml-auto" onClick={onArchive}>종료하고 보관</Button>
      </div>
    </div>
  );
}

/* ─── done ──────────────────────────────────────────────── */

function DonePanel({ t, onCreate }: { t: Tournament; onCreate: () => void }) {
  const spec = tourMetricSpec(t.objective);
  const startCtr = t.rounds[0]?.verdict?.ctrA ?? t.championCtr;
  const lift = startCtr > 0 ? (primaryDelta(spec, t.championCtr, startCtr) / startCtr) * 100 : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 py-4 px-5 rounded-xl" style={{ background: "var(--w-primary-soft)", border: "1px solid var(--w-primary-weak)" }}>
        <span className="text-[22px] leading-none">🏆</span>
        <div>
          <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-primary-press)]">토너먼트 완료 — 최종 챔피언이 정해졌어요</div>
          <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">
            {t.rounds.filter((r) => r.status === "settled").length}개 라운드 진행 · 최종 {spec.rateLabel} {formatPrimary(spec, t.championCtr)}
            {lift > 0.5 && <span className="text-[var(--w-status-positive)] font-semibold"> · 출발 대비 +{lift.toFixed(0)}%</span>}
          </div>
        </div>
      </div>
      <Button variant="primary" type="button" onClick={onCreate} className="w-fit">
        <Icon name="sparkles" size={14} /> 이 챔피언으로 광고 만들기
      </Button>
    </div>
  );
}

/* ─── 라운드 기록 ───────────────────────────────────────── */

function RoundHistory({ rounds, summary, dailyBudget, spec, isReal }: { rounds: TourRound[]; summary: string; dailyBudget: number; spec: TourMetricSpec; isReal: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="font-bold text-[14px] text-[var(--w-fg-strong)]">라운드 기록</div>
        <div className="font-medium text-[12px] text-[var(--w-fg-neutral)]">{summary}</div>
      </div>
      <div className="flex flex-col gap-2">
        {rounds.map((r) => {
          const winnerIsB = r.rawWinner === "B";
          const imp = (r.adKpis?.[0].impressions ?? 0) + (r.adKpis?.[1].impressions ?? 0);
          const spend = (r.adKpis?.[0].spend ?? 0) + (r.adKpis?.[1].spend ?? 0);
          const expanded = open === r.index;
          return (
            <div key={r.index} className="flex flex-col">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : r.index)}
                aria-expanded={expanded}
                className="flex items-center gap-3 py-3 px-4 rounded-xl bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] text-left cursor-pointer hover:border-[var(--w-line-strong)] transition-colors"
              >
                <span className="font-bold text-[12px] text-[var(--w-fg-alternative)] w-12">R{r.index}</span>
                <Chip variant="neutral">{r.hypothesis ? leverLabel(r.hypothesis.lever) : AXIS_LABEL[r.axis]}</Chip>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium text-[12.5px] text-[var(--w-fg-neutral)] truncate">
                    {r.hypothesis ? r.hypothesis.statement : `A ${formatPrimary(spec, r.verdict?.ctrA ?? 0)} → B ${formatPrimary(spec, r.verdict?.ctrB ?? 0)}`}
                    {winnerIsB && <span className="text-[var(--w-status-positive)] font-semibold"> ▲</span>}
                  </span>
                  <span className="font-medium text-[11px] text-[var(--w-fg-alternative)]">
                    노출 {imp.toLocaleString("ko-KR")} · 지출 {krw(spend)}
                  </span>
                </div>
                {r.hypothesis?.verdict ? (
                  <Chip variant={VERDICT_META[r.hypothesis.verdict].chip} className="ml-auto">
                    {VERDICT_META[r.hypothesis.verdict].mark} {VERDICT_META[r.hypothesis.verdict].label}
                  </Chip>
                ) : (
                  <Chip variant={winnerIsB ? "live" : "neutral"} className="ml-auto">
                    {winnerIsB ? "챌린저 승격" : "챔피언 방어"}
                  </Chip>
                )}
                <Icon name="chev-down" size={16} className={`text-[var(--w-fg-alternative)] transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <div className="mt-2">
                  <SettledResult round={r} dailyBudget={dailyBudget} spec={spec} isReal={isReal} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 변형 편집기 ───────────────────────────────────────── */

function VariantEditor({ value, onChange, onCancel, onSave, saveLabel }: {
  value: TourVariant; onChange: (v: TourVariant) => void; onCancel: () => void; onSave: () => void; saveLabel: string;
}) {
  const canSave = value.headline.trim() && value.primaryText.trim();
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div>
        <div className="font-medium text-[11px] text-[var(--w-fg-alternative)] mb-1">헤드라인</div>
        <input
          type="text"
          value={value.headline}
          onChange={(e) => onChange({ ...value, headline: e.target.value })}
          className="w-full bg-[var(--w-bg-normal)] border border-[var(--w-line-normal)] rounded-lg px-3 py-2.5 font-semibold text-[14px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)]"
        />
      </div>
      <div>
        <div className="font-medium text-[11px] text-[var(--w-fg-alternative)] mb-1">광고 카피</div>
        <textarea
          value={value.primaryText}
          onChange={(e) => onChange({ ...value, primaryText: e.target.value })}
          rows={3}
          className="w-full bg-[var(--w-bg-normal)] border border-[var(--w-line-normal)] rounded-lg px-3 py-2.5 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] resize-none"
        />
      </div>
      <div className="flex gap-2.5">
        <Button variant="secondary" type="button" onClick={onCancel}>취소</Button>
        <Button variant="primary" type="button" disabled={!canSave} className="ml-auto" onClick={onSave}>{saveLabel}</Button>
      </div>
    </Card>
  );
}
