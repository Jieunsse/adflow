"use client";

// Meta App 개발 모드 호환 — Campaign + AdSet 까지만 만든 직후의 결과 카드.
// 일반 광고 게재 success card 와 톤이 달라요(emotional → dev artifact):
//   - 점선 border · 중성 톤 bg — sub-step 3 의 dev callout 과 시각 언어 일치
//   - Ad 가 없으니 "성공/검토중/게재중" 같은 게재 lifecycle 표현 없음
//   - ID 영역은 monospace inline, 글로벌 .id-row(다크) 안 씀

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@shared/ui/Icon";
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
    <div
      className="card"
      style={{
        padding: 18,
        borderStyle: "dashed",
        background: "var(--w-bg-alternative)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name="info" size={14} />
        <span
          style={{
            font: "600 11.5px/1 var(--w-font-sans)",
            color: "var(--w-fg-neutral)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Meta App 개발 모드
        </span>
      </div>
      <div style={{ font: "700 15px/1.35 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 6 }}>
        캠페인 + 광고 세트가 생성됐어요
      </div>
      <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: "0 0 14px" }}>
        Ad Creative · Ad 단계는 건너뛰었어요 (PAUSED). Meta 광고 관리자에서 확인할 수 있어요.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {rows.map(({ label, value }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              background: "var(--w-bg-elevated)",
              border: "1px solid var(--w-line-normal)",
              borderRadius: 8,
            }}
          >
            <span
              style={{
                font: "600 10.5px/1 var(--w-font-mono)",
                color: "var(--w-fg-neutral)",
                minWidth: 56,
                letterSpacing: "0.04em",
              }}
            >
              {label}
            </span>
            <span
              style={{
                font: "500 12.5px/1 var(--w-font-mono)",
                color: "var(--w-fg-strong)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {value}
            </span>
            <button
              type="button"
              onClick={() => copy(label, value)}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--w-fg-neutral)",
                font: "600 11px/1 var(--w-font-sans)",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 6,
              }}
            >
              {copied === label ? "복사됨 ✓" : <><Icon name="copy" size={11} /> 복사</>}
            </button>
          </div>
        ))}
      </div>

      <button
        className="btn btn--secondary btn--block"
        type="button"
        onClick={() => router.push("/campaigns")}
      >
        Campaigns 페이지에서 보기 <Icon name="arrow-right" size={13} />
      </button>
    </div>
  );
}
