"use client";

// 광고가 Meta 에 등록된 직후 보여지는 성공 카드 — Campaign/AdSet/Ad ID 복사 + "성과 확인하러 가기" 버튼.
// skipped 모드(Meta App 개발 모드 호환) 는 CampaignSkeletonSuccessCard 가 별도로 렌더.

import { useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
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
    <Card className="border-[var(--w-status-positive)] bg-[rgba(0,191,64,0.04)]">
      <div className="flex items-center gap-3 mb-3.5">
        <div className="w-9 h-9 rounded-full bg-[var(--w-status-positive)] text-white grid place-items-center">
          <Icon name="check" size={18} />
        </div>
        <div>
          <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">광고가 Meta에 등록됐어요</div>
          <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-normal)] mt-0.5">
            {launched.status === "ACTIVE"
              ? "검토가 끝나면 자동으로 게재가 시작돼요."
              : "일시중지 상태로 만들어졌어요. Meta 광고 관리자에서 켤 수 있어요."}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 p-[10px_12px] bg-[var(--w-bg-elevated)] rounded-[10px] mb-3.5">
        <Chip variant="accent" dot>검토 중</Chip>
        <Icon name="arrow-right" size={12} style={{ color: "var(--w-fg-alternative)" }} />
        <Chip variant="success" dot>게재 중</Chip>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map(([l, v]) => (
          <div key={l} className="flex items-center gap-3 p-[12px_14px] bg-[var(--w-bg-alternative)] rounded-[10px]">
            <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase min-w-[90px]">{l}</span>
            <span className="font-medium text-[13px] leading-none font-[var(--w-font-mono)] text-[var(--w-fg-strong)] flex-1 overflow-hidden text-ellipsis">{v}</span>
            <button
              className="border-none bg-transparent font-semibold text-[12px] leading-none text-[var(--w-primary-press)] cursor-pointer px-2 py-1.5 rounded-md hover:bg-[var(--w-primary-soft)]"
              type="button"
              onClick={() => copy(l, v)}
            >
              {copied === l ? "복사됨 ✓" : <><Icon name="copy" size={12} /> 복사</>}
            </button>
          </div>
        ))}
      </div>
      <Button variant="primary" className="w-full mt-3.5" type="button" onClick={onNext}>
        마무리 점검하러 가기 <Icon name="arrow-right" size={14} />
      </Button>
    </Card>
  );
}
