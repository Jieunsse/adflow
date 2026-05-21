"use client";

import { useState } from "react";
import { IG_MOCK_GOOD, IG_MOCK_POOR, type IgAccountInsights } from "@/lib/instagram-insights";
import { FB_MOCK_GOOD, FB_MOCK_POOR, type FbPageInsights } from "@/lib/facebook-insights";
import { suggestChannelOptimizations } from "@entities/insights/optimization";
import ChannelInsights, { type ChannelKpi, type ChannelPostRow } from "./ChannelInsights";
import CompareBar from "./CompareBar";

export type PortfolioTab = "instagram" | "facebook";

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
  return d.posts.map(p => ({
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
  return d.posts.map(p => ({
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
};

export default function PortfolioTabs({ ig, fb, activeTab, onTabChange }: PortfolioTabsProps) {
  const [igScenario, setIgScenario] = useState<Scenario>("good");
  const [fbScenario, setFbScenario] = useState<Scenario>("good");

  const igData = ig.mock ? (igScenario === "good" ? IG_MOCK_GOOD : IG_MOCK_POOR) : ig;
  const fbData = fb.mock ? (fbScenario === "good" ? FB_MOCK_GOOD : FB_MOCK_POOR) : fb;

  const igSuggestions = suggestChannelOptimizations("instagram", {
    followers: igData.followers,
    engagementRate: igData.engagementRate,
    reach: igData.reach,
    posts: igData.posts.map(p => ({ engagement: p.likeCount + p.commentCount + p.savedCount })),
  });
  const fbSuggestions = suggestChannelOptimizations("facebook", {
    followers: fbData.followers,
    engagementRate: fbData.engagementRate,
    postCount28d: fbData.postCount28d,
    posts: fbData.posts.map(p => ({ engagement: p.reactionsCount + p.commentsCount + p.sharesCount })),
  });

  return (
    <>
      <CompareBar
        ig={{ handle: igData.igUsername, followers: igData.followers, engagementRate: igData.engagementRate, mock: igData.mock }}
        fb={{ name: fbData.pageName, followers: fbData.followers, engagementRate: fbData.engagementRate, mock: fbData.mock }}
        onJumpInstagram={() => onTabChange("instagram")}
        onJumpFacebook={() => onTabChange("facebook")}
      />

      <div className="seg" role="tablist" aria-label="채널 선택">
        <button type="button" role="tab" aria-selected={activeTab === "instagram"} className={activeTab === "instagram" ? "on" : ""} onClick={() => onTabChange("instagram")}>Instagram</button>
        <button type="button" role="tab" aria-selected={activeTab === "facebook"} className={activeTab === "facebook" ? "on" : ""} onClick={() => onTabChange("facebook")}>Facebook</button>
      </div>

      {activeTab === "instagram" ? (
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
