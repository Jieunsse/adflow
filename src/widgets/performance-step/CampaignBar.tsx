"use client";

import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { Badge } from "@shared/ui/primitives";
import type { LaunchedCampaign } from "@entities/campaign/model";
import type { CampaignObjective } from "@entities/insights/types";
import { OBJECTIVES_PHASE1 } from "@entities/creative/options";

interface Props {
  exampleMode: boolean;
  launched: LaunchedCampaign | null;
  headline: string;
  objective: CampaignObjective;
  periodLabel: string;
  isFetching: boolean;
  onRefetch: () => void;
}

const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  OUTCOME_AWARENESS: "인지도",
  OUTCOME_ENGAGEMENT: "참여",
  OUTCOME_TRAFFIC: "트래픽",
  OUTCOME_LEADS: "가입자",
  OUTCOME_SALES: "매출",
  OUTCOME_APP_PROMOTION: "앱 설치",
};

// PRD §13 — launched.goalId 가 있으면 goal 라벨 (예: "전화 받기") 우선. 없으면 objective 폴백.
function badgeLabel(launched: LaunchedCampaign | null, objective: CampaignObjective): string {
  if (launched?.goalId) {
    const goal = OBJECTIVES_PHASE1.find((g) => g.id === launched.goalId);
    if (goal) return goal.label;
  }
  return OBJECTIVE_LABELS[objective];
}

export default function CampaignBar({ exampleMode, launched, headline, objective, periodLabel, isFetching, onRefetch }: Props) {
  return (
    <Card className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-11 h-11 rounded-[10px] bg-[linear-gradient(135deg,#0066ff,#6541f2)] text-white grid place-items-center shrink-0">
          <Icon name="megaphone" size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {exampleMode
              ? <Badge kind="violet">예시</Badge>
              : launched!.status === "PAUSED" ? <Badge kind="warn" dot>일시정지</Badge> : <Badge kind="success" dot live>게재 중(또는 검토 중)</Badge>}
            <Badge kind="violet">{badgeLabel(launched, objective)}</Badge>
            <span className="font-medium text-[11.5px] leading-none font-mono text-[var(--w-fg-alternative)]">{launched ? launched.campaignId : "120207641834"}</span>
          </div>
          <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)] overflow-hidden text-ellipsis whitespace-nowrap">{headline}</div>
        </div>
      </div>
      <div className="flex gap-2.5 items-center">
        <span className="font-medium text-[12.5px] leading-none text-[var(--w-fg-neutral)] whitespace-nowrap">{periodLabel}</span>
        <Button variant="secondary" size="sm" onClick={onRefetch} disabled={exampleMode || isFetching}>
          <Icon name="refresh" size={14} /> {isFetching ? "새로고침 중…" : "새로고침"}
        </Button>
      </div>
    </Card>
  );
}
