"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@shared/ui/primitives";
import Icon from "@shared/ui/Icon";
import type { IgAccountInsights, IgPost } from "@/lib/instagram-insights";
import { suggestIgOptimizations, type Suggestion } from "@entities/insights/optimization";

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

type IgScenario = "good" | "poor";

const IG_SCENARIOS: Record<IgScenario, IgAccountInsights> = {
  good: {
    followers: 12400,
    reach: 45200,
    profileViews: 1830,
    engagementRate: 4.2,
    igUsername: "brand_account",
    mock: true,
    posts: [
      { id: "g1", mediaUrl: "", caption: "새로운 시즌 컬렉션 출시! ✨", likeCount: 847, commentCount: 63, savedCount: 124, timestamp: "2026-05-10T09:00:00Z" },
      { id: "g2", mediaUrl: "", caption: "고객 인터뷰 — 브랜드를 선택한 이유", likeCount: 612, commentCount: 41, savedCount: 89, timestamp: "2026-05-07T11:30:00Z" },
      { id: "g3", mediaUrl: "", caption: "제품 뒷이야기 🎬", likeCount: 1024, commentCount: 78, savedCount: 201, timestamp: "2026-05-03T14:00:00Z" },
      { id: "g4", mediaUrl: "", caption: "주말 이벤트 안내", likeCount: 398, commentCount: 29, savedCount: 55, timestamp: "2026-04-28T10:00:00Z" },
      { id: "g5", mediaUrl: "", caption: "팔로워 Q&A 정리", likeCount: 723, commentCount: 112, savedCount: 167, timestamp: "2026-04-22T13:00:00Z" },
    ],
  },
  poor: {
    followers: 3200,
    reach: 8100,
    profileViews: 290,
    engagementRate: 0.6,
    igUsername: "brand_account",
    mock: true,
    posts: [
      { id: "p1", mediaUrl: "", caption: "신제품 안내", likeCount: 28, commentCount: 2, savedCount: 3, timestamp: "2026-05-10T09:00:00Z" },
      { id: "p2", mediaUrl: "", caption: "이번 주 소식", likeCount: 19, commentCount: 1, savedCount: 1, timestamp: "2026-05-07T11:30:00Z" },
      { id: "p3", mediaUrl: "", caption: "할인 이벤트", likeCount: 34, commentCount: 3, savedCount: 4, timestamp: "2026-05-03T14:00:00Z" },
      { id: "p4", mediaUrl: "", caption: "브랜드 소개", likeCount: 12, commentCount: 0, savedCount: 2, timestamp: "2026-04-28T10:00:00Z" },
      { id: "p5", mediaUrl: "", caption: "5월 프로모션", likeCount: 21, commentCount: 1, savedCount: 1, timestamp: "2026-04-22T13:00:00Z" },
    ],
  },
};

function SuggestionCard({ s }: { s: Suggestion }) {
  const warn = s.severity === "warn";
  return (
    <div style={{ display: "flex", gap: 14, padding: 14, border: "1px solid var(--w-line-alternative)", borderRadius: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: warn ? "rgba(255,146,0,0.12)" : "rgba(0,191,64,0.10)", color: warn ? "var(--w-status-cautionary)" : "var(--w-status-positive)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <Icon name={warn ? "warn" : "trend-up"} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 14px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{s.title}</div>
        {s.detail.map((l, i) => (
          <div key={i} style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function PostRow({ post }: { post: IgPost }) {
  const date = post.timestamp
    ? new Date(post.timestamp).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    : "";
  return (
    <div className="list-row">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--w-bg-assistive)", flex: "0 0 auto", overflow: "hidden", display: "grid", placeItems: "center" }}>
          {post.mediaUrl
            ? <img src={post.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Icon name="image" size={18} style={{ color: "var(--w-fg-assistive)" }} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: "500 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {post.caption || "캡션 없음"}
          </div>
          <div style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{date}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flex: "0 0 auto", font: "600 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
        <span>좋아요 {fmtNum(post.likeCount)}</span>
        <span>댓글 {fmtNum(post.commentCount)}</span>
        <span>저장 {fmtNum(post.savedCount)}</span>
      </div>
    </div>
  );
}

export default function IgInsightsTab() {
  const [scenario, setScenario] = useState<IgScenario>("good");

  const q = useQuery<IgAccountInsights>({
    queryKey: ["ig-insights"],
    queryFn: async () => {
      const res = await fetch("/api/instagram/insights");
      if (!res.ok) throw new Error("인스타그램 데이터를 불러오지 못했어요");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (q.isLoading) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px", color: "var(--w-fg-neutral)" }}>
        <div className="spinner" />
        <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>Instagram 데이터를 불러오는 중…</span>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 20px", textAlign: "center" }}>
        <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>데이터를 불러오지 못했어요</div>
        <button className="btn btn--primary btn--sm" type="button" onClick={() => q.refetch()}>다시 시도</button>
      </div>
    );
  }

  const fetched = q.data!;
  const d = fetched.mock ? IG_SCENARIOS[scenario] : fetched;

  const suggestions = suggestIgOptimizations({
    followers: d.followers,
    reach: d.reach,
    engagementRate: d.engagementRate,
    posts: d.posts,
  });

  return (
    <>
      {fetched.mock && (
        <div className="card" style={{ background: "var(--w-accent-violet-soft)", borderColor: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ color: "var(--w-accent-violet)", paddingTop: 2 }}><Icon name="info" size={18} /></div>
            <div>
              <div style={{ font: "600 14px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>Instagram 비즈니스 계정이 연결되지 않아 예시 데이터를 보여드려요</div>
              <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 3 }}>Facebook 페이지에 Instagram 비즈니스 계정을 연결하면 실제 인사이트를 볼 수 있어요.</div>
            </div>
          </div>
          <div className="seg">
            <button type="button" className={scenario === "good" ? "on" : ""} onClick={() => setScenario("good")}>양호 예시</button>
            <button type="button" className={scenario === "poor" ? "on" : ""} onClick={() => setScenario("poor")}>개선 필요 예시</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <KpiCard label="팔로워" value={fmtNum(d.followers)} />
        <KpiCard label="오가닉 성과" value={fmtNum(d.reach)} />
        <KpiCard label="프로필 방문 (28일)" value={fmtNum(d.profileViews)} />
        <KpiCard label="반응률" value={d.engagementRate.toFixed(1)} suffix="%" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "flex-start" }}>
        <div className="card card--lg">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 className="section-title" style={{ margin: 0 }}>최근 게시물</h2>
            {d.igUsername && (
              <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>@{d.igUsername}</span>
            )}
          </div>
          {d.posts.map(post => <PostRow key={post.id} post={post} />)}
        </div>

        <div className="card card--lg">
          <h3 className="section-title">AI 콘텐츠 제안</h3>
          <p className="section-sub">제안은 참고용이에요. 직접 확인 후 적용해요.</p>
          <hr className="divider" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {suggestions.map((s, i) => <SuggestionCard key={i} s={s} />)}
          </div>
        </div>
      </div>
    </>
  );
}
