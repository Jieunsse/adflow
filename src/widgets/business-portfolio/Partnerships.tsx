"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card } from "@shared/ui/Card";
import Icon from "@shared/ui/Icon";
import { useCreators } from "@entities/creator/store";
import { findCreatorByHandle } from "@entities/creator/match";
import type {
  BrandedContentItem,
  BrandedContentResponse,
} from "@/app/api/instagram/branded-content/route";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function Partnerships() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["branded-content"],
    queryFn: async (): Promise<BrandedContentResponse> => {
      const res = await fetch("/api/instagram/branded-content");
      if (!res.ok) throw new Error("파트너십 콘텐츠를 불러오지 못했어요");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 px-5 text-[var(--w-fg-neutral)]">
        <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
        <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>
          파트너십 콘텐츠를 불러오는 중…
        </span>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="flex flex-col items-center gap-3 py-8 px-5 text-center">
        <div
          style={{
            font: "700 15px/1.3 var(--w-font-sans)",
            color: "var(--w-fg-strong)",
          }}
        >
          파트너십 콘텐츠를 불러오지 못했어요
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] font-semibold text-[13px] leading-none cursor-pointer"
        >
          <Icon name="refresh" size={13} /> 다시 시도
        </button>
      </Card>
    );
  }

  if (data.items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] grid place-items-center">
          <Icon name="users" size={22} />
        </div>
        <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">
          파트너십 콘텐츠가 없어요
        </div>
        <p className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-normal)] m-0">
          크리에이터가 게시물에 우리 비즈니스 계정을 파트너로 태그하면 여기에
          표시돼요.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card
        className="flex items-start gap-3 py-3.5 px-4"
        style={{ background: "var(--w-bg-alternative)" }}
      >
        <Icon
          name="info"
          size={16}
          style={{ color: "var(--w-fg-neutral)", marginTop: 1, flexShrink: 0 }}
        />
        <div>
          <div
            style={{
              font: "600 12.5px/1.4 var(--w-font-sans)",
              color: "var(--w-fg-strong)",
            }}
          >
            크리에이터가 우리 브랜드를 파트너로 태그한 게시물이에요
          </div>
          <p
            className="m-0 mt-1"
            style={{
              font: "500 12px/1.55 var(--w-font-sans)",
              color: "var(--w-fg-neutral)",
            }}
          >
            크리에이터가 광고 사용을 승인한 콘텐츠는 그대로 광고로 집행할 수
            있어요. 승인 상태는 Instagram 의{" "}
            <code
              style={{
                font: "500 11.5px/1 var(--w-font-mono, monospace)",
                color: "var(--w-fg-strong)",
              }}
            >
              is_eligible_for_branded_content
            </code>{" "}
            값을 따라요.
            {data.mock && (
              <span
                style={{
                  marginLeft: 6,
                  padding: "1.5px 6px",
                  borderRadius: 4,
                  background: "var(--w-bg-elevated)",
                  color: "var(--w-fg-neutral)",
                  font: "600 10px/1.4 var(--w-font-sans)",
                }}
              >
                MOCK
              </span>
            )}
          </p>
        </div>
      </Card>

      {data.items.map((item) => (
        <PartnershipCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function PartnershipCard({ item }: { item: BrandedContentItem }) {
  const eligible = item.isEligibleForBrandedContent;
  const { list: creators } = useCreators();
  const matchedCreator = findCreatorByHandle(creators, item.creatorUsername);

  return (
    <Card style={{ display: "flex", gap: 14, padding: "16px 18px" }}>
      <img
        src={item.mediaUrl}
        alt=""
        className="rounded-xl object-cover flex-shrink-0"
        style={{ width: 88, height: 88 }}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={item.creatorAvatarUrl}
            alt=""
            className="rounded-full flex-shrink-0"
            style={{ width: 24, height: 24 }}
          />
          <span
            style={{
              font: "600 13px/1 var(--w-font-sans)",
              color: "var(--w-fg-strong)",
            }}
          >
            @{item.creatorUsername}
          </span>
          {matchedCreator && (
            <Link
              href={`/creators/${matchedCreator.id}`}
              className="no-underline"
              style={{
                font: "600 11.5px/1 var(--w-font-sans)",
                color: "var(--w-fg-alternative)",
              }}
            >
              장부에서 보기
            </Link>
          )}
          <span
            style={{
              font: "500 11.5px/1 var(--w-font-sans)",
              color: "var(--w-fg-neutral)",
            }}
          >
            {fmtDate(item.timestamp)}
          </span>
          <span style={{ marginLeft: "auto" }}>
            {eligible ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background:
                    "color-mix(in srgb, var(--w-status-positive) 12%, transparent)",
                  color: "var(--w-status-positive)",
                  font: "600 11px/1 var(--w-font-sans)",
                }}
              >
                <Icon name="check" size={12} /> 광고 사용 가능
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "var(--w-bg-alternative)",
                  color: "var(--w-fg-neutral)",
                  font: "600 11px/1 var(--w-font-sans)",
                }}
              >
                <Icon name="lock" size={12} /> 광고 사용 불가
              </span>
            )}
          </span>
        </div>

        <p
          className="m-0"
          style={{
            font: "500 13px/1.5 var(--w-font-sans)",
            color: "var(--w-fg-normal)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.caption}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 2,
          }}
        >
          {eligible ? (
            <Link
              href={`/create?outcome=boost_post&igMediaId=${item.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--w-accent-violet)] font-semibold text-[13px] leading-none no-underline"
              style={{ color: "#fff" }}
            >
              광고집행
            </Link>
          ) : (
            <>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-[13px] leading-none"
                style={{
                  background: "var(--w-bg-alternative)",
                  color: "var(--w-fg-neutral)",
                  border: "none",
                  cursor: "not-allowed",
                }}
              >
                광고집행
              </button>
              <span
                style={{
                  font: "500 11.5px/1.4 var(--w-font-sans)",
                  color: "var(--w-fg-neutral)",
                }}
              >
                {item.ineligibilityReason}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
