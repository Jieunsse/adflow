"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueries } from "@tanstack/react-query";
import Link from "next/link";
import PortfolioTabs, { type PortfolioTab } from "@widgets/business-portfolio";
import { FB_MOCK_GOOD, type FbPageInsights } from "@/lib/facebook-insights";
import { IG_MOCK_GOOD, type IgAccountInsights } from "@/lib/instagram-insights";

export default function DashboardBusinessPortfolioPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session } = useSession();

  const tabParam = params.get("tab");
  const activeTab: PortfolioTab = tabParam === "facebook" ? "facebook" : "instagram";

  const setTab = (tab: PortfolioTab) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", tab);
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
    <div className="page" data-screen-label="비즈니스 포트폴리오">
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>대시보드 · 비즈니스 포트폴리오</span>
          <h1 className="page__title">비즈니스 포트폴리오</h1>
          <p className="page__sub">Instagram 과 Facebook 의 오가닉 성과를 한 곳에서 봐요.</p>
        </div>
      </div>

      {loading && (
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", color: "var(--w-fg-neutral)" }}>
          <div className="spinner" />
          <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>채널 데이터를 불러오는 중…</span>
        </div>
      )}

      {bothFailed && (
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 20px", textAlign: "center" }}>
          <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>데이터를 불러오지 못했어요</div>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => { igQ.refetch(); fbQ.refetch(); }}>다시 시도</button>
        </div>
      )}

      {!loading && !bothFailed && (
        <>
          {!session?.pageId && (
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>Meta 계정이 아직 연결되지 않았어요</div>
                <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>Facebook 페이지와 Instagram 비즈니스 계정을 연결하면 실제 인사이트를 볼 수 있어요.</div>
              </div>
              <Link href="/connect" className="btn btn--primary btn--sm">계정 연결하러 가기</Link>
            </div>
          )}

          <PortfolioTabs
            ig={igQ.data ?? IG_MOCK_GOOD}
            fb={fbQ.data ?? FB_MOCK_GOOD}
            activeTab={activeTab}
            onTabChange={setTab}
          />
        </>
      )}
    </div>
  );
}
