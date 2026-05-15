"use client";

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import type { LaunchedCampaign } from "@entities/campaign/model";
import type { CampaignObjective } from "./_types";

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

export default function CampaignBar({ exampleMode, launched, headline, objective, periodLabel, isFetching, onRefetch }: Props) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#0066ff,#6541f2)", color: "#fff", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <Icon name="megaphone" size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            {exampleMode
              ? <Badge kind="violet">예시</Badge>
              : launched!.status === "PAUSED" ? <Badge kind="warn" dot>일시정지</Badge> : <Badge kind="success" dot live>게재 중(또는 검토 중)</Badge>}
            <Badge kind="violet">{OBJECTIVE_LABELS[objective]}</Badge>
            <span style={{ font: "500 11.5px/1 var(--w-font-mono)", color: "var(--w-fg-alternative)" }}>{launched ? launched.campaignId : "120207641834"}</span>
          </div>
          <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headline}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ font: "500 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", whiteSpace: "nowrap" }}>{periodLabel}</span>
        <button className="btn btn--secondary btn--sm" type="button" onClick={onRefetch} disabled={exampleMode || isFetching}>
          <Icon name="refresh" size={14} /> {isFetching ? "새로고침 중…" : "새로고침"}
        </button>
      </div>
    </div>
  );
}
