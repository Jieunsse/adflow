"use client";

// 광고가 Meta 에 등록된 직후 보여지는 성공 카드 — Campaign/AdSet/Ad ID 복사 + "성과 확인하러 가기" 버튼.
// skipped 모드(Meta App 개발 모드 호환) 는 CampaignSkeletonSuccessCard 가 별도로 렌더.

import { useState } from "react";
import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { useLaunchDraft } from "@entities/campaign/model";

export default function LaunchSuccessCard({ onNext }: { onNext: () => void }) {
  const launched = useLaunchDraft().state.launchedCampaign;
  const [copied, setCopied] = useState("");

  if (!launched) return null;

  const copy = (k: string, v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    setCopied(k);
    setTimeout(() => setCopied(""), 1400);
  };

  const rows: [string, string][] = [
    ["Campaign ID", launched.campaignId],
    ["AdSet ID", launched.adSetId],
    ["Ad ID", launched.adId || "—"],
  ];

  return (
    <div className="card" style={{ borderColor: "var(--w-status-positive)", background: "rgba(0,191,64,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--w-status-positive)", color: "#fff", display: "grid", placeItems: "center" }}>
          <Icon name="check" size={18} />
        </div>
        <div>
          <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>광고가 Meta에 등록됐어요</div>
          <div style={{ font: "500 12.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-normal)", marginTop: 2 }}>
            {launched.status === "ACTIVE"
              ? "검토가 끝나면 자동으로 게재가 시작돼요."
              : "일시중지 상태로 만들어졌어요. Meta 광고 관리자에서 켤 수 있어요."}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--w-bg-elevated)", borderRadius: 10, marginBottom: 14 }}>
        <Badge kind="accent" dot>검토 중</Badge>
        <Icon name="arrow-right" size={12} style={{ color: "var(--w-fg-alternative)" }} />
        <Badge kind="success" dot>게재 중</Badge>
      </div>
      <div className="id-list">
        {rows.map(([l, v]) => (
          <div key={l} className="id-row">
            <span className="id-row__label">{l}</span>
            <span className="id-row__val">{v}</span>
            <button className="id-row__copy" type="button" onClick={() => copy(l, v)}>
              {copied === l ? "복사됨 ✓" : <><Icon name="copy" size={12} /> 복사</>}
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn--primary btn--block" type="button" style={{ marginTop: 14 }} onClick={onNext}>
        마무리 점검하러 가기 <Icon name="arrow-right" size={14} />
      </button>
    </div>
  );
}
