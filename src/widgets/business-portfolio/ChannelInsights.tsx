"use client";

import { KpiCard } from "@shared/ui/primitives";
import Icon from "@shared/ui/Icon";
import { type Suggestion } from "@entities/insights/optimization";

export type ChannelKpi = { label: string; value: string; suffix?: string };

export type ChannelPostRow = {
  id: string;
  mediaUrl: string;
  caption: string;
  primary: { label: string; value: string };    // IG: 좋아요 / FB: 반응
  secondary: { label: string; value: string };  // 둘 다: 댓글
  tertiary: { label: string; value: string };   // IG: 저장 / FB: 공유
  timestamp: string;
};

export type ChannelInsightsProps = {
  channel: "instagram" | "facebook";
  kpis: ChannelKpi[]; // 4슬롯
  posts: ChannelPostRow[];
  accountHandle?: string;
  isMock: boolean;
  scenario?: "good" | "poor";
  onScenarioChange?: (s: "good" | "poor") => void;
  suggestions: Suggestion[];
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

function PostRow({ post }: { post: ChannelPostRow }) {
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
        <span>{post.primary.label} {post.primary.value}</span>
        <span>{post.secondary.label} {post.secondary.value}</span>
        <span>{post.tertiary.label} {post.tertiary.value}</span>
      </div>
    </div>
  );
}

export default function ChannelInsights({ channel, kpis, posts, accountHandle, isMock, scenario, onScenarioChange, suggestions }: ChannelInsightsProps) {
  const channelLabel = channel === "instagram" ? "Instagram" : "Facebook";
  const mockHelp = channel === "instagram"
    ? "Facebook 페이지에 Instagram 비즈니스 계정을 연결하면 실제 인사이트를 볼 수 있어요."
    : "Facebook 페이지를 연결하면 실제 인사이트를 볼 수 있어요.";

  return (
    <>
      {isMock && (
        <div className="card" style={{ background: "var(--w-accent-violet-soft)", borderColor: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ color: "var(--w-accent-violet)", paddingTop: 2 }}><Icon name="info" size={18} /></div>
            <div>
              <div style={{ font: "600 14px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{channelLabel} 계정이 연결되지 않아 예시 데이터를 보여드려요</div>
              <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 3 }}>{mockHelp}</div>
            </div>
          </div>
          {onScenarioChange && (
            <div className="seg">
              <button type="button" className={scenario === "good" ? "on" : ""} onClick={() => onScenarioChange("good")}>양호 예시</button>
              <button type="button" className={scenario === "poor" ? "on" : ""} onClick={() => onScenarioChange("poor")}>개선 필요 예시</button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {kpis.map((k, i) => (
          <KpiCard key={i} label={k.label} value={k.value} suffix={k.suffix} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "flex-start" }}>
        <div className="card card--lg">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 className="section-title" style={{ margin: 0 }}>최근 게시물</h2>
            {accountHandle && (
              <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>{channel === "instagram" ? `@${accountHandle}` : accountHandle}</span>
            )}
          </div>
          {posts.length === 0 ? (
            <div style={{ padding: "20px 14px", color: "var(--w-fg-neutral)", font: "500 12.5px/1.55 var(--w-font-sans)" }}>
              <div style={{ font: "600 13.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 6 }}>최근 게시물을 가져오지 못했어요</div>
              {channel === "instagram"
                ? "게시물이 없거나, Meta 앱의 `instagram_basic` 권한이 활성화 안 됐을 수 있어요. Meta for Developers 콘솔에서 권한 product 를 확인해주세요."
                : "게시물이 없거나, Facebook 페이지의 `pages_read_engagement` 권한이 충분하지 않을 수 있어요."}
            </div>
          ) : (
            posts.map(post => <PostRow key={post.id} post={post} />)
          )}
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
