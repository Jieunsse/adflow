"use client";

import { useQueries } from "@tanstack/react-query";
import { Card } from "@shared/ui/Card";
import Icon from "@shared/ui/Icon";
import Link from "next/link";

interface BoostPostEntry {
  campaignId: string;
  igMediaId: string;
  igMediaThumbnailUrl: string;
}

interface CampaignInsights {
  status?: string;
  reach?: number;
  post_engagement?: number;
  spend?: number;
  endDate?: string | null;
}

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function loadBoostPosts(): BoostPostEntry[] {
  const entries: BoostPostEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("adflow:boost-post:")) continue;
      const campaignId = key.slice("adflow:boost-post:".length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        igMediaId?: string;
        igMediaThumbnailUrl?: string;
      };
      entries.push({
        campaignId,
        igMediaId: parsed.igMediaId ?? "",
        igMediaThumbnailUrl: parsed.igMediaThumbnailUrl ?? "",
      });
    }
  } catch {
    /* localStorage 사용 불가 */
  }
  return entries;
}

export default function PromotedContent() {
  const posts = loadBoostPosts();

  const insightQueries = useQueries({
    queries: posts.map((p) => ({
      queryKey: ["boost-insights", p.campaignId],
      queryFn: async (): Promise<CampaignInsights> => {
        const res = await fetch(`/api/insights/${p.campaignId}`);
        if (!res.ok) return {};
        const data = (await res.json()) as {
          insights?: {
            reach?: number;
            actions?: Array<{ action_type: string; value: string }>;
            spend?: string;
          };
          campaign?: { effective_status?: string; end_time?: string };
        };
        const engAction = data.insights?.actions?.find(
          (a) => a.action_type === "post_engagement",
        );
        return {
          status: data.campaign?.effective_status,
          reach: data.insights?.reach,
          post_engagement: engAction
            ? parseInt(engAction.value, 10)
            : undefined,
          spend: data.insights?.spend
            ? Math.round(parseFloat(data.insights.spend))
            : undefined,
          endDate: data.campaign?.end_time?.slice(0, 10) ?? null,
        };
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  if (posts.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] grid place-items-center">
          <Icon name="instagram" size={22} />
        </div>
        <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">
          아직 홍보한 콘텐츠가 없어요
        </div>
        <p className="font-medium text-[12.5px] leading-[1.55] text-[var(--w-fg-normal)] m-0">
          '광고 만들기'에서 콘텐츠 홍보를 선택하면 여기에 표시돼요.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--w-accent-violet)] text-white font-semibold text-[13px] leading-none no-underline mt-1"
          style={{ color: "#fff" }}
        >
          <Icon name="plus" size={14} /> 콘텐츠 홍보 시작하기
        </Link>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {posts.map((p, i) => {
        const q = insightQueries[i];
        const ins = q.data;
        const statusLabel =
          ins?.status === "ACTIVE"
            ? "게재 중"
            : ins?.status === "IN_REVIEW"
              ? "검토 중"
              : ins?.status === "PAUSED"
                ? "일시정지"
                : "—";
        const statusColor =
          ins?.status === "ACTIVE"
            ? "var(--w-status-positive)"
            : ins?.status === "IN_REVIEW"
              ? "var(--w-status-caution)"
              : "var(--w-fg-neutral)";

        return (
          <Card
            key={p.campaignId}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              padding: "16px 18px",
            }}
          >
            {p.igMediaThumbnailUrl ? (
              <img
                src={p.igMediaThumbnailUrl}
                alt="홍보 게시물"
                className="rounded-xl object-cover flex-shrink-0"
                style={{ width: 64, height: 64 }}
              />
            ) : (
              <div
                className="rounded-xl flex-shrink-0 bg-[var(--w-bg-alternative)] grid place-items-center"
                style={{ width: 64, height: 64 }}
              >
                <Icon
                  name="image"
                  size={20}
                  style={{ color: "var(--w-fg-neutral)" }}
                />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    font: "600 12px/1 var(--w-font-sans)",
                    color: statusColor,
                  }}
                >
                  {statusLabel}
                </span>
                {ins?.endDate && (
                  <span
                    style={{
                      font: "500 11.5px/1 var(--w-font-sans)",
                      color: "var(--w-fg-neutral)",
                    }}
                  >
                    ~ {ins.endDate}
                  </span>
                )}
                <Link
                  href={`/campaigns/${p.campaignId}`}
                  className="ml-auto inline-flex items-center gap-1 font-medium text-[12px] text-[var(--w-primary-press)] no-underline"
                  style={{ color: "var(--w-primary-press)" }}
                >
                  성과 보기 <Icon name="arrow-right" size={12} />
                </Link>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <span
                    style={{
                      font: "500 11px/1 var(--w-font-sans)",
                      color: "var(--w-fg-neutral)",
                      display: "block",
                      marginBottom: 3,
                    }}
                  >
                    도달
                  </span>
                  <span
                    style={{
                      font: "600 14px/1 var(--w-font-sans)",
                      color: "var(--w-fg-strong)",
                    }}
                  >
                    {q.isLoading
                      ? "—"
                      : ins?.reach != null
                        ? fmtK(ins.reach)
                        : "—"}
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      font: "500 11px/1 var(--w-font-sans)",
                      color: "var(--w-fg-neutral)",
                      display: "block",
                      marginBottom: 3,
                    }}
                  >
                    참여
                  </span>
                  <span
                    style={{
                      font: "600 14px/1 var(--w-font-sans)",
                      color: "var(--w-fg-strong)",
                    }}
                  >
                    {q.isLoading
                      ? "—"
                      : ins?.post_engagement != null
                        ? fmtK(ins.post_engagement)
                        : "—"}
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      font: "500 11px/1 var(--w-font-sans)",
                      color: "var(--w-fg-neutral)",
                      display: "block",
                      marginBottom: 3,
                    }}
                  >
                    소진 예산
                  </span>
                  <span
                    style={{
                      font: "600 14px/1 var(--w-font-sans)",
                      color: "var(--w-fg-strong)",
                    }}
                  >
                    {q.isLoading
                      ? "—"
                      : ins?.spend != null
                        ? `₩${ins.spend.toLocaleString("ko-KR")}`
                        : "—"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
