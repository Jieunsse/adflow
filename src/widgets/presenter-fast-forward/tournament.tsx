"use client";

// ADR-033 — A/B 토너먼트(흐름2) 전용 Presenter Fast-Forward 바. /ab-tests/[id] 하단 Browse Mode 한정 floating 컨트롤.
// 라이브 라운드가 있으면 +7일로 시간을 건너뛰어 성과를 쌓고, 데이터가 충분해지면 자동 결산(🤖)한다.
// production 기능 아님 — 상세 페이지가 browseMode + getTournament 일 때만 렌더한다.

import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { useToast } from "@shared/ui/Toast";
import { roundAdKpis, deriveBeat, AXIS_LABEL, type Tournament } from "@entities/ab-test/tournament/tournament";
import { tourMetricSpec, formatPrimary, primaryMetricValue } from "@entities/ab-test/tournament/objective-metric";
import { resetTournamentDemo } from "@entities/ab-test/tournament/seed";
import { demoSettleRound, demoAutoAdvance } from "@entities/ab-test/tournament/client";
import { usePresenterConsole } from "@shared/lib/usePresenterConsole";
import { PresenterConsoleShell, ConsoleBigNumber, ConsoleInfoRow, ConsoleStatusBadge } from "./console-shell";

export default function PresenterTournamentBar({ t }: { t: Tournament }) {
  const router = useRouter();
  const showToast = useToast();
  const [consoleOn] = usePresenterConsole();

  const spec = tourMetricSpec(t.objective);
  const active = t.rounds.find((r) => r.status === "running") ?? null;
  const live = active ? roundAdKpis(active, t.championCtr, t.dailyBudget, undefined, t.objective) : null;
  // auto 무인: 라이브 라운드가 없어도 다음 챌린저를 자동 게재(auto-advance)할 수 있다.
  const canAdvance = !!active || (t.mode === "auto" && deriveBeat(t) === "auto-running");

  const fastForward = async () => {
    if (active) {
      // 라이브 라운드 결산만 — 결과를 화면에 남긴 뒤, 다음 +7 에서 다음 챌린저를 게재한다.
      const res = await demoSettleRound(t.id, active.fastForwardDays + 7);
      if (res.status === "settled") {
        const who = res.winnerIsB ? "챌린저(B)" : "챔피언(A)";
        const verb = res.winnerIsB ? "우세 — 다음 챔피언으로 승격" : "방어";
        showToast(`라운드 ${res.round.index} 결산: ${who} ${verb} (${spec.rateLabel} ${formatPrimary(spec, res.winnerCtr)})`);
      } else if (res.status === "insufficient") {
        showToast("아직 데이터가 부족해요 — 한 번 더 빨리감기 해보세요");
      }
      return;
    }
    // ADR-035 — 라이브 라운드가 없을 때만 다음 챌린저를 자동 생성·게재 (무인 체인).
    if (t.mode === "auto") await demoAutoAdvance(t.id);
  };

  const reset = () => {
    resetTournamentDemo();
    showToast("둘러보기 토너먼트를 초기화했어요");
    router.push("/ab-tests");
  };

  const settledCount = t.rounds.filter((r) => r.status === "settled").length;

  if (!consoleOn) return null;

  const body =
    active && live ? (
      <>
        <ConsoleBigNumber
          label={`라운드 ${active.index} · ${AXIS_LABEL[active.axis]}`}
          value={active.fastForwardDays}
          unit="일차"
        />
        {active.fastForwardDays > 0 && (
          <div className="flex flex-col gap-2">
            <ConsoleInfoRow label={`A안 ${spec.rateLabel}`} value={formatPrimary(spec, primaryMetricValue(spec, live[0]))} />
            <ConsoleInfoRow label={`B안 ${spec.rateLabel}`} value={formatPrimary(spec, primaryMetricValue(spec, live[1]))} />
          </div>
        )}
      </>
    ) : t.status === "completed" ? (
      <ConsoleStatusBadge ok icon="check-circle">토너먼트 완료 · {settledCount}라운드</ConsoleStatusBadge>
    ) : (
      <span className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
        {settledCount}/{t.maxRounds ?? "—"}라운드 완료 · 챌린저를 게재하면 빨리감기로 결산해요
      </span>
    );

  return (
    <PresenterConsoleShell
      body={body}
      actions={
        <>
          <Button
            variant="primary"
            size="md"
            block
            onClick={fastForward}
            disabled={!canAdvance}
            title={!canAdvance ? "라이브 라운드가 있거나 자동 진행 중일 때 빨리감기할 수 있어요" : undefined}
          >
            +7일
          </Button>
          <Button variant="secondary" size="md" block onClick={reset}>초기화</Button>
        </>
      }
    />
  );
}
