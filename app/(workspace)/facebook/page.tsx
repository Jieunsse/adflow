"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, buttonVariants } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import Icon from "@shared/ui/Icon";
import ChannelInsights, { type ChannelKpi, type ChannelPostRow } from "@widgets/business-portfolio/ChannelInsights";
import { suggestChannelOptimizations } from "@entities/insights/optimization";
import { FB_MOCK_GOOD, FB_MOCK_POOR, type FbPageInsights } from "@/lib/facebook-insights";
import type { FbManagedPage, FbManagedPagesResult } from "@/lib/facebook-pages";

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function PageSwitcher({
  pages,
  activeId,
  onSelect,
}: {
  pages: FbManagedPage[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const active = pages.find((p) => p.id === activeId) ?? pages[0];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 bg-[var(--w-bg-elevated)] border rounded-[12px] pl-2 pr-3 py-1.5 transition-colors hover:border-[var(--w-line-strong)]"
        style={{
          borderColor: open ? "var(--w-primary-normal)" : "var(--w-line-normal)",
          boxShadow: open ? "0 0 0 4px rgba(0,102,255,0.14)" : "none",
        }}
      >
        {active?.pictureUrl ? (
          <img src={active.pictureUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-[var(--w-bg-neutral)]" />
        )}
        <span className="font-medium text-[13.5px] text-[var(--w-fg-strong)]">{active?.name ?? "페이지 선택"}</span>
        <Icon
          name="chev-down"
          size={14}
          style={{
            color: "var(--w-fg-alternative)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[200] min-w-[260px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[12px] p-1 flex flex-col"
          style={{ boxShadow: "0 8px 24px rgba(23,23,23,0.10)" }}
        >
          {pages.map((p) => {
            const isActive = p.id === active?.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { onSelect(p.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-[8px] text-left transition-colors"
                style={{
                  background: isActive ? "var(--w-primary-soft)" : "transparent",
                  color: isActive ? "var(--w-primary-press)" : "var(--w-fg-normal)",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--w-bg-neutral)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {p.pictureUrl ? (
                  <img src={p.pictureUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--w-bg-neutral)]" />
                )}
                <span className="flex-1 font-medium text-[13.5px]">{p.name}</span>
                {isActive && <Icon name="check" size={14} style={{ color: "var(--w-primary-normal)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FacebookInsightsPage() {
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
        posts: fbData.posts.map((p) => ({ engagement: p.reactionsCount + p.commentsCount + p.sharesCount })),
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
