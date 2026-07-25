"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import Icon from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { useInfluencerCampaigns } from "@entities/influencer-campaign/store";
import { STAGE_ORDER, isCampaignCompleted, type InfluencerCampaign } from "@entities/influencer-campaign/model";
import { seedInfluencerDemo } from "@entities/creator/browse/seed";
import { cn } from "@shared/lib/cn";

type Tab = "active" | "completed";

function progressRatio(campaign: InfluencerCampaign): number {
  if (campaign.entries.length === 0) return 0;
  const settledIndex = STAGE_ORDER.indexOf("settled");
  const total = campaign.entries.reduce((sum, e) => sum + (STAGE_ORDER.indexOf(e.stage) + 1), 0);
  return total / (campaign.entries.length * (settledIndex + 1));
}

function fmtDateRange(campaign: InfluencerCampaign): string | null {
  if (!campaign.startDate && !campaign.endDate) return null;
  if (campaign.startDate && campaign.endDate) return `${campaign.startDate} ~ ${campaign.endDate}`;
  return campaign.startDate ?? campaign.endDate ?? null;
}

function CampaignCard({ campaign }: { campaign: InfluencerCampaign }) {
  const ratio = progressRatio(campaign);
  const dateRange = fmtDateRange(campaign);

  return (
    <Link href={`/creators/campaigns/${campaign.id}`} className="no-underline text-inherit">
      <Card className="flex flex-col gap-3 h-full hover:border-[var(--w-primary-normal)] transition-colors duration-[120ms]">
        <div className="min-w-0">
          <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)] truncate">{campaign.name}</div>
          <div className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-fg-neutral)] truncate mt-0.5">
            {campaign.goal}
          </div>
        </div>

        {dateRange && (
          <div className="flex items-center gap-1.5 font-medium text-[12px] leading-none text-[var(--w-fg-alternative)]">
            <Icon name="calendar" size={12} />
            {dateRange}
          </div>
        )}

        <div className="mt-auto pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-[11px] leading-none text-[var(--w-fg-neutral)]">파이프라인 진행도</span>
            <span className="font-semibold text-[11px] leading-none text-[var(--w-fg-alternative)]">
              {campaign.entries.length}명
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--w-bg-alternative)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--w-primary-normal)]"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function InfluencerCampaignsPage() {
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;

  useEffect(() => {
    if (!browseMode) return;
    seedInfluencerDemo();
  }, [browseMode]);

  const { list: campaigns } = useInfluencerCampaigns();
  const [tab, setTab] = useState<Tab>("active");

  const filtered = useMemo(
    () => campaigns.filter((c) => (tab === "completed" ? isCampaignCompleted(c) : !isCampaignCompleted(c))),
    [campaigns, tab],
  );

  return (
    <div className="w-full max-w-[1080px] mx-auto px-12 py-10 pb-24 flex flex-col gap-6" data-screen-label="인플루언서 캠페인 목록">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="m-0 font-bold text-[27px] leading-[1.2] tracking-[-0.02em] text-[var(--w-fg-strong)]">
            인플루언서 캠페인
          </h1>
          <p className="mt-2 mb-0 max-w-[560px] font-medium text-[14px] leading-[1.55] text-[var(--w-fg-neutral)]">
            크리에이터 협업을 캠페인 단위로 관리해요.
          </p>
        </div>
        <Link href="/creators/campaigns/new" className="no-underline">
          <Button variant="primary" size="lg" type="button">
            <Icon name="plus" size={17} /> 새 캠페인
          </Button>
        </Link>
      </header>

      <div className="inline-flex items-center gap-1 rounded-full bg-[var(--w-bg-alternative)] p-1 w-fit">
        {(["active", "completed"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 rounded-full font-semibold text-[13px] leading-none transition-colors duration-[120ms]",
              tab === t
                ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[var(--w-shadow-card)]"
                : "text-[var(--w-fg-neutral)]",
            )}
          >
            {t === "active" ? "진행 중" : "완료"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="megaphone" size={22} />}
          title={tab === "active" ? "진행 중인 캠페인이 없어요" : "완료된 캠페인이 없어요"}
          desc={
            tab === "active"
              ? "새 캠페인을 만들어 크리에이터 협업을 시작해 보세요."
              : "모든 크리에이터가 정산 단계까지 완료되면 여기서 볼 수 있어요."
          }
          action={
            tab === "active" ? (
              <Link href="/creators/campaigns/new" className="no-underline">
                <Button variant="primary" type="button">
                  <Icon name="plus" size={16} /> 새 캠페인
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
