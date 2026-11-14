"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { Select } from "@shared/ui/Select";
import Icon from "@shared/ui/Icon";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { useProducts } from "@shared/lib/products";
import { useInfluencerCampaigns } from "@entities/influencer-campaign/store";
import type { InfluencerCampaign } from "@entities/influencer-campaign/model";

const INPUT_CLASS =
  "w-full border border-[var(--w-line-normal)] rounded-[var(--w-radius-8)] px-3.5 py-[11px] bg-[var(--w-bg-normal)] font-normal text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-neutral)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)]";

const STEPS = [
  {
    label: "캠페인 방향",
    title: "어떤 협업을 시작할까요?",
    desc: "캠페인의 이름과 목표를 정하면 크리에이터 추천과 제안 초안에 반영돼요.",
    nextLabel: "다음 · 소개할 제품",
  },
  {
    label: "소개할 제품",
    title: "크리에이터가 무엇을 소개하나요?",
    desc: "제품을 연결해두면 제안 메시지와 콘텐츠 가이드에 같은 정보를 사용할 수 있어요.",
    nextLabel: "다음 · 운영 범위",
  },
  {
    label: "운영 범위",
    title: "예산과 일정을 정리해요",
    desc: "지금 정하지 않아도 돼요. 캠페인을 만든 뒤에도 파이프라인을 바로 시작할 수 있어요.",
    nextLabel: "캠페인 만들기",
  },
] as const;

function makeId(): string {
  return `infl_campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function NewInfluencerCampaignPage() {
  const router = useRouter();
  const { activeId } = useBrandProfileStorage();
  const brandProfileId = activeId ?? "";
  const { products } = useProducts(brandProfileId);
  const { add } = useInfluencerCampaigns();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [productId, setProductId] = useState("");
  const [productText, setProductText] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const isLastStep = step === STEPS.length - 1;
  const canCreate = name.trim().length > 0 && goal.trim().length > 0;
  const canAdvance = step !== 0 || canCreate;
  const currentStep = STEPS[step];
  const productName = products.find((product) => product.id === productId)?.name || productText.trim();

  const handleCreate = () => {
    if (!canCreate) return;
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

  const advance = () => {
    if (!canAdvance) return;
    if (isLastStep) handleCreate();
    else setStep((current) => current + 1);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-[var(--w-bg-elevated)]" data-screen-label="인플루언서 캠페인 생성">
      <div className="flex h-16 items-center gap-4 border-b border-[var(--w-line-alternative)] px-6 sm:px-10">
        <span className="w-overline">협업 캠페인 만들기</span>
        <span className="flex-1" />
        <span className="font-bold text-[12px] tracking-[0.04em] text-[var(--w-fg-neutral)] [font-variant-numeric:tabular-nums]">
          {String(step + 1).padStart(2, "0")}
          <span className="text-[var(--w-fg-alternative)]"> / 03</span>
        </span>
        <div className="h-1 w-24 overflow-hidden rounded-[var(--w-radius-pill)] bg-[var(--w-bg-neutral)] sm:w-36">
          <div
            className="h-full rounded-[var(--w-radius-pill)] bg-[var(--w-primary-normal)] transition-[width] duration-200"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-6 py-10 sm:px-16 sm:py-14">
        <main className="mx-auto w-full max-w-[840px]">
          <div className="mb-8">
            <div className="w-overline mb-2">STEP {String(step + 1).padStart(2, "0")} · {currentStep.label}</div>
            <h1 className="w-h1 m-0">{currentStep.title}</h1>
            <p className="w-caption m-0 mt-2">{currentStep.desc}</p>
          </div>

          {step === 0 && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="campaign-name" className="w-label">캠페인명</label>
                <input
                  id="campaign-name"
                  className={INPUT_CLASS}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="예: 여름 신제품 런칭 캠페인"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="campaign-goal" className="w-label">이번 협업으로 이루고 싶은 목표</label>
                <textarea
                  id="campaign-goal"
                  className={`${INPUT_CLASS} min-h-[104px] resize-y leading-[1.6]`}
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="예: 뷰티 신제품 인지도를 높이고, 실제 사용 후기를 쌓고 싶어요"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3">
              <label className="w-label" htmlFor={products.length > 0 ? undefined : "campaign-product"}>
                대상 제품 <span className="font-normal text-[var(--w-fg-neutral)]">(선택)</span>
              </label>
              {products.length > 0 ? (
                <Select
                  value={productId}
                  onChange={setProductId}
                  options={products.map((product) => ({ value: product.id, label: product.name }))}
                  placeholder="제품을 선택해요"
                />
              ) : (
                <input
                  id="campaign-product"
                  className={INPUT_CLASS}
                  value={productText}
                  onChange={(event) => setProductText(event.target.value)}
                  placeholder="예: 수분크림"
                  autoFocus
                />
              )}
              <p className="w-caption m-0">제품을 아직 등록하지 않았다면 이름만 적어도 돼요.</p>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="campaign-budget" className="w-label">총 예산 <span className="font-normal text-[var(--w-fg-neutral)]">(선택)</span></label>
                  <input
                    id="campaign-budget"
                    className={INPUT_CLASS}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    placeholder="원 단위"
                    autoFocus
                  />
                </div>
              </div>
              <div className="border-t border-[var(--w-line-alternative)] pt-6">
                <label className="w-label mb-3 block">진행 일정 <span className="font-normal text-[var(--w-fg-neutral)]">(선택)</span></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="campaign-start" className="w-caption">시작일</label>
                    <input
                      id="campaign-start"
                      className={INPUT_CLASS}
                      type="date"
                      value={startDate}
                      max={endDate || undefined}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="campaign-end" className="w-caption">종료일</label>
                    <input
                      id="campaign-end"
                      className={INPUT_CLASS}
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-[var(--w-radius-12)] bg-[var(--w-bg-neutral)] px-5 py-4">
                <p className="w-overline m-0 mb-2">캠페인 요약</p>
                <p className="m-0 font-semibold text-[15px] leading-[1.5] text-[var(--w-fg-strong)]">{name}</p>
                <p className="w-caption m-0 mt-1">{goal}</p>
                {productName && <p className="w-caption m-0 mt-2">소개할 제품 · {productName}</p>}
              </div>
            </div>
          )}

          <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--w-line-alternative)] pt-6">
            {step > 0 ? (
              <Button variant="secondary" size="lg" type="button" onClick={() => setStep((current) => current - 1)}>
                <Icon name="arrow-left" size={15} /> 이전
              </Button>
            ) : (
              <Button variant="ghost" size="lg" type="button" onClick={() => router.push("/creators/campaigns")}>
                목록으로
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              type="button"
              onClick={advance}
              disabled={!canAdvance}
              title={!canAdvance ? "캠페인명과 목표를 입력해주세요" : undefined}
            >
              {isLastStep ? <Icon name="megaphone" size={15} /> : null}
              {currentStep.nextLabel}
              {!isLastStep ? <Icon name="arrow-right" size={15} /> : null}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
