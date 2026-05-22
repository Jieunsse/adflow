"use client";

// Meta App 개발 모드 호환 — Campaign + AdSet 까지만 만든 직후의 결과 카드.
// 일반 광고 게재 success card 와 톤이 달라요(emotional → dev artifact):
//   - 점선 border · 중성 톤 bg — sub-step 3 의 dev callout 과 시각 언어 일치
//   - Ad 가 없으니 "성공/검토중/게재중" 같은 게재 lifecycle 표현 없음
//   - ID 영역은 monospace inline, 글로벌 .id-row(다크) 안 씀

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { useLaunchDraft } from "@entities/campaign/model";

type IdRow = { label: string; value: string };

export default function CampaignSkeletonSuccessCard() {
  const launched = useLaunchDraft().state.launchedCampaign;
  const router = useRouter();
  const [copied, setCopied] = useState("");

  if (!launched) return null;

  const copy = (k: string, v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    setCopied(k);
    setTimeout(() => setCopied(""), 1400);
  };

  const rows: IdRow[] = [
    { label: "campaign", value: launched.campaignId },
    { label: "adset", value: launched.adSetId },
  ];

  return (
    <Card className="p-[18px] border-dashed bg-[var(--w-bg-alternative)]">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon name="info" size={14} />
        <span className="font-semibold text-[11.5px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">
          Meta App 개발 모드
        </span>
      </div>
      <div className="font-bold text-[15px] leading-[1.35] text-[var(--w-fg-strong)] mb-1.5">
        캠페인 + 광고 세트가 생성됐어요
      </div>
      <p className="font-medium text-[12.5px] leading-[1.55] text-[var(--w-fg-normal)] m-0 mb-3.5">
        Ad Creative · Ad 단계는 건너뛰었어요 (PAUSED). Meta 광고 관리자에서 확인할 수 있어요.
      </p>

      <div className="flex flex-col gap-1.5 mb-3.5">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 px-2.5 py-2 bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-lg"
          >
            <span className="font-semibold text-[10.5px] leading-none font-[var(--w-font-mono)] text-[var(--w-fg-neutral)] min-w-[56px] tracking-[0.04em]">
              {label}
            </span>
            <span className="font-medium text-[12.5px] leading-none font-[var(--w-font-mono)] text-[var(--w-fg-strong)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {value}
            </span>
            <button
              type="button"
              onClick={() => copy(label, value)}
              className="border-none bg-transparent text-[var(--w-fg-neutral)] font-semibold text-[11px] leading-none cursor-pointer px-1.5 py-1 rounded-md"
            >
              {copied === label ? "복사됨 ✓" : <><Icon name="copy" size={11} /> 복사</>}
            </button>
          </div>
        ))}
      </div>

      <Button variant="secondary" className="w-full" type="button" onClick={() => router.push("/campaigns")}>
        Campaigns 페이지에서 보기 <Icon name="arrow-right" size={13} />
      </Button>
    </Card>
  );
}
