"use client";

// ADR-033 — A/B 토너먼트 목록(/ab-tests) 전용 Presenter 바. 진행 중인 모든 토너먼트의 라이브 라운드를
// +7일 결산해 대시보드를 앞으로 굴린다. 단일 토너먼트용 PresenterTournamentBar 의 목록 버전.
// production 기능 아님 — 목록 페이지가 browseMode 일 때만 렌더한다.

import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { useToast } from "@shared/ui/Toast";
import { deriveBeat, isRunningBeat, type Tournament } from "@entities/ab-test/tournament/tournament";
import { resetTournamentDemo } from "@entities/ab-test/tournament/seed";
import { demoSettleRound, demoAutoAdvance } from "@entities/ab-test/tournament/client";
import { usePresenterConsole } from "@shared/lib/usePresenterConsole";
import { PresenterConsoleShell, ConsoleStatGrid } from "./console-shell";

export default function PresenterTournamentListBar({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter();
  const showToast = useToast();
  const [consoleOn] = usePresenterConsole();

  const running = tournaments.filter((t) => isRunningBeat(deriveBeat(t)));
  const completed = tournaments.filter((t) => t.status === "completed");

  const fastForward = async () => {
    if (running.length === 0) return;
    let settled = 0;
    let insufficient = 0;
    for (const t of tournaments) {
      if (t.status === "completed") continue;
      const active = t.rounds.find((r) => r.status === "running");
      if (active) {
        const res = await demoSettleRound(t.id, active.fastForwardDays + 7);
        if (res.status === "settled") settled += 1;
        else if (res.status === "insufficient") insufficient += 1;
      }
      // ADR-035 — auto 무인: 브레이크가 없으면 다음 챌린저를 자동 게재(무인 체인).
      if (t.mode === "auto") await demoAutoAdvance(t.id);
    }
    if (settled > 0) showToast(`${settled}개 토너먼트 라운드 결산 — 꼭 필요한 것만 결정 대기로 올렸어요`);
    else if (insufficient > 0) showToast("아직 데이터가 부족해요 — 한 번 더 빨리감기 해보세요");
    else showToast("자동 진행 중인 토너먼트를 한 주 앞으로 넘겼어요");
  };

  const reset = () => {
    resetTournamentDemo();
    showToast("둘러보기 토너먼트를 초기화했어요");
    router.push("/ab-tests");
  };

  if (!consoleOn) return null;

  return (
    <PresenterConsoleShell
      body={
        <ConsoleStatGrid
          items={[
            ["진행", running.length],
            ["완료", completed.length],
            ["전체", tournaments.length],
          ]}
        />
      }
      actions={
        <>
          <Button
            variant="primary"
            size="md"
            block
            onClick={fastForward}
            disabled={running.length === 0}
            title={running.length === 0 ? "진행 중인 토너먼트가 있을 때 빨리감기로 결산할 수 있어요" : undefined}
          >
            +7일
          </Button>
          <Button variant="secondary" size="md" block onClick={reset}>초기화</Button>
        </>
      }
    />
  );
}
