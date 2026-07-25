import type { ChipVariant } from "@shared/ui/Chip";
import type { CampaignStatusBucket } from "@/lib/meta-ads-insights";

export const CAMPAIGN_STATUS_MAP: Record<CampaignStatusBucket, { label: string; chip: ChipVariant }> = {
  live: { label: "게재 중", chip: "live" },
  review: { label: "검토 중", chip: "review" },
  paused: { label: "일시정지", chip: "paused" },
  ended: { label: "종료", chip: "ended" },
  issue: { label: "이슈", chip: "issue" },
};
