"use client";

// 시안 2c — 검수 요청됨. 플로우의 끝맺음.
// 검수 소요 시간은 Meta 가 정하는 값이라 우리가 분 단위로 약속하지 않는다("보통 하루 안").

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft } from "@entities/campaign/model";
import { fmt } from "@shared/lib/format";

function timeLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function Dot({ tone }: { tone: "done" | "now" | "todo" }) {
  const bg =
    tone === "done" ? "bg-[var(--w-status-positive)]"
    : tone === "now" ? "bg-[var(--w-primary-normal)] shadow-[0_0_0_4px_var(--w-primary-soft)]"
    : "bg-[var(--w-fill-strong)]";
  return <span className={`w-3 h-3 rounded-full ${bg}`} />;
}

function Step({
  tone,
  title,
  desc,
  last,
}: {
  tone: "done" | "now" | "todo";
  title: string;
  desc: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-5">
        <Dot tone={tone} />
        {!last && <span className="flex-1 w-0.5 bg-[var(--w-line-normal)]" />}
      </div>
      <div className={last ? "" : "pb-4"}>
        <div
          className={`font-semibold text-[14px] leading-[1.5] ${
            tone === "todo" ? "text-[var(--w-fg-neutral)]" : "text-[var(--w-fg-strong)]"
          }`}
        >
          {title}
        </div>
        <div className="font-normal text-[12px] leading-[1.5] text-[var(--w-fg-neutral)]">{desc}</div>
      </div>
    </div>
  );
}

const PLACEMENT_LABEL: Record<string, string> = {
  facebook_feed: "페이스북 피드",
  instagram_feed: "인스타그램 피드",
  instagram_stories: "스토리",
  audience_network: "오디언스 네트워크",
  messenger: "메신저",
};

export default function ReviewRequestedCard({ onRestart }: { onRestart: () => void }) {
  const router = useRouter();
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();
  const launched = launch.state.launchedCampaign;
  const [requestedAt] = useState(() => Date.now());

  const image = launch.state.finalImageDataUrl ?? launch.state.imageDataUrl;
  const channels =
    launch.state.placements.mode === "manual"
      ? launch.state.placements.positions.map((p) => PLACEMENT_LABEL[p] ?? p)
      : ["자동 게재 위치"];
  const budget = launched?.dailyBudget ?? (parseInt(launch.state.budget.replace(/[^\d]/g, ""), 10) || 0);
  const start = launched?.startDate ?? launch.state.dateStart;
  const end = launched?.endDate ?? launch.state.dateEnd;

  return (
    <div className="bg-[var(--w-bg-alternative)] rounded-[var(--w-radius-16)] p-6 max-w-[620px] mx-auto">
      <div className="bg-[var(--w-bg-normal)] rounded-[var(--w-radius-16)] px-[26px] py-7 shadow-[var(--w-shadow-card)]">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-10 h-10 rounded-[var(--w-radius-12)] bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)] font-bold text-[18px] leading-10 text-center">
            ✓
          </span>
          <div>
            <div className="font-bold text-[19px] leading-[1.4] tracking-[-0.012em] text-[var(--w-fg-strong)]">
              검수를 요청했어요
            </div>
            <div className="font-normal text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              보통 하루 안에 끝나요. 결과는 알림으로 알려드릴게요.
            </div>
          </div>
        </div>

        <div className="flex flex-col mb-5">
          <Step tone="done" title="검수 요청 완료" desc={`오늘 ${timeLabel(requestedAt)}`} />
          <Step tone="now" title="검수 중" desc="Meta 가 광고 정책을 확인하고 있어요" />
          <Step tone="todo" title="게재 시작" desc={dateLabel(start)} last />
        </div>

        <div className="flex gap-3 p-3.5 rounded-[var(--w-radius-12)] bg-[var(--w-bg-neutral)] mb-[18px]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="w-16 h-16 rounded-[var(--w-radius-12)] object-cover shrink-0" />
          ) : (
            <div className="w-img-placeholder w-16 h-16 rounded-[var(--w-radius-12)] shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[13px] leading-[1.5] text-[var(--w-fg-strong)] truncate">
              {creative.state.headline}
            </div>
            <div className="font-normal text-[12px] leading-[1.6] text-[var(--w-fg-neutral)]">
              {channels.join(" · ")} · 하루 {fmt(budget)}원 · {shortDate(start)}–{shortDate(end)}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5">
          <Button variant="secondary" size="lg" block type="button" onClick={onRestart}>
            소재 더 만들기
          </Button>
          <Button variant="primary" size="lg" block type="button" onClick={() => router.push("/campaigns")}>
            광고 목록으로
          </Button>
        </div>
      </div>
    </div>
  );
}
