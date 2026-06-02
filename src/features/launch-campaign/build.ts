// Launch Campaign feature 의 pure 빌더들 — .document/CONTEXT.md §Launch Campaign.
// LaunchStep widget 의 runLaunch 가 들고 있던 5 책임(이미지 검증·페이로드 매핑·상태 결정·알림 본문·LaunchedCampaign 직조)을 분리.
// widget = "언제" / 여기 = "어떻게". 단위 테스트 surface = 본 파일의 인터페이스.

import type { CreativeState } from "@entities/creative/model";
import type { LaunchState, LaunchedCampaign, LaunchParams, LaunchResponse } from "@entities/campaign/model";
import { OBJECTIVES_PHASE1, type ObjectivePhase1Id } from "@entities/creative/options";
import { uiToGenders } from "@shared/lib/meta/targeting";
import type { BrowseCampaignInput } from "@entities/campaign/browse/seed";
import type { MetaObjectiveParam } from "@/lib/meta-ads";

// PRD §13.10 — single-select. outcome 이 Phase 1 goal 이면 그 id 를 그대로 사용.
// Phase 2 (leads/sales/app_promotion) outcome 이면 goalId 미설정 → 서버가 objective 폴백.
const PHASE1_GOAL_IDS = new Set<string>(OBJECTIVES_PHASE1.map((g) => g.id));
function primaryGoalId(outcome: string | null): ObjectivePhase1Id | undefined {
  return outcome && PHASE1_GOAL_IDS.has(outcome) ? (outcome as ObjectivePhase1Id) : undefined;
}

// Meta 최소 광고 이미지 요건.
const MIN_IMAGE_WIDTH = 600;
const MIN_IMAGE_HEIGHT = 314;

export type ImageValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

// 광고 이미지가 Meta 최소 요건을 만족하는지 검사. 크기 확인 자체에 실패하면 통과 처리(원본 흐름 유지 — 검증은 best-effort).
export async function validateAdImage(dataUrl: string): Promise<ImageValidationResult> {
  let dims: { width: number; height: number };
  try {
    dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = dataUrl;
    });
  } catch {
    return { ok: true };
  }
  if (dims.width < MIN_IMAGE_WIDTH || dims.height < MIN_IMAGE_HEIGHT) {
    return {
      ok: false,
      reason: `이미지 크기가 너무 작아요 (${dims.width}×${dims.height}px). Meta 최소 요건은 ${MIN_IMAGE_WIDTH}×${MIN_IMAGE_HEIGHT}px예요. 더 큰 이미지로 교체해주세요.`,
    };
  }
  return { ok: true };
}

// CreativeState + LaunchState → /api/campaign POST 페이로드. 모드·목표 분기가 한 자리에.
export function buildLaunchParams(
  creative: CreativeState,
  launch: LaunchState,
  opts: { skipAdCreation: boolean; brandName?: string },
): LaunchParams {
  const dailyBudget = parseInt(launch.budget.replace(/[^\d]/g, ""), 10) || 0;
  // PRD-ab-testing.md §2.1 v0.2 Q4 — 개발모드(skipAdCreation)에서도 A/B 분기 활성. status 만 PAUSED 강제.
  const effectiveStatus: "ACTIVE" | "PAUSED" = opts.skipAdCreation ? "PAUSED" : launch.delivery;
  // A/B 시험은 디테일 모드 + 토글 ON + 축·변형 둘 다 셋팅돼 있고 B 가 A 와 다를 때.
  const variantB = launch.abTestVariantB;
  const headlineMatchesA =
    variantB?.axis === "headline" && variantB.headline === creative.headline;
  const abActive = launch.mode === "detailed"
    && launch.abTestEnabled
    && !!launch.abTestAxis
    && !!variantB
    && variantB.axis === launch.abTestAxis
    && !headlineMatchesA;
  return {
    headline: creative.headline,
    primaryText: creative.primaryText,
    dailyBudget,
    startDate: launch.dateStart,
    endDate: launch.dateEnd,
    ageMin: launch.ageMin,
    ageMax: launch.ageMax,
    genders: uiToGenders(launch.gender),
    countries: launch.countries,
    location: launch.personaLocation.length ? launch.personaLocation : undefined,
    linkUrl: launch.landingUrl.trim(),
    cta: creative.cta,
    status: effectiveStatus,
    imageDataUrl: (launch.finalImageDataUrl ?? launch.imageDataUrl) ?? undefined,
    objective: creative.objective ?? "OUTCOME_TRAFFIC",
    goalId: primaryGoalId(creative.outcome),
    mode: launch.mode,
    bidStrategy: launch.mode === "detailed" ? launch.bidStrategy : undefined,
    bidAmount: launch.mode === "detailed" ? (launch.bidAmount ?? undefined) : undefined,
    placements: launch.mode === "detailed" ? launch.placements : undefined,
    platforms: launch.platforms,
    abTestEnabled: abActive || undefined,
    abTestAxis: abActive ? launch.abTestAxis ?? undefined : undefined,
    abTestVariantB: abActive ? variantB ?? undefined : undefined,
    skipAdCreation: opts.skipAdCreation || undefined,
    brandName: opts.brandName || undefined,
  };
}

// 집행 성공 시 LaunchDraft 에 저장할 LaunchedCampaign — 페이로드 + Meta 응답 ID 합치기.
export function buildLaunchedCampaign(response: LaunchResponse, params: LaunchParams): LaunchedCampaign {
  // PRD-ab-testing.md §10.1 — adIds·axis·variantA·variantB 보존. 결과 카드/prefill 가 이 정보로 동작.
  const abEnabled = params.abTestEnabled && !!params.abTestAxis && !!params.abTestVariantB;
  const variantA = abEnabled && params.abTestAxis === "headline" ? params.headline : undefined;
  return {
    campaignId: response.campaignId,
    adSetId: response.adSetId,
    adId: response.adId,
    adIds: response.adIds,
    dailyBudget: params.dailyBudget,
    startDate: params.startDate,
    endDate: params.endDate,
    status: params.status,
    objective: params.objective,
    goalId: params.goalId,
    skipped: params.skipAdCreation || undefined,
    abTestAxis: abEnabled ? params.abTestAxis : undefined,
    abTestVariantA: variantA,
    abTestVariantB: abEnabled ? params.abTestVariantB : undefined,
  };
}

// Browse Mode 게재 — 노출 없는 시연이라 mock 응답을 합성한다. 결산 목록·빨리감기가 단일 소스로 쓰는
// browseCampaign 페이로드까지 한 자리에서 결정. 부수효과(dispatch·save·createBrowseCampaign·notify)는
// 호출 측 widget 이 실행. ts 주입으로 결정적 → 단위 테스트 가능 (구 widget runLaunch 의 browse 분기 추출).
const BROWSE_OBJECTIVES = new Set<MetaObjectiveParam>([
  "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS",
]);

export interface BrowseLaunchPlan {
  launched: LaunchedCampaign;
  browseCampaign: BrowseCampaignInput;
  message: string;
}

export function planBrowseLaunch(params: LaunchParams, opts: { brandName?: string; ts: number }): BrowseLaunchPlan {
  const { ts } = opts;
  const abEnabled = !!params.abTestEnabled && !!params.abTestAxis && !!params.abTestVariantB;
  const mock: LaunchResponse = {
    campaignId: `cmp_browse_${ts}`,
    adSetId: `adset_browse_${ts}`,
    ...(abEnabled
      ? { adIds: [`ad_browse_${ts}_a`, `ad_browse_${ts}_b`] as [string, string] }
      : params.skipAdCreation ? {} : { adId: `ad_browse_${ts}` }),
  };
  const objective: MetaObjectiveParam = BROWSE_OBJECTIVES.has(params.objective as MetaObjectiveParam)
    ? (params.objective as MetaObjectiveParam)
    : "OUTCOME_TRAFFIC";
  return {
    launched: buildLaunchedCampaign(mock, params),
    browseCampaign: {
      id: mock.campaignId,
      name: `${(opts.brandName ?? "내 캠페인").trim()} — ${params.headline}`,
      headline: params.headline,
      primaryText: params.primaryText,
      cta: params.cta,
      imageUrl: params.imageDataUrl ?? "",
      objective,
      dailyBudget: params.dailyBudget,
      startDate: params.startDate,
      ageMin: params.ageMin,
      ageMax: params.ageMax,
      genders: params.genders,
      countries: params.countries,
    },
    message: launchSuccessMessage(params),
  };
}

// 집행 성공 알림 본문 — skip / A/B / ACTIVE / PAUSED 4 갈래.
export function launchSuccessMessage(params: LaunchParams): string {
  if (params.skipAdCreation) {
    return "Meta 개발 모드 호환 — 캠페인 + 광고 세트만 생성됐어요.";
  }
  const abSuffix = params.abTestEnabled ? " (A/B 시험 — 광고 2개)" : "";
  return params.status === "ACTIVE"
    ? `광고가 Meta에 게재 요청됐어요. 검토 통과 후 노출이 시작돼요.${abSuffix}`
    : `광고가 일시중지 상태로 등록됐어요.${abSuffix}`;
}
