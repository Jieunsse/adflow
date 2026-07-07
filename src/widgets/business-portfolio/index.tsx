"use client";

import { useState } from "react";
import {
  IG_MOCK_GOOD,
  IG_MOCK_POOR,
  type IgAccountInsights,
} from "@/lib/instagram-insights";
import {
  FB_MOCK_GOOD,
  FB_MOCK_POOR,
  type FbPageInsights,
} from "@/lib/facebook-insights";
import { suggestChannelOptimizations } from "@entities/insights/optimization";
import { cn } from "@shared/lib/cn";
import ChannelInsights, {
  type ChannelKpi,
  type ChannelPostRow,
} from "./ChannelInsights";
import CompareBar from "./CompareBar";
import Messages from "./Messages";
import Stories from "./Stories";
import PromotedContent from "./PromotedContent";
import Partnerships from "./Partnerships";

export type PortfolioTab = "instagram" | "facebook";
export type IgView =
  | "insights"
  | "messages"
  | "stories"
  | "promoted"
  | "partnerships";

type Scenario = "good" | "poor";

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function igKpis(d: IgAccountInsights): ChannelKpi[] {
  return [
    { label: "팔로워", value: fmtK(d.followers) },
    { label: "오가닉 도달 (28일)", value: fmtK(d.reach) },
    { label: "프로필 방문 (28일)", value: fmtK(d.profileViews) },
    { label: "반응률", value: d.engagementRate.toFixed(1), suffix: "%" },
  ];
}

function fbKpis(d: FbPageInsights): ChannelKpi[] {
  return [
    { label: "팔로워", value: fmtK(d.followers) },
    { label: "게시물 (28일)", value: String(d.postCount28d) },
    { label: "평균 반응 (게시물당)", value: fmtK(d.avgReactions) },
    { label: "반응률", value: d.engagementRate.toFixed(1), suffix: "%" },
  ];
}

function igPosts(d: IgAccountInsights): ChannelPostRow[] {
  return d.posts.map((p) => ({
    id: p.id,
    mediaUrl: p.mediaUrl,
    caption: p.caption,
    primary: { label: "좋아요", value: fmtK(p.likeCount) },
    secondary: { label: "댓글", value: fmtK(p.commentCount) },
    tertiary: { label: "저장", value: fmtK(p.savedCount) },
    timestamp: p.timestamp,
  }));
}

function fbPosts(d: FbPageInsights): ChannelPostRow[] {
  return d.posts.map((p) => ({
    id: p.id,
    mediaUrl: p.mediaUrl,
    caption: p.caption,
    primary: { label: "반응", value: fmtK(p.reactionsCount) },
    secondary: { label: "댓글", value: fmtK(p.commentsCount) },
    tertiary: { label: "공유", value: fmtK(p.sharesCount) },
    timestamp: p.timestamp,
  }));
}

export type PortfolioTabsProps = {
  ig: IgAccountInsights;
  fb: FbPageInsights;
  activeTab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
  igView: IgView;
  onIgViewChange: (v: IgView) => void;
};

function tabBtn(active: boolean) {
  return cn(
    "border-none px-3.5 py-2 rounded-lg font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
    active
      ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
      : "bg-transparent text-[var(--w-fg-neutral)]",
  );
}

export default function PortfolioTabs({
  ig,
  fb,
  activeTab,
  onTabChange,
  igView,
  onIgViewChange,
}: PortfolioTabsProps) {
  const [igScenario, setIgScenario] = useState<Scenario>("good");
  const [fbScenario, setFbScenario] = useState<Scenario>("good");

  const igData = ig.mock
    ? igScenario === "good"
      ? IG_MOCK_GOOD
      : IG_MOCK_POOR
    : ig;
  const fbData = fb.mock
    ? fbScenario === "good"
      ? FB_MOCK_GOOD
      : FB_MOCK_POOR
    : fb;

  const igSuggestions = suggestChannelOptimizations("instagram", {
    followers: igData.followers,
    engagementRate: igData.engagementRate,
    reach: igData.reach,
    posts: igData.posts.map((p) => ({
      id: p.id,
      engagement: p.likeCount + p.commentCount + p.savedCount,
    })),
  });
  const fbSuggestions = suggestChannelOptimizations("facebook", {
    followers: fbData.followers,
    engagementRate: fbData.engagementRate,
    postCount28d: fbData.postCount28d,
    posts: fbData.posts.map((p) => ({
      id: p.id,
      engagement: p.reactionsCount + p.commentsCount + p.sharesCount,
    })),
  });

  return (
    <>
      <CompareBar
        ig={{
          handle: igData.igUsername,
          followers: igData.followers,
          engagementRate: igData.engagementRate,
          mock: igData.mock,
        }}
        fb={{
          name: fbData.pageName,
          followers: fbData.followers,
          engagementRate: fbData.engagementRate,
          mock: fbData.mock,
        }}
        onJumpInstagram={() => onTabChange("instagram")}
        onJumpFacebook={() => onTabChange("facebook")}
      />

      <div
        className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]"
        role="tablist"
        aria-label="채널 선택"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "instagram"}
          onClick={() => onTabChange("instagram")}
          className={tabBtn(activeTab === "instagram")}
        >
          Instagram
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "facebook"}
          onClick={() => onTabChange("facebook")}
          className={tabBtn(activeTab === "facebook")}
        >
          Facebook
        </button>
      </div>

      {activeTab === "instagram" ? (
        <>
          <div
            className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]"
            role="tablist"
            aria-label="Instagram 보기 전환"
          >
            <button
              type="button"
              role="tab"
              aria-selected={igView === "insights"}
              onClick={() => onIgViewChange("insights")}
              className={tabBtn(igView === "insights")}
            >
              인사이트
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={igView === "messages"}
              onClick={() => onIgViewChange("messages")}
              className={tabBtn(igView === "messages")}
            >
              메시지
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={igView === "stories"}
              onClick={() => onIgViewChange("stories")}
              className={tabBtn(igView === "stories")}
            >
              스토리
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={igView === "promoted"}
              onClick={() => onIgViewChange("promoted")}
              className={tabBtn(igView === "promoted")}
            >
              콘텐츠 홍보
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={igView === "partnerships"}
              onClick={() => onIgViewChange("partnerships")}
              className={tabBtn(igView === "partnerships")}
            >
              파트너십
            </button>
          </div>
          {igView === "insights" ? (
            <ChannelInsights
              channel="instagram"
              kpis={igKpis(igData)}
              posts={igPosts(igData)}
              accountHandle={igData.igUsername}
              isMock={igData.mock}
              scenario={igScenario}
              onScenarioChange={ig.mock ? setIgScenario : undefined}
              suggestions={igSuggestions}
            />
          ) : igView === "messages" ? (
            <Messages />
          ) : igView === "promoted" ? (
            <PromotedContent />
          ) : igView === "partnerships" ? (
            <Partnerships />
          ) : (
            <Stories />
          )}
        </>
      ) : (
        <ChannelInsights
          channel="facebook"
          kpis={fbKpis(fbData)}
          posts={fbPosts(fbData)}
          accountHandle={fbData.pageName}
          isMock={fbData.mock}
          scenario={fbScenario}
          onScenarioChange={fb.mock ? setFbScenario : undefined}
          suggestions={fbSuggestions}
        />
      )}
    </>
  );
}
