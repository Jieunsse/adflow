"use client";

import Link from "next/link";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { Select } from "@shared/ui/Select";
import Icon from "@shared/ui/Icon";
import { CreatorAvatar } from "@features/creator-registry";
import { STAGE_ORDER, STAGE_LABELS, type CampaignEntry, type CampaignStage } from "@entities/influencer-campaign/model";
import type { Creator } from "@entities/creator/model";

const STAGE_OPTIONS = STAGE_ORDER.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] }));

function creatorOf(entry: CampaignEntry, creators: Creator[]): Creator | undefined {
  return creators.find((c) => c.id === entry.creatorId);
}

export function PipelineBoard({
  entries,
  creators,
  onStageChange,
  onOutreach,
  onGuideline,
  onPerformance,
}: {
  entries: CampaignEntry[];
  creators: Creator[];
  onStageChange: (creatorId: string, stage: CampaignStage) => void;
  onOutreach: (creatorId: string) => void;
  onGuideline: (creatorId: string) => void;
  onPerformance: (creatorId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {STAGE_ORDER.map((stage) => {
        const stageEntries = entries.filter((e) => e.stage === stage);
        return (
          <Card key={stage} variant="quiet" className="flex flex-col gap-3 min-h-[140px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[13.5px] leading-none text-[var(--w-fg-strong)]">
                {STAGE_LABELS[stage]}
              </span>
              <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">
                {stageEntries.length}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {stageEntries.map((entry) => {
                const creator = creatorOf(entry, creators);
                if (!creator) {
                  return (
                    <div
                      key={entry.creatorId}
                      className="flex items-center gap-2.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-3.5 py-3"
                    >
                      <div
                        className="rounded-full grid place-items-center shrink-0 bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)]"
                        style={{ width: 32, height: 32 }}
                      >
                        <span aria-hidden="true">?</span>
                      </div>
                      <span className="font-bold text-[13.5px] leading-[1.3] text-[var(--w-fg-alternative)] truncate min-w-0 flex-1">
                        (삭제된 크리에이터)
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={entry.creatorId}
                    className="flex flex-col gap-2.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-3.5 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <CreatorAvatar creator={creator} size={32} />
                      <span className="font-bold text-[13.5px] leading-[1.3] text-[var(--w-fg-strong)] truncate min-w-0 flex-1">
                        {creator.handle}
                      </span>
                    </div>

                    <Select
                      value={entry.stage}
                      onChange={(v) => onStageChange(entry.creatorId, v as CampaignStage)}
                      options={STAGE_OPTIONS}
                    />

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button variant="secondary" size="sm" type="button" onClick={() => onOutreach(entry.creatorId)}>
                        제안 초안
                      </Button>
                      <Button variant="secondary" size="sm" type="button" onClick={() => onGuideline(entry.creatorId)}>
                        가이드라인
                      </Button>
                      <Button variant="secondary" size="sm" type="button" onClick={() => onPerformance(entry.creatorId)}>
                        성과 입력
                      </Button>
                    </div>

                    {entry.stage === "published" && entry.contentUrl && (
                      <div className="flex items-start gap-1.5 font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)]">
                        <Icon name="info" size={13} className="mt-px shrink-0" />
                        <span>
                          파트너로 태그된 게시물이라면{" "}
                          <Link href="/instagram/partnerships" className="font-semibold underline">
                            파트너십 콘텐츠
                          </Link>
                          에서 광고로 집행할 수 있어요
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
