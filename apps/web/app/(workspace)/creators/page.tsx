"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { KpiCard, EmptyState } from "@shared/ui/primitives";
import { useCreators } from "@entities/creator/store";
import { useInfluencerCampaigns } from "@entities/influencer-campaign/store";
import { seedInfluencerDemo } from "@entities/creator/browse/seed";
import type { Creator } from "@entities/creator/model";
import { isCampaignCompleted } from "@entities/influencer-campaign/model";
import { CreatorCard, CreatorEditModal, CategoryFilter, CATEGORY_FILTER_ALL } from "@features/creator-registry";

export default function CreatorsPage() {
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;

  useEffect(() => {
    if (!browseMode) return;
    seedInfluencerDemo();
  }, [browseMode]);

  const { list: creators, upsert } = useCreators();
  const { list: influencerCampaigns } = useInfluencerCampaigns();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_FILTER_ALL);
  const [editing, setEditing] = useState<Creator | null>(null);
  const [showModal, setShowModal] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(creators.flatMap((c) => c.category))).sort(),
    [creators],
  );

  const inProgressCount = useMemo(
    () => influencerCampaigns.filter((c) => !isCampaignCompleted(c)).length,
    [influencerCampaigns],
  );

  const filtered = useMemo(() => {
    const qs = query.trim().toLowerCase();
    return creators.filter((c) => {
      if (categoryFilter !== CATEGORY_FILTER_ALL && !c.category.includes(categoryFilter)) return false;
      if (!qs) return true;
      return (
        c.handle.toLowerCase().includes(qs) ||
        (c.displayName ?? "").toLowerCase().includes(qs)
      );
    });
  }, [creators, query, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const handleSave = (creator: Creator) => {
    upsert(creator);
    setShowModal(false);
    setEditing(null);
  };

  return (
    <div className="w-full max-w-[1080px] mx-auto px-12 py-10 pb-24 flex flex-col gap-6" data-screen-label="크리에이터 장부">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="m-0 font-bold text-[27px] leading-[1.2] tracking-[-0.02em] text-[var(--w-fg-strong)]">
            크리에이터 장부
          </h1>
          <p className="mt-2 mb-0 max-w-[560px] font-medium text-[14px] leading-[1.55] text-[var(--w-fg-neutral)]">
            함께 일했거나 협업하고 싶은 크리에이터를 관리해요.{" "}
            <Link href="/creators/campaigns" className="text-[var(--w-primary-normal)] font-semibold no-underline">
              인플루언서 캠페인
            </Link>
            에서 적합도 순으로 자동 정렬돼요.
          </p>
        </div>
        <Button variant="primary" size="lg" type="button" onClick={openCreate}>
          <Icon name="plus" size={17} /> 크리에이터 추가하기
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="등록 크리에이터" value={`${creators.length}`} suffix="명" />
        <KpiCard label="진행 중 인플루언서 캠페인" value={`${inProgressCount}`} suffix="개" />
      </div>

      {creators.length === 0 ? (
        <EmptyState
          icon={<Icon name="users" size={24} />}
          title="아직 등록한 크리에이터가 없어요"
          desc="함께 일했거나 협업하고 싶은 크리에이터를 추가하면, 캠페인마다 적합도로 자동 정렬해 드려요."
          action={
            <Button variant="primary" type="button" onClick={openCreate}>
              <Icon name="plus" size={16} /> 크리에이터 추가하기
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <div className="relative">
                <Icon
                  name="hash"
                  size={15}
                  style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--w-fg-alternative)" }}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="핸들 또는 이름으로 검색"
                  className="w-full rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] pl-9 pr-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)] transition-[border-color,box-shadow] duration-[120ms]"
                />
              </div>
            </div>
            <div className="w-[200px]">
              <CategoryFilter categories={categories} value={categoryFilter} onChange={setCategoryFilter} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Icon name="users" size={22} />}
              title="조건에 맞는 크리에이터가 없어요"
              desc="검색어나 카테고리 필터를 조정해 보세요."
            />
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <CreatorEditModal
          creator={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
