"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button, buttonVariants } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import ChannelInsights, { type ChannelKpi, type ChannelPostRow } from "@widgets/business-portfolio/ChannelInsights";
import { suggestChannelOptimizations } from "@entities/insights/optimization";
import { IG_MOCK_GOOD, IG_MOCK_POOR, type IgAccountInsights } from "@/lib/instagram-insights";

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function InstagramInsightsPage() {
  const { data: session } = useSession();
  const [scenario, setScenario] = useState<"good" | "poor">("good");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ig-insights"],
    queryFn: async (): Promise<IgAccountInsights> => {
      const res = await fetch("/api/instagram/insights");
      if (!res.ok) throw new Error("Instagram 데이터를 불러오지 못했어요");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const igData = data?.mock ? (scenario === "good" ? IG_MOCK_GOOD : IG_MOCK_POOR) : data;

  const kpis: ChannelKpi[] = igData
    ? [
        { label: "팔로워", value: fmtK(igData.followers) },
        { label: "오가닉 도달 (28일)", value: fmtK(igData.reach) },
        { label: "프로필 방문 (28일)", value: fmtK(igData.profileViews) },
        { label: "반응률", value: igData.engagementRate.toFixed(1), suffix: "%" },
      ]
    : [];

  const posts: ChannelPostRow[] = igData
    ? igData.posts.map((p) => ({
        id: p.id,
        mediaUrl: p.mediaUrl,
        caption: p.caption,
        primary: { label: "좋아요", value: fmtK(p.likeCount) },
        secondary: { label: "댓글", value: fmtK(p.commentCount) },
        tertiary: { label: "저장", value: fmtK(p.savedCount) },
        timestamp: p.timestamp,
      }))
    : [];

  const suggestions = igData
    ? suggestChannelOptimizations("instagram", {
        followers: igData.followers,
        engagementRate: igData.engagementRate,
        reach: igData.reach,
        posts: igData.posts.map((p) => ({ engagement: p.likeCount + p.commentCount + p.savedCount })),
      })
    : [];

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7">
      <div>
        <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">채널 관리 · Instagram</span>
        <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">인사이트</h1>
      </div>

      {isLoading && (
        <Card className="flex flex-col items-center gap-3 py-10 px-5 text-[var(--w-fg-neutral)]">
          <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
          <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>채널 데이터를 불러오는 중…</span>
        </Card>
      )}

      {isError && (
        <Card className="flex flex-col items-center gap-3 py-8 px-5 text-center">
          <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>데이터를 불러오지 못했어요</div>
          <Button variant="primary" size="sm" type="button" onClick={() => refetch()}>다시 시도</Button>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          {!session?.pageId && (
            <Card className="flex items-center justify-between gap-4">
              <div>
                <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>Meta 계정이 아직 연결되지 않았어요</div>
                <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>Facebook 페이지와 Instagram 비즈니스 계정을 연결하면 실제 인사이트를 볼 수 있어요.</div>
              </div>
              <Link href="/connect" className={buttonVariants({ variant: "primary", size: "sm" })}>계정 연결하러 가기</Link>
            </Card>
          )}
          {igData && (
            <ChannelInsights
              channel="instagram"
              kpis={kpis}
              posts={posts}
              accountHandle={igData.igUsername}
              isMock={igData.mock}
              scenario={scenario}
              onScenarioChange={data?.mock ? setScenario : undefined}
              suggestions={suggestions}
            />
          )}
        </>
      )}
    </div>
  );
}
