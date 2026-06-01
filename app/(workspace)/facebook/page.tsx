"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, buttonVariants } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import ChannelInsights, { type ChannelKpi, type ChannelPostRow } from "@widgets/business-portfolio/ChannelInsights";
import PageSwitcher from "@widgets/facebook/PageSwitcher";
import { suggestChannelOptimizations } from "@entities/insights/optimization";
import { FB_MOCK_GOOD, FB_MOCK_POOR, type FbPageInsights } from "@/lib/facebook-insights";
import type { FbManagedPagesResult } from "@/lib/facebook-pages";

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function FacebookInsightsFlow() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page") ?? undefined;
  const [scenario, setScenario] = useState<"good" | "poor">("good");

  const { data: pagesData } = useQuery({
    queryKey: ["fb-pages"],
    queryFn: async (): Promise<FbManagedPagesResult> => {
      const res = await fetch("/api/facebook/pages");
      if (!res.ok) throw new Error("FB 페이지 목록을 불러오지 못했어요");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const pages = pagesData?.pages ?? [];
  const activePageId = pageParam ?? session?.pageId ?? pages[0]?.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fb-insights", activePageId ?? "default"],
    queryFn: async (): Promise<FbPageInsights> => {
      const url = activePageId ? `/api/facebook/insights?page=${encodeURIComponent(activePageId)}` : "/api/facebook/insights";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Facebook 데이터를 불러오지 못했어요");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const onSelectPage = (id: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", id);
    router.replace(`/facebook?${sp.toString()}`);
  };

  const fbData = data?.mock ? (scenario === "good" ? FB_MOCK_GOOD : FB_MOCK_POOR) : data;

  const kpis: ChannelKpi[] = fbData
    ? [
        { label: "팔로워", value: fmtK(fbData.followers) },
        { label: "게시물 (28일)", value: String(fbData.postCount28d) },
        { label: "평균 반응 (게시물당)", value: fmtK(fbData.avgReactions) },
        { label: "반응률", value: fbData.engagementRate.toFixed(1), suffix: "%" },
      ]
    : [];

  const posts: ChannelPostRow[] = fbData
    ? fbData.posts.map((p) => ({
        id: p.id,
        mediaUrl: p.mediaUrl,
        caption: p.caption,
        primary: { label: "반응", value: fmtK(p.reactionsCount) },
        secondary: { label: "댓글", value: fmtK(p.commentsCount) },
        tertiary: { label: "공유", value: fmtK(p.sharesCount) },
        timestamp: p.timestamp,
      }))
    : [];

  const suggestions = fbData
    ? suggestChannelOptimizations("facebook", {
        followers: fbData.followers,
        engagementRate: fbData.engagementRate,
        postCount28d: fbData.postCount28d,
        posts: fbData.posts.map((p) => ({ id: p.id, engagement: p.reactionsCount + p.commentsCount + p.sharesCount })),
      })
    : [];

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7">
      <div>
        <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">채널 관리 · Facebook</span>
        <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">인사이트</h1>
      </div>

      {pages.length > 0 && (
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">관리 페이지</span>
          <PageSwitcher pages={pages} activeId={activePageId} onSelect={onSelectPage} />
        </div>
      )}

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
          {fbData && (
            <ChannelInsights
              channel="facebook"
              kpis={kpis}
              posts={posts}
              accountHandle={fbData.pageName}
              isMock={fbData.mock}
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

export default function FacebookInsightsPage() {
  return (
    <Suspense fallback={null}>
      <FacebookInsightsFlow />
    </Suspense>
  );
}
