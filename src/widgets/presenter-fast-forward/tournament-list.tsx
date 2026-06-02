"use client";

// ADR-033 — A/B 토너먼트 목록(/ab-tests) 전용 Presenter 바. 진행 중인 모든 토너먼트의 라이브 라운드를
// +7일 결산해 대시보드를 앞으로 굴린다. 단일 토너먼트용 PresenterTournamentBar 의 목록 버전.
// production 기능 아님 — 목록 페이지가 browseMode 일 때만 렌더한다.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { useToast } from "@shared/ui/Toast";
import { deriveBeat, isRunningBeat, type Tournament } from "@entities/ab-test/tournament/tournament";
import { resetTournamentDemo } from "@entities/ab-test/tournament/seed";
import { demoCascade } from "@entities/ab-test/tournament/client";
import { usePresenterConsole } from "@shared/lib/usePresenterConsole";
import { PresenterConsoleShell, ConsoleStatGrid } from "./console-shell";

export default function PresenterTournamentListBar({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter();
  const showToast = useToast();
  const [consoleOn] = usePresenterConsole();
  const [busy, setBusy] = useState(false);

  const running = tournaments.filter((t) => isRunningBeat(deriveBeat(t)));
  const completed = tournaments.filter((t) => t.status === "completed");

  // ADR-044 — 진행 중인 모든 토너먼트를 각자의 브레이크/봉투 소진까지 캐스케이드.
  const fastForward = async () => {
    if (running.length === 0) return;
    setBusy(true);
    try {
      let rounds = 0;
      let advanced = 0;
      for (const t of tournaments) {
        if (!isRunningBeat(deriveBeat(t))) continue;
        const log = await demoCascade(t.id);
        if (log.length) {
          rounds += log.length;
          advanced += 1;
        }
      }
      if (rounds > 0) showToast(`${advanced}개 토너먼트 · ${rounds}개 라운드 자동 진행 — 결정 대기만 올렸어요`);
      else showToast("자동 진행 중인 토너먼트를 앞으로 넘겼어요");
    } finally {
      setBusy(false);
    }
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
            disabled={running.length === 0 || busy}
            title={running.length === 0 ? "진행 중인 토너먼트가 있을 때 빨리감기로 결산할 수 있어요" : undefined}
          >
            {busy ? "진행 중…" : "빨리감기"}
          </Button>
          <Button variant="secondary" size="md" block onClick={reset} disabled={busy}>초기화</Button>
        </>
      }
    />
  );
}
