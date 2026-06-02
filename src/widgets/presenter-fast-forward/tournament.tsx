"use client";

// ADR-033 — A/B 토너먼트(흐름2) 전용 Presenter Fast-Forward 바. /ab-tests/[id] 하단 Browse Mode 한정 floating 컨트롤.
// 라이브 라운드가 있으면 +7일로 시간을 건너뛰어 성과를 쌓고, 데이터가 충분해지면 자동 결산(🤖)한다.
// production 기능 아님 — 상세 페이지가 browseMode + getTournament 일 때만 렌더한다.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { useToast } from "@shared/ui/Toast";
import { roundAdKpis, deriveBeat, AXIS_LABEL, type Tournament } from "@entities/ab-test/tournament/tournament";
import { tourMetricSpec, formatPrimary, primaryMetricValue } from "@entities/ab-test/tournament/objective-metric";
import { resetTournamentDemo } from "@entities/ab-test/tournament/seed";
import { demoCascade } from "@entities/ab-test/tournament/client";
import { usePresenterConsole } from "@shared/lib/usePresenterConsole";
import { PresenterConsoleShell, ConsoleBigNumber, ConsoleInfoRow, ConsoleStatusBadge } from "./console-shell";

export default function PresenterTournamentBar({ t }: { t: Tournament }) {
  const router = useRouter();
  const showToast = useToast();
  const [consoleOn] = usePresenterConsole();
  const [running, setRunning] = useState(false);

  const spec = tourMetricSpec(t.objective);
  const active = t.rounds.find((r) => r.status === "running") ?? null;
  const live = active ? roundAdKpis(active, t.championCtr, t.dailyBudget, undefined, t.objective) : null;
  // ADR-044 캐스케이드 — 진짜 브레이크(완료·봉투 소진·이상 신호·셋업 게이트)가 아니면 끝까지 돌릴 수 있다.
  // manual-n 의 between·challenger-review(다음 챌린저 제안→게재)도 발표자 빨리감기가 자동 통과한다.
  const beat = deriveBeat(t);
  const canAdvance = beat !== "done" && beat !== "winner-handling" && beat !== "anomaly" && beat !== "champion-review";

  // 콘솔 시간 1회 advance = 봉투 소진/필요 브레이크(ADR-035)까지 전체 auto 루프 캐스케이드.
  const fastForward = async () => {
    setRunning(true);
    try {
      const log = await demoCascade(t.id);
      if (!log.length) {
        showToast("다음 가설을 게재했어요 — 한 번 더 눌러 결산까지 돌려보세요");
        return;
      }
      const c = log.filter((s) => s.verdict === "confirmed").length;
      const r = log.filter((s) => s.verdict === "refuted").length;
      const i = log.filter((s) => s.verdict === "inconclusive").length;
      const parts = [c && `입증 ${c}`, r && `반증 ${r}`, i && `미결 ${i}`].filter(Boolean).join(" · ");
      showToast(`${log.length}개 라운드 자동 진행 — ${parts}`);
    } finally {
      setRunning(false);
    }
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
        {settledCount}/{t.maxRounds ?? "—"}라운드 완료 · 빨리감기로 남은 라운드를 자동 진행해요
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
            disabled={!canAdvance || running}
            title={!canAdvance ? "결정 대기 중이거나 완료된 토너먼트는 빨리감기할 수 없어요" : undefined}
          >
            {running ? "진행 중…" : "빨리감기"}
          </Button>
          <Button variant="secondary" size="md" block onClick={reset} disabled={running}>초기화</Button>
        </>
      }
    />
  );
}
