"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Select } from "@shared/ui/Select";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { useProducts } from "@shared/lib/products";
import { useInfluencerCampaigns } from "@entities/influencer-campaign/store";
import type { InfluencerCampaign } from "@entities/influencer-campaign/model";

const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)] transition-[border-color,box-shadow] duration-[120ms]";

const LABEL_CLASS = "font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]";

function makeId(): string {
  return `infl_campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function NewInfluencerCampaignPage() {
  const router = useRouter();
  const { activeId } = useBrandProfileStorage();
  const brandProfileId = activeId ?? "";
  const { products } = useProducts(brandProfileId);
  const { add } = useInfluencerCampaigns();

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [productId, setProductId] = useState("");
  const [productText, setProductText] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const canSave = name.trim().length > 0 && goal.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    const campaign: InfluencerCampaign = {
      id: makeId(),
      name: name.trim(),
      goal: goal.trim(),
      productId: products.length > 0 ? (productId || undefined) : (productText.trim() || undefined),
      budget: budget.trim() ? Number(budget) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      brandProfileId,
      entries: [],
      createdAt: new Date().toISOString(),
    };
    add(campaign);
    router.push(`/creators/campaigns/${campaign.id}`);
  };

  return (
    <div className="w-full max-w-[640px] mx-auto px-12 py-10 pb-24 flex flex-col gap-6" data-screen-label="인플루언서 캠페인 생성">
      <header>
        <h1 className="m-0 font-bold text-[27px] leading-[1.2] tracking-[-0.02em] text-[var(--w-fg-strong)]">
          새 인플루언서 캠페인
        </h1>
        <p className="mt-2 mb-0 font-medium text-[14px] leading-[1.55] text-[var(--w-fg-neutral)]">
          캠페인 정보를 입력하면 크리에이터 적합도 랭킹과 파이프라인이 준비돼요.
        </p>
      </header>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={LABEL_CLASS}>캠페인명 *</label>
          <input
            className={INPUT_CLASS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 여름 신제품 런칭 캠페인"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL_CLASS}>목표 *</label>
          <input
            className={INPUT_CLASS}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="예: 뷰티 신제품 인지도"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL_CLASS}>대상 제품</label>
          {products.length > 0 ? (
            <Select
              value={productId}
              onChange={setProductId}
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="제품을 선택해요(선택)"
            />
          ) : (
            <input
              className={INPUT_CLASS}
              value={productText}
              onChange={(e) => setProductText(e.target.value)}
              placeholder="대상 제품명(선택)"
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL_CLASS}>예산</label>
          <input
            className={INPUT_CLASS}
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="원 단위(선택)"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>시작일</label>
            <input className={INPUT_CLASS} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>종료일</label>
            <input className={INPUT_CLASS} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => router.push("/creators/campaigns")}>
          취소
        </Button>
        <Button variant="primary" type="button" onClick={handleSubmit} disabled={!canSave}>
          캠페인 만들기
        </Button>
      </div>
    </div>
  );
}
