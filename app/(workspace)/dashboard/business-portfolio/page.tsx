"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueries } from "@tanstack/react-query";
import Link from "next/link";
import { Button, buttonVariants } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import PortfolioTabs, { type PortfolioTab, type IgView } from "@widgets/business-portfolio";
import { FB_MOCK_GOOD, type FbPageInsights } from "@/lib/facebook-insights";
import { IG_MOCK_GOOD, type IgAccountInsights } from "@/lib/instagram-insights";

export default function DashboardBusinessPortfolioPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session } = useSession();

  const tabParam = params.get("tab");
  const activeTab: PortfolioTab = tabParam === "facebook" ? "facebook" : "instagram";
  const viewParam = params.get("view");
  const igView: IgView =
    viewParam === "messages" ? "messages"
    : viewParam === "stories" ? "stories"
    : viewParam === "promoted" ? "promoted"
    : "insights";

  const setTab = (tab: PortfolioTab) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", tab);
    router.replace(`/dashboard/business-portfolio?${next.toString()}`, { scroll: false });
  };

  const setIgView = (v: IgView) => {
    const next = new URLSearchParams(params.toString());
    next.set("view", v);
    router.replace(`/dashboard/business-portfolio?${next.toString()}`, { scroll: false });
  };

  const [igQ, fbQ] = useQueries({
    queries: [
      {
        queryKey: ["ig-insights"],
        queryFn: async (): Promise<IgAccountInsights> => {
          const res = await fetch("/api/instagram/insights");
          if (!res.ok) throw new Error("Instagram 데이터를 불러오지 못했어요");
          return res.json();
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["fb-insights"],
        queryFn: async (): Promise<FbPageInsights> => {
          const res = await fetch("/api/facebook/insights");
          if (!res.ok) throw new Error("Facebook 데이터를 불러오지 못했어요");
          return res.json();
        },
        staleTime: 5 * 60 * 1000,
      },
    ],
  });

  const loading = igQ.isLoading || fbQ.isLoading;
  const bothFailed = igQ.isError && fbQ.isError;

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="비즈니스 포트폴리오">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">대시보드 · 비즈니스 포트폴리오</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">비즈니스 포트폴리오</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">Instagram 과 Facebook 의 오가닉 성과를 한 곳에서 봐요.</p>
        </div>
      </div>

      {loading && (
        <Card className="flex flex-col items-center gap-3 py-10 px-5 text-[var(--w-fg-neutral)]">
          <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
          <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>채널 데이터를 불러오는 중…</span>
        </Card>
      )}

      {bothFailed && (
        <Card className="flex flex-col items-center gap-3 py-8 px-5 text-center">
          <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>데이터를 불러오지 못했어요</div>
          <Button variant="primary" size="sm" type="button" onClick={() => { igQ.refetch(); fbQ.refetch(); }}>다시 시도</Button>
        </Card>
      )}

      {!loading && !bothFailed && (
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

          <PortfolioTabs
            ig={igQ.data ?? IG_MOCK_GOOD}
            fb={fbQ.data ?? FB_MOCK_GOOD}
            activeTab={activeTab}
            onTabChange={setTab}
            igView={igView}
            onIgViewChange={setIgView}
          />
        </>
      )}
    </div>
  );
}
