"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import Icon from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import ConfirmModal from "@shared/ui/ConfirmModal";
import { useCreators } from "@entities/creator/store";
import { useInfluencerCampaigns } from "@entities/influencer-campaign/store";
import type { CreatorPerformance } from "@entities/creator/model";
import { CreatorAvatar, CreatorEditModal } from "@features/creator-registry";

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  other: "기타",
};

function PerformanceRow({ perf, campaignName }: { perf: CreatorPerformance; campaignName: string }) {
  const roas = perf.revenue != null && perf.cost != null && perf.cost > 0 ? perf.revenue / perf.cost : undefined;

  return (
    <div className="flex flex-col gap-2.5 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)]">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">{campaignName}</div>
        <span className="font-medium text-[11.5px] leading-none text-[var(--w-fg-neutral)]">
          {new Date(perf.recordedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
        </span>
      </div>
      <div className="flex items-center gap-4 flex-wrap font-semibold text-[13px] text-[var(--w-fg-neutral)]">
        {perf.reach != null && <span>도달 {perf.reach.toLocaleString("ko-KR")}</span>}
        {perf.clicks != null && <span>클릭 {perf.clicks.toLocaleString("ko-KR")}</span>}
        {perf.conversions != null && <span>전환 {perf.conversions.toLocaleString("ko-KR")}</span>}
        {perf.revenue != null && <span>매출 ₩{perf.revenue.toLocaleString("ko-KR")}</span>}
        {roas != null && <span className="text-[var(--w-status-positive)]">ROAS {roas.toFixed(1)}x</span>}
      </div>
      <span className="font-medium text-[10.5px] leading-none text-[var(--w-fg-alternative)] self-start">
        직접 입력한 실측값이에요
      </span>
    </div>
  );
}

export default function CreatorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { list: creators, upsert, removeById } = useCreators();
  const { list: influencerCampaigns } = useInfluencerCampaigns();

  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const creator = creators.find((c) => c.id === params.id);

  if (!creator) {
    return (
      <div className="w-full max-w-[760px] mx-auto px-12 py-10" data-screen-label="크리에이터 상세">
        <EmptyState
          icon={<Icon name="users" size={22} />}
          title="크리에이터를 찾을 수 없어요"
          desc="삭제됐거나 잘못된 주소예요."
          action={
            <Button variant="primary" type="button" onClick={() => router.push("/creators")}>
              크리에이터 장부로
            </Button>
          }
        />
      </div>
    );
  }

  const campaignName = (campaignId: string) =>
    influencerCampaigns.find((c) => c.id === campaignId)?.name ?? "삭제된 캠페인";

  const sortedHistory = [...creator.performanceHistory].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  return (
    <div className="w-full max-w-[760px] mx-auto px-12 py-10 pb-24 flex flex-col gap-6" data-screen-label="크리에이터 상세">
      <button
        type="button"
        onClick={() => router.push("/creators")}
        className="self-start inline-flex items-center gap-1.5 font-semibold text-[13px] text-[var(--w-fg-neutral)] bg-transparent border-none cursor-pointer p-0"
      >
        <Icon name="arrow-left" size={14} /> 크리에이터 장부
      </button>

      <Card className="flex items-start gap-4">
        <CreatorAvatar creator={creator} size={64} />
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="m-0 font-bold text-[20px] leading-[1.3] tracking-[-0.01em] text-[var(--w-fg-strong)]">
              {creator.handle}
            </h1>
            <Chip variant="neutral" size="sm">{PLATFORM_LABEL[creator.platform]}</Chip>
          </div>
          {creator.displayName && (
            <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)]">{creator.displayName}</div>
          )}
          {creator.category.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {creator.category.map((c) => (
                <Chip key={c} variant="neutral" size="sm">{c}</Chip>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[var(--w-fg-neutral)]">
            <Icon name="users" size={13} />
            <span className="font-semibold text-[13px] leading-none">
              {creator.followerCount != null ? `${creator.followerCount.toLocaleString("ko-KR")}명` : "팔로워 미입력"}
            </span>
            <span className="font-medium text-[10.5px] leading-none text-[var(--w-fg-alternative)] ml-1">
              직접 입력한 정보예요
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button variant="secondary" size="sm" type="button" onClick={() => setShowEdit(true)}>
            <Icon name="edit" size={14} /> 편집
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => setShowDeleteConfirm(true)}>
            삭제
          </Button>
        </div>
      </Card>

      {creator.note && (
        <Card>
          <div className="font-semibold text-[13px] leading-none text-[var(--w-fg-strong)] mb-2">메모</div>
          <p className="m-0 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-neutral)] whitespace-pre-wrap">
            {creator.note}
          </p>
        </Card>
      )}

      <section className="flex flex-col gap-3.5">
        <h2 className="m-0 font-bold text-[16px] leading-[1.3] tracking-[-0.01em] text-[var(--w-fg-strong)]">
          협업 이력
        </h2>
        {sortedHistory.length === 0 ? (
          <EmptyState
            icon={<Icon name="chart" size={20} />}
            title="협업 성과를 입력하면 다음 캠페인 추천에 반영돼요."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {sortedHistory.map((perf, i) => (
              <PerformanceRow key={`${perf.campaignId}_${i}`} perf={perf} campaignName={campaignName(perf.campaignId)} />
            ))}
          </div>
        )}
      </section>

      {showEdit && (
        <CreatorEditModal
          creator={creator}
          onClose={() => setShowEdit(false)}
          onSave={(updated) => {
            upsert(updated);
            setShowEdit(false);
          }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="크리에이터를 삭제할까요?"
          desc="삭제하면 이 크리에이터의 등록 정보와 협업 이력을 더 이상 장부에서 볼 수 없어요."
          confirmLabel="삭제"
          tone="danger"
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            removeById(creator.id);
            router.push("/creators");
          }}
        />
      )}
    </div>
  );
}
