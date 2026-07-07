"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KpiCard } from "@shared/ui/primitives";
import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { cn } from "@shared/lib/cn";
import { type Suggestion } from "@entities/insights/optimization";
import AiDraftModal from "@features/channel-suggestion-action/AiDraftModal";
import { IgPostPreview } from "@shared/ui/IgPostPreview";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@shared/ui/Dialog";

export type ChannelKpi = { label: string; value: string; suffix?: string };

export type ChannelPostRow = {
  id: string;
  mediaUrl: string;
  caption: string;
  primary: { label: string; value: string }; // IG: 좋아요 / FB: 반응
  secondary: { label: string; value: string }; // 둘 다: 댓글
  tertiary: { label: string; value: string }; // IG: 저장 / FB: 공유
  timestamp: string;
};

export type ChannelInsightsProps = {
  channel: "instagram" | "facebook";
  kpis: ChannelKpi[]; // 4슬롯
  posts: ChannelPostRow[];
  accountHandle?: string;
  profilePicture?: string;
  isMock: boolean;
  scenario?: "good" | "poor";
  onScenarioChange?: (s: "good" | "poor") => void;
  suggestions: Suggestion[];
};

function SuggestionCard({
  s,
  onAction,
  onSecondary,
}: {
  s: Suggestion;
  onAction: (s: Suggestion) => void;
  onSecondary?: (s: Suggestion) => void;
}) {
  const warn = s.severity === "warn";
  const actionLabel = s.action
    ? s.action.kind === "ai-draft"
      ? "광고로 만들기"
      : s.action.kind === "boost-post"
        ? "이 게시물 광고로 만들기"
        : "광고 만들기"
    : null;
  const showSecondary = s.action?.kind === "ai-draft" && !!onSecondary;

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: 14,
        border: "1px solid var(--w-line-alternative)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: warn ? "rgba(255,146,0,0.12)" : "rgba(0,191,64,0.10)",
          color: warn
            ? "var(--w-status-cautionary)"
            : "var(--w-status-positive)",
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Icon name={warn ? "warn" : "trend-up"} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "600 14px/1.4 var(--w-font-sans)",
            color: "var(--w-fg-strong)",
          }}
        >
          {s.title}
        </div>
        {s.detail.map((l, i) => (
          <div
            key={i}
            style={{
              font: "500 12.5px/1.55 var(--w-font-sans)",
              color: "var(--w-fg-neutral)",
              marginTop: 4,
            }}
          >
            {l}
          </div>
        ))}
        {actionLabel && (
          <div className="flex justify-end items-center gap-3 mt-2.5">
            {showSecondary && (
              <button
                type="button"
                onClick={() => onSecondary!(s)}
                className="font-semibold text-[12px] text-[var(--w-primary-press)] bg-[var(--w-primary-bg)] border-0 cursor-pointer hover:bg-[var(--w-primary-bg-hover)] rounded-md px-3 py-1.5 transition-colors"
              >
                초안 보기
              </button>
            )}
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => onAction(s)}
            >
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostRow({
  post,
  onClick,
}: {
  post: ChannelPostRow;
  onClick: () => void;
}) {
  const date = post.timestamp
    ? new Date(post.timestamp).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      })
    : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)] w-full text-left cursor-pointer hover:bg-[var(--w-bg-assistive)] transition-colors duration-[120ms]"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minWidth: 0,
          flex: 1,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: "var(--w-bg-assistive)",
            flex: "0 0 auto",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
        >
          {post.mediaUrl ? (
            <img
              src={post.mediaUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Icon
              name="image"
              size={18}
              style={{ color: "var(--w-fg-assistive)" }}
            />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              font: "500 13px/1.4 var(--w-font-sans)",
              color: "var(--w-fg-strong)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {post.caption || "캡션 없음"}
          </div>
          <div
            style={{
              font: "500 11.5px/1 var(--w-font-sans)",
              color: "var(--w-fg-neutral)",
              marginTop: 4,
            }}
          >
            {date}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          flex: "0 0 auto",
          font: "600 12px/1 var(--w-font-sans)",
          color: "var(--w-fg-neutral)",
        }}
      >
        <span>
          {post.primary.label} {post.primary.value}
        </span>
        <span>
          {post.secondary.label} {post.secondary.value}
        </span>
        <span>
          {post.tertiary.label} {post.tertiary.value}
        </span>
      </div>
    </button>
  );
}

export default function ChannelInsights({
  channel,
  kpis,
  posts,
  accountHandle,
  profilePicture,
  isMock,
  scenario,
  onScenarioChange,
  suggestions,
}: ChannelInsightsProps) {
  const router = useRouter();
  const [draftFor, setDraftFor] = useState<Suggestion | null>(null);
  const [selectedPost, setSelectedPost] = useState<ChannelPostRow | null>(null);
  const channelLabel = channel === "instagram" ? "Instagram" : "Facebook";
  const mockHelp =
    channel === "instagram"
      ? "Facebook 페이지에 Instagram 비즈니스 계정을 연결하면 실제 인사이트를 볼 수 있어요."
      : "Facebook 페이지를 연결하면 실제 인사이트를 볼 수 있어요.";

  const handleAction = (s: Suggestion) => {
    if (!s.action) return;
    switch (s.action.kind) {
      case "ai-draft": {
        const qs = new URLSearchParams({
          outcome: "engagement",
          from: "channel-insights",
        });
        router.push(`/create?${qs.toString()}`);
        return;
      }
      case "boost-post":
        router.push(
          `/create?outcome=boost_post&igMediaId=${encodeURIComponent(s.action.igMediaId)}&from=channel-insights`,
        );
        return;
      case "create-campaign":
        router.push(`/create?from=channel-insights`);
        return;
    }
  };

  return (
    <>
      {isMock && (
        <Card className="bg-[var(--w-accent-violet-soft)] border-transparent flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="text-[var(--w-accent-violet)] pt-0.5">
              <Icon name="info" size={18} />
            </div>
            <div>
              <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">
                {channelLabel} 계정이 연결되지 않아 예시 데이터를 보여드려요
              </div>
              <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-[3px]">
                {mockHelp}
              </div>
            </div>
          </div>
          {onScenarioChange && (
            <div className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]">
              <button
                type="button"
                onClick={() => onScenarioChange("good")}
                className={cn(
                  "border-none px-3.5 py-2 rounded-lg font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
                  scenario === "good"
                    ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
                    : "bg-transparent text-[var(--w-fg-neutral)]",
                )}
              >
                양호 예시
              </button>
              <button
                type="button"
                onClick={() => onScenarioChange("poor")}
                className={cn(
                  "border-none px-3.5 py-2 rounded-lg font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
                  scenario === "poor"
                    ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
                    : "bg-transparent text-[var(--w-fg-neutral)]",
                )}
              >
                개선 필요 예시
              </button>
            </div>
          )}
        </Card>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
        }}
      >
        {kpis.map((k, i) => (
          <KpiCard key={i} label={k.label} value={k.value} suffix={k.suffix} />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        <Card variant="lg">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
              최근 게시물
            </h2>
            {accountHandle && (
              <span className="font-medium text-[12px] leading-none text-[var(--w-fg-neutral)]">
                {channel === "instagram" ? `@${accountHandle}` : accountHandle}
              </span>
            )}
          </div>
          {posts.length === 0 ? (
            <div className="py-5 px-3.5 text-[var(--w-fg-neutral)] font-medium text-[13px] leading-[1.55]">
              <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)] mb-1.5">
                최근 게시물을 가져오지 못했어요
              </div>
              {channel === "instagram"
                ? "게시물이 없거나, Meta 앱의 `instagram_basic` 권한이 활성화 안 됐을 수 있어요. Meta for Developers 콘솔에서 권한 product 를 확인해주세요."
                : "게시물이 없거나, Facebook 페이지의 `pages_read_engagement` 권한이 충분하지 않을 수 있어요."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {posts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  onClick={() => setSelectedPost(post)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card variant="lg">
          <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
            AI 콘텐츠 제안
          </h3>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
            제안은 참고용이에요. 직접 확인 후 적용해요.
          </p>
          <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
          <div className="flex flex-col gap-3">
            {suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                s={s}
                onAction={handleAction}
                onSecondary={setDraftFor}
              />
            ))}
          </div>
        </Card>
      </div>

      <Dialog
        open={!!selectedPost}
        onOpenChange={(o) => !o && setSelectedPost(null)}
      >
        <DialogContent style={{ width: 360, padding: 0, overflow: "hidden" }}>
          <DialogTitle className="sr-only">게시물 미리보기</DialogTitle>
          {selectedPost && (
            <IgPostPreview
              imageUrl={selectedPost.mediaUrl}
              caption={selectedPost.caption}
              handle={accountHandle ?? "instagram"}
              profilePicture={profilePicture}
              timestamp={
                selectedPost.timestamp
                  ? new Date(selectedPost.timestamp).toLocaleDateString(
                      "ko-KR",
                      { month: "short", day: "numeric" },
                    )
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>

      {draftFor && (
        <AiDraftModal
          channel={channel}
          suggestionTitle={draftFor.title}
          suggestionDetail={draftFor.detail}
          onClose={() => setDraftFor(null)}
        />
      )}
    </>
  );
}
