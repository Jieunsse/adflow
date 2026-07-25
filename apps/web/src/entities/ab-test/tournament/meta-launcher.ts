// 실 게재 어댑터 (ADR-038 결정 4) — server-side only. 한 라운드 = 챔피언(A) vs 챌린저(B)를
// ad_studies SPLIT_TEST 로 게재한다: 셀 A·B 를 각각 독립 AdSet 으로 만들고 Meta 가 청중을 50/50
// 분할·자체 유의성 winner 를 판정한다(ADR §4 정석). axis(헤드라인|카피)만 갈리고 나머지 필드는 공유.
//
// 판정은 Meta verdict 채택 — KpiSource.roundVerdict 가 studyId 로 ad study 결과를 읽어 엔진에 넘긴다
// (z-검정 폴백 대체). studyId·adSetIds 는 라운드에 박혀 cron 폴러가 세션 없이 결산한다.

import { metaAdsCampaign, type AbTestVariantBParam } from "@/lib/meta-ads-campaign";
import type { ObjectivePhase1Id } from "@entities/creative/options";
import type { RoundLauncher } from "./adapters";
import { deriveAxis, type TourVariant } from "./engine";

function isoDateKST(daysFromNow: number): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600_000 + daysFromNow * 86400_000);
  return kst.toISOString().slice(0, 10);
}

// 챌린저에서 갈리는 축만 variantB 로. image 축은 토너먼트 자동 순회에 없고(헤드라인/카피 전용),
// 셋업 라운드1 image 도 dataUrl 이 없으면 헤드라인 차이로 폴백한다.
function variantB(challenger: TourVariant, axis: "headline" | "primary_text" | "image"): AbTestVariantBParam {
  if (axis === "primary_text") return { axis: "primary_text", primaryText: challenger.primaryText };
  return { axis: "headline", headline: challenger.headline };
}

export function createMetaRoundLauncher(): RoundLauncher {
  return {
    async launch(t, round) {
      const d = t.delivery;
      if (!d) throw new Error("실 게재 자격증명이 없는 토너먼트입니다.");
      const rawAxis = deriveAxis(round.champion, round.challenger);
      const axis = rawAxis === "image" ? "headline" : rawAxis;

      const result = await metaAdsCampaign.createSplitTestStudy(
        {
          headline: round.champion.headline,
          primaryText: round.champion.primaryText,
          dailyBudget: t.dailyBudget,
          startDate: isoDateKST(0),
          endDate: isoDateKST(d.roundDays),
          ageMin: d.ageMin,
          ageMax: d.ageMax,
          genders: d.genders,
          countries: d.countries,
          linkUrl: d.linkUrl,
          ctaType: d.ctaType,
          status: "ACTIVE",
          imageDataUrl: d.imageDataUrl,
          goalId: d.goalId as ObjectivePhase1Id | undefined,
          brandName: t.productName,
          abTestEnabled: true,
          abTestAxis: axis,
          abTestVariantB: variantB(round.challenger, axis),
        },
        d.accessToken,
        d.adAccountId,
        d.pageId,
      );

      return {
        campaignId: result.campaignId,
        adIds: result.adIds,
        adSetIds: result.adSetIds,
        studyId: result.studyId,
      };
    },
  };
}
