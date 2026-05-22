"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import Icon from "@shared/ui/Icon";
import type { IgStoriesPanel, IgStory } from "@/lib/instagram-stories";

function relativeTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return "하루 전";
}

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function StoryThumb({ story }: { story: IgStory }) {
  const src = story.mediaType === "VIDEO" ? story.thumbnailUrl : (story.mediaUrl ?? story.thumbnailUrl);
  if (!src) {
    return (
      <div
        className="w-full aspect-[9/16] rounded-xl bg-gradient-to-br from-[var(--w-bg-assistive)] to-[var(--w-bg-alternative)] grid place-items-center"
      >
        <Icon name="image" size={28} style={{ opacity: 0.35 }} />
      </div>
    );
  }
  return (
    <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-[var(--w-bg-alternative)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="w-full h-full object-cover" />
      {story.mediaType === "VIDEO" && (
        <div className="absolute top-2 right-2 py-0.5 px-1.5 rounded-md bg-black/55 text-white" style={{ font: "600 10.5px/1 var(--w-font-sans)" }}>
          VIDEO
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>{label}</span>
      <span style={{ font: "600 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{fmtK(value)}</span>
    </div>
  );
}

function StoryCard({ story }: { story: IgStory }) {
  return (
    <div className={cn(
      "flex flex-col gap-3 p-3 rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)]",
      "transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
    )}>
      <StoryThumb story={story} />
      <div className="flex flex-col gap-2">
        <span style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
          {relativeTime(story.timestamp)}
        </span>
        <div className="h-px bg-[var(--w-line-alternative)]" />
        <div className="flex flex-col gap-1.5">
          <MetricRow label="노출" value={story.insights.impressions} />
          <MetricRow label="도달" value={story.insights.reach} />
          <MetricRow label="답장" value={story.insights.replies} />
          <MetricRow label="프로필" value={story.insights.profileVisits} />
        </div>
      </div>
    </div>
  );
}

function MockBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md bg-[var(--w-bg-alternative)] w-fit"
      style={{ font: "600 11px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
      샘플 데이터
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 px-6 text-center">
      <Icon name="image" size={32} style={{ opacity: 0.35 }} />
      <span style={{ font: "600 14px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
        지금 활성 스토리가 없어요
      </span>
      <span style={{ font: "500 12.5px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
        스토리는 게시 후 24시간이 지나면 자동으로 사라져요.<br />
        만료된 스토리 보기는 곧 제공할게요.
      </span>
    </Card>
  );
}

export default function Stories() {
  const q = useQuery({
    queryKey: ["ig-stories"],
    queryFn: async (): Promise<IgStoriesPanel> => {
      const res = await fetch("/api/instagram/stories");
      if (!res.ok) throw new Error("스토리를 불러오지 못했어요");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 px-5 text-[var(--w-fg-neutral)]">
        <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
        <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>스토리를 불러오는 중…</span>
      </Card>
    );
  }

  if (q.isError || !q.data) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 px-5 text-center text-[var(--w-fg-neutral)]">
        스토리를 불러오지 못했어요.
      </Card>
    );
  }

  const { stories, mock } = q.data;

  if (stories.length === 0 && !mock) return <EmptyState />;

  return (
    <div className="flex flex-col gap-3">
      {mock && <MockBadge />}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        {stories.map(s => <StoryCard key={s.id} story={s} />)}
      </div>
      <div
        className="py-2.5 px-3.5 rounded-xl bg-[var(--w-bg-alternative)]"
        style={{ font: "500 12px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}
      >
        스토리는 게시 후 24시간이 지나면 사라져요. 만료된 스토리 보기는 곧 제공할게요.
      </div>
    </div>
  );
}
