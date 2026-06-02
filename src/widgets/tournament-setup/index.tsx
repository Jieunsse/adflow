"use client";

// ADR-032/033 — A/B Tournament 셋업(흐름2 진입). /ab-tests/new 가 browseMode 면 단판 위저드 대신 이 폼을 렌더.
// 2-step 위저드: ①방식 선택(출발 챔피언 출처 카드) → ②세부 설정(제품·톤·목표·총예산·일예산). 시작 후 /ab-tests/[id] 로.
// ADR-054 — 실/데모 모두 auto 완전 무인. 총예산(봉투) 소진 시 winner-handling 으로 사람 결정(돈 방향만).

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import type { IconName } from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { SegControl } from "@shared/ui/SegControl";
import { Select } from "@shared/ui/Select";
import { DEMO_INPUTS } from "@/lib/demo/content";
import { DEMO_AD_IMAGES } from "@/lib/demo/mock-images";
import { startTournament, setManualChallenger } from "@entities/ab-test/tournament/runner";
import { tournamentClient } from "@entities/ab-test/tournament/client";
import { TOUR_OBJECTIVE_OPTIONS, tourMetricSpec } from "@entities/ab-test/tournament/objective-metric";
import type { TourAxis, TourVariant } from "@entities/ab-test/tournament/tournament";
import { MOCK_CAMPAIGN_SUMMARIES } from "@/lib/mock-campaigns";
import { fetchCampaigns } from "@entities/campaign/api";
import { listBrowse, BROWSE_CHANGE_EVENT } from "@entities/campaign/browse/store";
import { browseCampaignToSummary } from "@entities/campaign/browse/summary";
import type { CampaignSummary } from "@/lib/meta-ads";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { useProducts } from "@shared/lib/products";
import { shrinkImageDataUrl } from "@shared/lib/shrink-image";
import ChallengerImageGen from "./ChallengerImageGen";
import {
  buildTournamentRequest,
  buildDemoSetup,
  buildChallengerVariant,
  pickFromPool,
  isFromExisting,
  canAdvanceDesign,
  canStart as canStartFn,
  type Degree,
  type SetupFormState,
} from "./build";

// 실 게재 delivery 옵션 — 셋업이 cron 에 넘길 최소 타겟/링크/CTA. 데모는 미사용.
const COUNTRY_OPTIONS = [
  { value: "KR", label: "대한민국" },
  { value: "US", label: "미국" },
  { value: "JP", label: "일본" },
];
const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "더 알아보기" },
  { value: "SHOP_NOW", label: "지금 구매하기" },
  { value: "SIGN_UP", label: "가입하기" },
  { value: "CONTACT_US", label: "문의하기" },
];

type Tone = "warm" | "pro" | "trendy";

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "warm", label: "감성적" },
  { value: "pro", label: "전문적" },
  { value: "trendy", label: "트렌디" },
];

// ADR-037 V2 — 목표별 결정 지표(awareness=CPM·engagement/leads_call=action 비율)는 objective-metric.ts 가 분기.
// 4종 모두 Phase 1 goalId → 실 launcher·insights 가 그대로 게재·판정한다.
const OBJECTIVE_OPTIONS = TOUR_OBJECTIVE_OPTIONS;

type ChampionMode = "existing" | "ai";
type WizardStep = "method" | "design" | "delivery";
const STEP_LABELS: Record<WizardStep, string> = { method: "방식 선택", design: "A/B 설계", delivery: "게재 조건" };
const STEP_ORDER: WizardStep[] = ["method", "design", "delivery"];

const CHALLENGER_AXIS_OPTIONS: { value: TourAxis; label: string }[] = [
  { value: "headline", label: "헤드라인" },
  { value: "primary_text", label: "카피" },
  { value: "image", label: "이미지" },
];

// 챌린저(B) AI 생성 시 챔피언 대비 변화 폭 — A/B 는 한 요소만 바꾸므로 그 한 요소를 "얼마나" 바꿀지 유저가 고른다. Degree 는 ./build.
const DEGREE_OPTIONS: { value: Degree; label: string }[] = [
  { value: "slight", label: "살짝" },
  { value: "moderate", label: "적당히" },
  { value: "bold", label: "많이" },
];
const DEGREE_HINT: Record<Degree, string> = {
  slight: "기존 챔피언과 결을 거의 유지하면서 표현만 미세하게 다듬어줘.",
  moderate: "핵심 메시지는 지키되 표현과 각도를 눈에 띄게 바꿔줘.",
  bold: "같은 제품이지만 접근 방식 자체를 과감히 다르게 가져가줘.",
};

// 기존 광고 objective(OUTCOME_*) → 셋업 목표 매핑. 미매핑이면 traffic 폴백.
const OBJECTIVE_FROM_META: Record<string, string> = {
  OUTCOME_TRAFFIC: "traffic",
  OUTCOME_AWARENESS: "awareness",
  OUTCOME_ENGAGEMENT: "engagement",
  OUTCOME_LEADS: "leads_call",
};

export default function TournamentSetup({ real = false }: { real?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromCampaignId = searchParams.get("from");
  // 실 게재 봉투 — Meta 라운드 게재에 필요한 타겟/링크/CTA (데모는 미사용).
  const [landingUrl, setLandingUrl] = useState("");
  const [country, setCountry] = useState("KR");
  const [ctaType, setCtaType] = useState("LEARN_MORE");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [productName, setProductName] = useState("수분 가득 비건 크림");
  const [productId, setProductId] = useState("");
  const [description, setDescription] = useState(DEMO_INPUTS.brand);
  const [tone, setTone] = useState<Tone>("warm");
  const [objective, setObjective] = useState("traffic");
  const [totalBudget, setTotalBudget] = useState(600000);
  const [dailyBudget, setDailyBudget] = useState(30000);
  const [step, setStep] = useState<WizardStep>("method");
  const [championMode, setChampionMode] = useState<ChampionMode>("existing");
  const [campaignId, setCampaignId] = useState("");
  // 챌린저(B) 컴포저 — existing 경로에서 챔피언 밑에 라운드1 대진을 구성. 바꿀 요소 하나만 챔피언과 다르게.
  const [chAxis, setChAxis] = useState<TourAxis>("headline");
  const [chHeadline, setChHeadline] = useState("");
  const [chPrimary, setChPrimary] = useState("");
  const [chImage, setChImage] = useState("");
  const [chDegree, setChDegree] = useState<Degree>("moderate");
  const [chGenning, setChGenning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const stepIdx = STEP_ORDER.indexOf(step);
  const goBack = () =>
    step === "delivery" ? setStep("design")
    : step === "design" ? setStep("method")
    : router.push("/ab-tests");
  const pickMode = (m: ChampionMode) => { setChampionMode(m); setStep("design"); };

  // 기존 광고 후보 — 실: 연결 계정의 실 캠페인(fetchCampaigns) / 데모: browse localStorage + 정적 mock.
  const [browseRows, setBrowseRows] = useState<CampaignSummary[]>([]);
  useEffect(() => {
    if (real) return;
    const load = () => setBrowseRows(listBrowse().map(browseCampaignToSummary));
    load();
    window.addEventListener(BROWSE_CHANGE_EVENT, load);
    return () => window.removeEventListener(BROWSE_CHANGE_EVENT, load);
  }, [real]);
  const realCampaignsQ = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => fetchCampaigns("all"),
    enabled: real && championMode === "existing",
    retry: false,
  });
  const campaigns = useMemo(
    () => (real ? (realCampaignsQ.data ?? []) : [...browseRows, ...MOCK_CAMPAIGN_SUMMARIES]),
    [real, realCampaignsQ.data, browseRows],
  );
  const selected = campaigns.find((c) => c.id === campaignId) ?? null;

  // 실 게재는 image 축 A/B 를 지원하지 않는다(launcher 가 헤드라인으로 폴백). 데모만 image 챌린저 노출.
  const axisOptions = real ? CHALLENGER_AXIS_OPTIONS.filter((o) => o.value !== "image") : CHALLENGER_AXIS_OPTIONS;

  // 캠페인 상세 "이 캠페인으로 A/B 테스트 생성" → ?from=<id> 로 진입. 기존 광고 모드로 그 캠페인을 출발 챔피언에 프리셀렉트.
  useEffect(() => {
    if (!fromCampaignId) return;
    setChampionMode("existing");
    setCampaignId(fromCampaignId);
    setStep("design");
  }, [fromCampaignId]);

  // 프리셀렉트 캠페인이 후보 목록에서 해소되면 광고 목표를 그 광고 기준으로 매핑.
  useEffect(() => {
    if (fromCampaignId && selected) setObjective(OBJECTIVE_FROM_META[selected.objective] ?? "traffic");
  }, [fromCampaignId, selected]);

  // 제품 = 활성 브랜드 프로필의 등록 제품에서 선택. 제품이 없으면 자유 입력으로 폴백(브라우즈 데모).
  const { activeId } = useBrandProfileStorage();
  const { products } = useProducts(activeId ?? "");

  function handlePickProduct(id: string) {
    setProductId(id);
    const pr = products.find((x) => x.id === id);
    if (!pr) return;
    setProductName(pr.name);
    if (pr.description) setDescription(pr.description);
  }

  // 첫 로드 시 제품이 있으면 첫 제품을 자동 선택.
  useEffect(() => {
    if (products.length && !productId) handlePickProduct(products[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  function handlePickCampaign(id: string) {
    setCampaignId(id);
    const c = campaigns.find((x) => x.id === id);
    if (c) setObjective(OBJECTIVE_FROM_META[c.objective] ?? "traffic");
  }

  // 출발 챔피언 = 고른 광고. 이미지는 광고 자체 것 우선, 없으면 mock 풀 첫 장.
  const champVariant: TourVariant | null = selected
    ? { headline: selected.headline, primaryText: selected.primaryText ?? "", imageUrl: selected.imageUrl || (real ? "" : DEMO_AD_IMAGES[0]) }
    : null;

  // 빌더가 읽는 순수 입력 — 페이로드/게이트 직조는 ./build 로.
  const form: SetupFormState = {
    championMode,
    selected: selected ? { ctr: selected.ctr, name: selected.name } : null,
    champVariant,
    productId,
    productName,
    description,
    tone,
    objective,
    totalBudget,
    dailyBudget,
    chAxis,
    challenger: { headline: chHeadline, primary: chPrimary, image: chImage },
    landingUrl,
    ctaType,
    country,
    ageMin,
    ageMax,
  };

  // 우측 대진 미리보기용 챌린저(B) — 바꾼 축만 다르게, 나머지는 챔피언 그대로. 비면 챔피언 값으로 폴백 표시.
  const challengerPreview: TourVariant | null = champVariant
    ? {
        headline: chAxis === "headline" ? chHeadline.trim() || champVariant.headline : champVariant.headline,
        primaryText: chAxis === "primary_text" ? chPrimary.trim() || champVariant.primaryText : champVariant.primaryText,
        imageUrl: chAxis === "image" ? chImage || champVariant.imageUrl : champVariant.imageUrl,
      }
    : null;

  const toneLabel = TONE_OPTIONS.find((t) => t.value === tone)?.label ?? "";
  const objectiveLabel = OBJECTIVE_OPTIONS.find((o) => o.value === objective)?.label ?? "";
  const axisLabel = CHALLENGER_AXIS_OPTIONS.find((a) => a.value === chAxis)?.label ?? "";

  // 챔피언 카피·문구·이미지로 헤드라인/카피 챌린저를 mock 생성 (browse 에선 generate-creative 가 정적 응답).
  async function generateChallenger() {
    if (!champVariant || chGenning) return;
    setChGenning(true);
    try {
      const res = await fetch("/api/generate-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: description.trim() || productName.trim(), target: productName.trim(), tone, outcome: objective, hint: DEGREE_HINT[chDegree] }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const pool: string[] = chAxis === "headline" ? data.headlines : data.primaryTexts;
      const cur = chAxis === "headline" ? champVariant.headline : champVariant.primaryText;
      // 변화 정도 → 풀에서 위치 선택. 실 경로는 위 hint 로 프롬프트가 반영.
      const pick = pickFromPool(pool, cur, chDegree);
      if (chAxis === "headline") setChHeadline(pick); else setChPrimary(pick);
    } catch {
      setError("챌린저 생성에 실패했어요. 직접 입력하거나 다시 시도해주세요.");
    } finally {
      setChGenning(false);
    }
  }

  const designReady = canAdvanceDesign(form);
  const startReady = canStartFn(form, real);

  async function handleStart() {
    if (!startReady || starting) return;
    setStarting(true);
    setError("");
    try {
      const fromExisting = isFromExisting(form);

      // 출발 챔피언 기준선 — 목표별 결정 지표 단위 (rate=실제 광고 CTR / awareness=실제 광고 CPM, 없으면 spec 기본값).
      const seedSpec = tourMetricSpec(objective);
      const startingCtr = fromExisting
        ? seedSpec.kind === "cpm"
          ? (selected!.impressions > 0 ? (selected!.spend / selected!.impressions) * 1000 : seedSpec.seedDefault)
          : selected!.ctr
        : seedSpec.seedDefault;

      // 실 유저 — POST /api/tournaments(Supabase + Meta delivery 봉투). 기존 광고 출발이면 라운드1 챌린저를 set-challenger 로 시드.
      if (real) {
        const res = await fetch("/api/tournaments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // 페이로드는 빌더로, startingCtr 만 목표별 seedSpec 값(awareness=CPM)으로 덮어쓴다.
          body: JSON.stringify({ ...buildTournamentRequest(form, activeId ?? ""), startingCtr }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "토너먼트 생성에 실패했어요.");
        const id = data.id as string;
        if (fromExisting) {
          await tournamentClient(false).setChallenger(id, buildChallengerVariant(chAxis, champVariant!, form.challenger));
        }
        router.push(`/ab-tests/${id}`);
        return;
      }

      // 둘러보기는 localStorage 저장(데모) — 큰 생성 이미지(2MB PNG)를 그대로 복사하면 용량을 넘겨
      // 저장이 조용히 실패한다. 챔피언/챌린저 이미지를 저장 전 축소해 발자국을 줄인다.
      const demoSetup = buildDemoSetup(form);
      const startingChampion = demoSetup.startingChampion
        ? { ...demoSetup.startingChampion, imageUrl: await shrinkImageDataUrl(demoSetup.startingChampion.imageUrl ?? "") }
        : undefined;
      const id = await startTournament({ ...demoSetup, startingCtr, startingChampion });
      // existing 경로: 셋업에서 구성한 라운드1 챌린저(B)를 pendingChallenger 로 시드 → 상세가 챌린저 검토 비트로 오픈.
      if (fromExisting) {
        const challenger: TourVariant =
          chAxis === "image"
            ? { ...startingChampion!, imageUrl: await shrinkImageDataUrl(form.challenger.image) }
            : buildChallengerVariant(chAxis, startingChampion!, form.challenger);
        setManualChallenger(id, challenger);
      }
      router.push(`/ab-tests/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "출발 챔피언 생성에 실패했어요. 잠시 후 다시 시도해주세요.");
      setStarting(false);
    }
  }

  const shellWidth = step === "method" ? "max-w-[760px]" : "max-w-[1140px]";
  // STEP 1(방식 선택)은 콘텐츠가 짧아 세로 중앙 정렬로 균형을 맞춘다. STEP 2 폼은 길어 상단 정렬 유지.
  const shellVertical = step === "method" ? "min-h-[calc(100vh-2rem)] justify-center" : "";

  return (
    <div className={`px-12 py-9 pb-16 ${shellWidth} w-full mx-auto flex flex-col gap-7 ${shellVertical}`} data-screen-label="A/B 토너먼트 셋업">
      <button
        type="button"
        onClick={goBack}
        className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)] hover:underline self-start"
      >
        <Icon name="arrow-left" size={13} /> {step === "method" ? "A/B 테스트" : STEP_LABELS[STEP_ORDER[stepIdx - 1]]}
      </button>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name="chart" size={20} />
          </div>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">A/B 토너먼트</h1>
        </div>
        <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
          챔피언-챌린저 체인 — 라운드마다 한 요소를 바꿔 더 나은 광고로 진화시켜요. 우세 안이 다음 라운드 챔피언이 돼요.
        </p>
      </div>

      <StepIndicator stepIdx={stepIdx} />

      {step === "method" && <MethodStep onPick={pickMode} />}

      {step === "design" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(340px,380px)] gap-7 items-start">
          {/* ── 좌: A/B 설계 — 출발 챔피언 + 바꿀 한 요소 ── */}
          <div className="flex flex-col gap-7 min-w-0">
            <SectionCard title="출발 챔피언" hint="1라운드의 A — 챌린저가 이 광고 위로 진화해요">
              {championMode === "existing" ? (
                <div className="flex flex-col gap-3">
                  <Select
                    value={campaignId}
                    onChange={handlePickCampaign}
                    options={[
                      { value: "", label: "기존 광고를 선택해주세요" },
                      ...campaigns.map((c) => ({ value: c.id, label: c.headline || c.name })),
                    ]}
                  />
                  {selected && champVariant && (
                    <div className="p-4 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] flex gap-3.5">
                      <img src={champVariant.imageUrl} alt="출발 챔피언 이미지" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, flex: "0 0 auto", border: "1px solid var(--w-line-normal)" }} />
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">출발 챔피언</span>
                          <span className="font-bold text-[12px] leading-none px-2 py-1 rounded-full bg-[var(--w-bg-alternative)] text-[var(--w-fg-strong)]">실제 CTR {selected.ctr}%</span>
                        </div>
                        <div className="font-bold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">{selected.headline}</div>
                        {selected.primaryText && (
                          <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] m-0">{selected.primaryText}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-2.5 px-3.5 rounded-lg flex items-start gap-2 bg-[var(--w-bg-alternative)]">
                  <Icon name="sparkles" size={14} style={{ color: "var(--w-accent-violet)", flex: "0 0 auto", marginTop: 1 }} />
                  <span className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
                    AI 가 브랜드·제품 설명을 바탕으로 출발 광고를 제안해요. 다음 화면에서 검토 후 확정합니다.
                  </span>
                </div>
              )}
            </SectionCard>

            {championMode === "existing" && selected && champVariant && (
              <SectionCard title="챌린저 (B)" hint="같은 제품, 한 요소만 바꿔 비교해요">
                <SegControl options={axisOptions} value={chAxis} onChange={(v) => setChAxis(v as TourAxis)} />

                <div className="mt-3">
                  {chAxis === "image" ? (
                    <ChallengerImageGen
                      headline={champVariant.headline}
                      primaryText={champVariant.primaryText}
                      tone={tone}
                      outcome={objective}
                      productName={productName}
                      productDescription={description}
                      referenceUrl={products.find((p) => p.id === productId)?.imageUrl || champVariant.imageUrl}
                      value={chImage}
                      onChange={setChImage}
                    />
                  ) : chAxis === "headline" ? (
                    <input
                      type="text"
                      value={chHeadline}
                      onChange={(e) => setChHeadline(e.target.value)}
                      placeholder="비교할 헤드라인을 입력하거나 AI 로 생성하세요"
                      className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-accent-violet)] focus:shadow-[0_0_0_4px_rgba(124,58,237,0.14)] placeholder:text-[var(--w-fg-alternative)] placeholder:font-medium"
                    />
                  ) : (
                    <textarea
                      value={chPrimary}
                      onChange={(e) => setChPrimary(e.target.value)}
                      rows={3}
                      placeholder="비교할 광고 카피를 입력하거나 AI 로 생성하세요"
                      className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-accent-violet)] focus:shadow-[0_0_0_4px_rgba(124,58,237,0.14)] placeholder:text-[var(--w-fg-alternative)] resize-none"
                    />
                  )}

                  {chAxis !== "image" && (
                    <div className="mt-3.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-strong)]">변화 정도</span>
                        <span className="font-medium text-[11.5px] leading-none text-[var(--w-fg-alternative)]">AI 가 챔피언을 얼마나 바꿀지</span>
                      </div>
                      <SegControl options={DEGREE_OPTIONS} value={chDegree} onChange={(v) => setChDegree(v as Degree)} />
                      <Button
                        variant="primary"
                        size="sm"
                        type="button"
                        disabled={chGenning}
                        onClick={generateChallenger}
                        className="self-start mt-1"
                      >
                        {chGenning ? "생성 중…" : "AI 로 B안 생성"}
                      </Button>
                    </div>
                  )}
                </div>

                <p className="mt-3 font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)] m-0">
                  나머지 요소는 챔피언과 동일하게 유지돼요. 게재 전 상세 화면에서 다시 검토·교체할 수 있어요.
                </p>
              </SectionCard>
            )}

            {/* AI 모드 — 출발 챔피언이 아직 없으니 생성 재료가 필요. existing 모드는 챔피언이 이미 값을 가져 숨긴다. */}
            {championMode === "ai" && (
              <SectionCard title="출발 챔피언 재료" hint="AI 가 1라운드 챔피언을 만들 제품·설명·톤">
                <Field label="제품" hint="브랜드 프로필에 등록된 제품에서 선택해요">
                  {products.length > 0 ? (
                    <Select
                      value={productId}
                      onChange={handlePickProduct}
                      options={[
                        { value: "", label: "제품을 선택해주세요" },
                        ...products.map((pr) => ({ value: pr.id, label: pr.name })),
                      ]}
                    />
                  ) : (
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="예) 수분 가득 비건 크림"
                      className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]"
                    />
                  )}
                </Field>

                <Field label="브랜드·제품 설명" hint="AI 가 챔피언 카피를 만들 때 주입하는 컨텍스트">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="브랜드 톤·핵심 가치·타겟 고객을 한두 문장으로"
                    className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.55] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)] resize-none"
                  />
                </Field>

                <Field label="카피 톤">
                  <SegControl options={TONE_OPTIONS} value={tone} onChange={(v) => setTone(v as Tone)} />
                </Field>
              </SectionCard>
            )}
          </div>

          {/* ── 우: 1라운드 대진 미리보기 + 다음 ── */}
          <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
            <MatchupCard
              championMode={championMode}
              champion={champVariant}
              challenger={challengerPreview}
              chAxis={chAxis}
              axisLabel={axisLabel}
              ctr={selected?.ctr ?? null}
            />

            <div className="py-2.5 px-3.5 rounded-lg flex items-start gap-2" style={{ background: "var(--w-primary-soft)", border: "1px solid var(--w-primary-weak)" }}>
              <Icon name="info" size={14} style={{ color: "var(--w-primary-normal)", flex: "0 0 auto", marginTop: 1 }} />
              <span className="font-medium text-[12px] leading-[1.5] text-[var(--w-primary-press)]">
                A/B 는 한 요소만 다르게, 나머지는 챔피언과 동일하게 게재해요. 게재 조건은 다음 단계에서 정합니다.
              </span>
            </div>

            <Button variant="primary" type="button" disabled={!designReady} onClick={() => setStep("delivery")} className="w-full">
              다음 — 게재 조건 <Icon name="arrow-right" size={15} />
            </Button>
          </aside>
        </div>
      )}

      {step === "delivery" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(340px,380px)] gap-7 items-start">
          {/* ── 좌: 게재 조건 — A/B 변수와 별개인 토너먼트 전역 설정 ── */}
          <div className="flex flex-col gap-7 min-w-0">
            <SectionCard title="게재 조건" hint="토너먼트 전체에 적용돼요 — A/B 변수와 별개">
              <Field label="광고 목표">
                <Select value={objective} onChange={setObjective} options={OBJECTIVE_OPTIONS} />
              </Field>

              <div className="grid grid-cols-2 gap-5">
                <Field label="총예산" hint="이 예산을 다 쓰면 멈추고 위너 처리를 물어봐요">
                  <BudgetInput value={totalBudget} onChange={setTotalBudget} />
                </Field>
                <Field label="일 예산">
                  <BudgetInput value={dailyBudget} onChange={setDailyBudget} />
                </Field>
              </div>
            </SectionCard>

            {/* 실 게재 봉투 — cron 이 라운드를 실제 Meta 광고로 게재하는 데 필요한 타겟/링크/CTA. */}
            {real && (
              <SectionCard title="게재 설정" hint="실제 Meta 광고로 라운드를 게재해요 — 랜딩·타겟·CTA">
                <Field label="랜딩 URL" hint="광고 클릭 시 이동할 페이지">
                  <input
                    type="url"
                    value={landingUrl}
                    onChange={(e) => setLandingUrl(e.target.value)}
                    placeholder="https://example.com/product"
                    className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-5">
                  <Field label="타겟 지역">
                    <Select value={country} onChange={setCountry} options={COUNTRY_OPTIONS} />
                  </Field>
                  <Field label="행동 유도 버튼">
                    <Select value={ctaType} onChange={setCtaType} options={CTA_OPTIONS} />
                  </Field>
                </div>
                <Field label="타겟 연령">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="number"
                      min={13}
                      max={65}
                      value={ageMin}
                      onChange={(e) => setAgeMin(Number(e.target.value) || 18)}
                      className="w-20 bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3 py-3 font-semibold text-[14px] text-center text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)]"
                    />
                    <span className="font-medium text-[13px] text-[var(--w-fg-alternative)]">~</span>
                    <input
                      type="number"
                      min={13}
                      max={65}
                      value={ageMax}
                      onChange={(e) => setAgeMax(Number(e.target.value) || 65)}
                      className="w-20 bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3 py-3 font-semibold text-[14px] text-center text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)]"
                    />
                    <span className="font-medium text-[13px] text-[var(--w-fg-alternative)]">세</span>
                  </div>
                </Field>
              </SectionCard>
            )}
          </div>

          {/* ── 우: 진화·조건 미리보기 + 시작 ── */}
          <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
            <EvolutionChain rounds={Math.max(2, Math.min(6, Math.round(totalBudget / Math.max(1, dailyBudget * 7))))} />
            <ConditionSummary toneLabel={championMode === "ai" ? toneLabel : ""} objectiveLabel={objectiveLabel} totalBudget={totalBudget} dailyBudget={dailyBudget} />

            <div className="py-2.5 px-3.5 rounded-lg flex items-start gap-2" style={{ background: "var(--w-primary-soft)", border: "1px solid var(--w-primary-weak)" }}>
              <Icon name="info" size={14} style={{ color: "var(--w-primary-normal)", flex: "0 0 auto", marginTop: 1 }} />
              <span className="font-medium text-[12px] leading-[1.5] text-[var(--w-primary-press)]">
                시작하면 출발 챔피언으로 토너먼트를 열어요. 라운드마다 AI 챌린저를 붙여 진화시킵니다.
              </span>
            </div>

            {error && <p className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-status-negative)] m-0">{error}</p>}

            <Button variant="primary" type="button" disabled={!startReady || starting} onClick={handleStart} className="w-full">
              {starting
                ? <><Icon name="spinner" size={15} spin /> {championMode === "existing" ? "시작 중…" : "출발 챔피언 생성 중…"}</>
                : <><Icon name="sparkles" size={15} /> 토너먼트 시작</>}
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ─── STEP 1: 방식 선택 ─────────────────────────────────── */

function MethodStep({ onPick }: { onPick: (m: ChampionMode) => void }) {
  return (
    <div>
      <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)] mb-3.5">
        출발 챔피언을 어떻게 정할까요?
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MethodCard
          icon="folder"
          title="기존 광고로 시작"
          desc="이미 진행중인 광고를 챔피언으로 지정해요. 새로운 챌린저를 생성해서 토너먼트를 시작해요."
          tag="추천"
          tagColor="var(--w-primary-normal)"
          onClick={() => onPick("existing")}
        />
        <MethodCard
          icon="sparkles"
          title="AI 가 생성"
          desc="출발 광고가 아직 없을 때. AI가 제안한 광고를 다음 화면에서 검토 후 토너먼트를 시작해요."
          tag="새로 시작"
          tagColor="var(--w-accent-violet)"
          onClick={() => onPick("ai")}
        />
      </div>

      <FlowStrip />
    </div>
  );
}

// 카드 결정을 가리지 않는 선에서 하단을 채우는 가벼운 진행 흐름 안내. 도메인 동작 원리를 3단계로.
function FlowStrip() {
  const steps: { icon: IconName; title: string; desc: string }[] = [
    { icon: "edit", title: "챌린저 붙이기", desc: "한 요소만 바꾼 B안을 챔피언과 나란히 게재해요." },
    { icon: "chart", title: "게재·측정", desc: "트래픽·CTR 을 실측해 어느 쪽이 우세한지 판정해요." },
    { icon: "target", title: "우세안 승격", desc: "이긴 안이 다음 라운드 챔피언이 돼 다시 진화해요." },
  ];
  return (
    <div className="mt-9">
      <div className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-neutral)] mb-3.5 flex items-center gap-2">
        <span className="h-px flex-1 bg-[var(--w-line-normal)]" />
        이렇게 진행돼요
        <span className="h-px flex-1 bg-[var(--w-line-normal)]" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span
                className="font-bold text-[11px] leading-none grid place-items-center w-6 h-6 rounded-lg bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]"
                style={{ flex: "0 0 auto" }}
              >
                {i + 1}
              </span>
              <Icon name={s.icon} size={15} style={{ color: "var(--w-fg-alternative)", flex: "0 0 auto" }} />
              <div className="font-bold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">{s.title}</div>
            </div>
            <p className="font-medium text-[12px] leading-[1.55] text-[var(--w-fg-neutral)] m-0">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MethodCard({ icon, title, desc, tag, tagColor, onClick }: {
  icon: IconName; title: string; desc: string; tag: string; tagColor: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--w-bg-elevated)] rounded-2xl text-left cursor-pointer transition-[border-color,transform,box-shadow] duration-[160ms] flex flex-col gap-3.5 p-6 pr-5 hover:border-[var(--w-primary-normal)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)]"
      style={{ border: "1.5px solid var(--w-line-alternative)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name={icon} size={22} />
          </div>
          <div className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">{title}</div>
        </div>
        <span className="font-bold text-[11.5px] leading-none" style={{ color: tagColor, background: `color-mix(in srgb, ${tagColor} 12%, transparent)`, padding: "4px 9px", borderRadius: 999, border: `1px solid color-mix(in srgb, ${tagColor} 30%, transparent)`, flex: "0 0 auto" }}>
          {tag}
        </span>
      </div>
      <p className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] m-0">{desc}</p>
      <div className="flex items-center gap-1 font-semibold text-[13px] leading-none text-[var(--w-primary-normal)] mt-auto">
        선택하기
      </div>
    </button>
  );
}

/* ─── 우측 미리보기 ─────────────────────────────────── */

// 1라운드 대진 — A(챔피언) vs B(챌린저). existing 만 실제 카드, ai 는 안내 플레이스홀더.
function MatchupCard({ championMode, champion, challenger, chAxis, axisLabel, ctr }: {
  championMode: ChampionMode; champion: TourVariant | null; challenger: TourVariant | null; chAxis: TourAxis; axisLabel: string; ctr: number | null;
}) {
  return (
    <div className="rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] p-4">
      <div className="font-bold text-[13px] leading-none text-[var(--w-fg-strong)] mb-3.5">1라운드 대진</div>

      {championMode === "ai" || !champion || !challenger ? (
        <div className="py-6 px-3 rounded-xl bg-[var(--w-bg-alternative)] flex flex-col items-center gap-2 text-center">
          <Icon name="sparkles" size={20} style={{ color: "var(--w-accent-violet)" }} />
          <span className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
            {championMode === "ai"
              ? "AI 가 출발 챔피언을 생성하면 대진이 채워져요."
              : "기존 광고를 선택하면 1라운드 대진이 여기 나타나요."}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-0">
          <SideCard tag="A · 챔피언" tagColor="var(--w-primary-normal)" variant={champion} chAxis={chAxis} highlight={false} badge={ctr != null ? `CTR ${ctr}%` : undefined} />

          <div className="flex items-center gap-2 my-2">
            <div className="h-px flex-1 bg-[var(--w-line-normal)]" />
            <span className="font-bold text-[10.5px] leading-none px-2 py-1 rounded-full bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)]">VS</span>
            <span className="font-semibold text-[10.5px] leading-none px-2 py-1 rounded-full" style={{ color: "var(--w-accent-violet)", background: "color-mix(in srgb, var(--w-accent-violet) 12%, transparent)" }}>{axisLabel} 변경</span>
            <div className="h-px flex-1 bg-[var(--w-line-normal)]" />
          </div>

          <SideCard tag="B · 챌린저" tagColor="var(--w-accent-violet)" variant={challenger} chAxis={chAxis} highlight />
        </div>
      )}
    </div>
  );
}

// 대진 한쪽 카드. 바뀐 축은 챔피언과 다른 값 강조(B), 나머지는 동일.
function SideCard({ tag, tagColor, variant, chAxis, highlight, badge }: {
  tag: string; tagColor: string; variant: TourVariant; chAxis: TourAxis; highlight: boolean; badge?: string;
}) {
  return (
    <div
      className="rounded-xl p-2.5 flex gap-2.5"
      style={{
        border: highlight ? "1.5px solid var(--w-accent-violet)" : "1px solid var(--w-line-normal)",
        background: highlight ? "color-mix(in srgb, var(--w-accent-violet) 5%, var(--w-bg-elevated))" : "var(--w-bg-elevated)",
      }}
    >
      <div className="relative" style={{ flex: "0 0 auto" }}>
        <img src={variant.imageUrl} alt={tag} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 9, border: "1px solid var(--w-line-normal)" }} />
        {chAxis === "image" && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full" style={{ background: highlight ? "var(--w-accent-violet)" : "var(--w-primary-normal)", border: "2px solid var(--w-bg-elevated)" }} />}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-bold text-[10.5px] leading-none" style={{ color: tagColor }}>{tag}</span>
        <div className="font-semibold text-[12.5px] leading-[1.35] text-[var(--w-fg-strong)] line-clamp-2">{variant.headline}</div>
        {badge && <span className="font-bold text-[10px] leading-none px-1.5 py-0.5 rounded bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] self-start">{badge}</span>}
      </div>
    </div>
  );
}

// 진화 흐름 — 총예산으로 추정한 라운드 수만큼 챔피언↔챌린저 사슬을 시각화(예상치).
function EvolutionChain({ rounds }: { rounds: number }) {
  return (
    <div className="rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] p-4">
      <div className="font-bold text-[13px] leading-none text-[var(--w-fg-strong)] mb-3">진화 흐름 <span className="font-medium text-[11px] text-[var(--w-fg-alternative)]">예산 기준 약 {rounds}라운드</span></div>
      <div className="flex flex-col gap-0">
        {Array.from({ length: rounds }).map((_, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[11px] leading-none grid place-items-center w-6 h-6 rounded-lg bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]" style={{ flex: "0 0 auto" }}>R{i + 1}</span>
              <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">
                {i === 0 ? "출발 챔피언 vs 첫 챌린저" : "이전 우세 안 vs 새 챌린저"}
              </span>
            </div>
            {i < rounds - 1 && (
              <div className="flex items-center gap-1.5 ml-3 my-1 font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">
                <span className="leading-none">↓</span> 우세 안이 다음 챔피언
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConditionSummary({ toneLabel, objectiveLabel, totalBudget, dailyBudget }: {
  toneLabel: string; objectiveLabel: string; totalBudget: number; dailyBudget: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] p-4 flex flex-col gap-2">
      <div className="font-bold text-[13px] leading-none text-[var(--w-fg-strong)] mb-1">조건 요약</div>
      {toneLabel && <SummaryRow label="카피 톤" value={toneLabel} />}
      <SummaryRow label="광고 목표" value={objectiveLabel} />
      <SummaryRow label="총예산" value={`${totalBudget.toLocaleString("ko-KR")}원`} />
      <SummaryRow label="일 예산" value={`${dailyBudget.toLocaleString("ko-KR")}원`} />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium text-[12.5px] leading-none text-[var(--w-fg-alternative)]">{label}</span>
      <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-strong)] text-right">{value}</span>
    </div>
  );
}

function StepIndicator({ stepIdx }: { stepIdx: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEP_ORDER.map((s, i) => {
        const done = i < stepIdx;
        const active = i === stepIdx;
        return (
          <div key={s} className="flex items-center gap-0">
            <div className="flex items-center gap-2">
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                background: done ? "var(--w-primary-normal)" : active ? "var(--w-primary-soft)" : "var(--w-bg-alternative)",
                border: active ? "2px solid var(--w-primary-normal)" : done ? "none" : "2px solid var(--w-line-normal)",
                color: done ? "#fff" : active ? "var(--w-primary-press)" : "var(--w-fg-alternative)",
                transition: "all 200ms",
              }} className="font-bold text-[12px] leading-none">
                {done ? <Icon name="check" size={13} /> : i + 1}
              </div>
              <span className="font-semibold text-[13px] leading-none" style={{
                color: active ? "var(--w-fg-strong)" : done ? "var(--w-primary-normal)" : "var(--w-fg-alternative)",
              }}>
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div style={{ width: 32, height: 2, background: done ? "var(--w-primary-normal)" : "var(--w-line-normal)", margin: "0 8px", transition: "background 200ms" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] p-6 flex flex-col gap-5">
      <div>
        <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">{title}</div>
        {hint && <p className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-fg-neutral)] mt-1 m-0">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-strong)] mb-2">
        {label}
        {hint && <span className="font-medium text-[12px] text-[var(--w-fg-alternative)] ml-2">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// 원 단위 예산 입력 — 총예산·일예산 공용. 천 단위 콤마 표시, 숫자만 파싱.
function BudgetInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={value ? value.toLocaleString("ko-KR") : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
        className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl pl-3.5 pr-9 py-3 font-semibold text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
      />
      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-medium text-[13px] text-[var(--w-fg-alternative)]">원</span>
    </div>
  );
}
