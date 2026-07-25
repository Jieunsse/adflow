"use client";

import Link from "next/link";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import Icon from "@shared/ui/Icon";
import type { Creator } from "@entities/creator/model";

const PLATFORM_LABEL: Record<Creator["platform"], string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  other: "기타",
};

function latestPerformanceSummary(creator: Creator): string | null {
  if (creator.performanceHistory.length === 0) return null;
  const latest = creator.performanceHistory[creator.performanceHistory.length - 1];
  const parts: string[] = [];
  if (latest.reach != null) parts.push(`도달 ${latest.reach.toLocaleString("ko-KR")}`);
  if (latest.conversions != null) parts.push(`전환 ${latest.conversions.toLocaleString("ko-KR")}`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function CreatorAvatar({ creator, size = 48 }: { creator: Creator; size?: number }) {
  const initial = (creator.displayName || creator.handle || "?").replace("@", "").charAt(0).toUpperCase();
  if (creator.avatarUrl) {
    return (
      <img
        src={creator.avatarUrl}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full grid place-items-center shrink-0 font-bold bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

export function CreatorCard({ creator }: { creator: Creator }) {
  const perfSummary = latestPerformanceSummary(creator);

  return (
    <Link href={`/creators/${creator.id}`} className="no-underline text-inherit">
      <Card className="flex flex-col gap-3.5 h-full hover:border-[var(--w-primary-normal)] transition-colors duration-[120ms]">
        <div className="flex items-center gap-3">
          <CreatorAvatar creator={creator} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)] truncate">
              {creator.handle}
            </div>
            <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] truncate">
              {creator.displayName || PLATFORM_LABEL[creator.platform]}
              {" · "}
              {PLATFORM_LABEL[creator.platform]}
            </div>
          </div>
        </div>

        {creator.category.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {creator.category.map((c) => (
              <Chip key={c} variant="neutral" size="sm">
                {c}
              </Chip>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--w-line-alternative)]">
          <div className="flex items-center gap-1.5 text-[var(--w-fg-neutral)]">
            <Icon name="users" size={13} />
            <span className="font-semibold text-[13px] leading-none">
              {creator.followerCount != null ? `${creator.followerCount.toLocaleString("ko-KR")}명` : "미입력"}
            </span>
          </div>
          <span className="font-medium text-[10.5px] leading-none text-[var(--w-fg-alternative)]">
            직접 입력한 정보예요
          </span>
        </div>

        <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
          {perfSummary ?? "협업 이력 없어요"}
        </div>
      </Card>
    </Link>
  );
}
