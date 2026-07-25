"use client";

// ADR-033 — Presenter Fast-Forward 바. 실제 /campaigns/[id]·/ab-tests/[id] 하단에 Browse Mode 한정으로 띄우는
// floating 컨트롤. 발표자가 시간을 N일 건너뛰어 성과를 쌓고, winner 가 되면 재게재 알림을 보낸다.
// production 기능 아님 — browseMode 가 아니면 페이지가 이 위젯을 렌더하지 않는다.
// 재게재 확인 자체는 페이지의 production RelaunchConfirmModal 을 그대로 재사용(handleRelaunch browse 분기).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { useToast } from "@shared/ui/Toast";
import { isWinner } from "@/lib/optimization";
import { addNotification } from "@shared/lib/notifications";
import { useAutoRelaunch } from "@shared/lib/autoRelaunch";
import { usePresenterConsole } from "@shared/lib/usePresenterConsole";
import { PresenterConsoleShell, ConsoleBigNumber, ConsoleInfoRow, ConsoleStatusBadge } from "./console-shell";
import type { BrowseCampaign } from "@entities/campaign/browse/types";
import { upsertBrowse, resetBrowse } from "@entities/campaign/browse/store";
import { buildBrowseInsights } from "@entities/campaign/browse/insights";
import { evaluateAutoPilot, applyAutoPilotAction } from "@entities/campaign/browse/auto-pilot";

export default function PresenterFastForwardBar({ camp }: { camp: BrowseCampaign }) {
  const router = useRouter();
  const showToast = useToast();
  const { get: getAutoRelaunch } = useAutoRelaunch();
  const [consoleOn] = usePresenterConsole();
  const [notified, setNotified] = useState(false);

  const autoOn = !!getAutoRelaunch(camp.id)?.enabled;
  const insights = useMemo(() => buildBrowseInsights(camp), [camp]);
  const result = useMemo(
    () => isWinner(insights, camp.objective, camp.kpiTarget ?? null, camp.fastForwardDays),
    [insights, camp.objective, camp.kpiTarget, camp.fastForwardDays],
  );

  const fastForward = () => {
    const newDays = camp.fastForwardDays + 7;
    let next: BrowseCampaign = { ...camp, fastForwardDays: newDays };
    // ADR-034 — 자동 운영 켜져 있으면 누적 성과를 평가해 조치를 자동 적용 + 알림.
    if (camp.automationOn) {
      const action = evaluateAutoPilot(next, newDays);
      if (action) {
        next = applyAutoPilotAction(next, action);
        addNotification({ type: "opt", message: `AI 자동 운영 · ${action.detail}`, campaignId: camp.id });
        showToast(`AI 자동 운영 — ${action.detail}`);
      }
    }
    upsertBrowse(next);
    setNotified(false);
  };

  const sendNotification = () => {
    if (!result.winner || !result.evidence) return;
    addNotification({
      type: "auto-relaunch-ready",
      message: `'${camp.name}' 성과가 목표를 통과했어요. 같은 내용으로 다시 게재할까요?`,
      campaignId: camp.id,
      evidence: result.evidence,
    });
    setNotified(true);
    showToast("재게재 알림을 보냈어요 — 우측 상단 알림 벨을 확인해보세요");
  };

  const reset = () => {
    resetBrowse();
    showToast("둘러보기 캠페인을 초기화했어요");
    router.push("/campaigns");
  };

  if (!consoleOn) return null;

  return (
    <PresenterConsoleShell
      body={
        <>
          <ConsoleBigNumber label="진행 일수" value={camp.fastForwardDays} unit="일차" />
          <div className="flex flex-col gap-2">
            <ConsoleInfoRow label="노출" value={insights.impressions.toLocaleString("ko-KR")} />
            <ConsoleInfoRow label="CTR" value={`${insights.ctr.toFixed(2)}%`} />
          </div>
          <ConsoleStatusBadge ok={result.winner} icon={result.winner ? "check-circle" : "clock"}>
            {result.winner ? "winner ✓" : "데이터 쌓는 중"}
          </ConsoleStatusBadge>
          {camp.automationOn && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[13px]" style={{ color: "var(--w-primary-press)" }}>
              🤖 자동 운영 중
            </span>
          )}
        </>
      }
      actions={
        <>
          <Button variant="primary" size="md" block onClick={fastForward}>+7일</Button>
          <Button
            variant="secondary"
            size="md"
            block
            onClick={sendNotification}
            disabled={!result.winner || !autoOn || notified}
            title={!autoOn ? "STEP 02에서 자동 재게재를 켜야 알림을 보낼 수 있어요" : undefined}
          >
            재게재 알림 보내기
          </Button>
          <Button variant="secondary" size="md" block onClick={reset}>초기화</Button>
        </>
      }
    />
  );
}
