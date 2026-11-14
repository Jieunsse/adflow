import type { CreativeState } from "@entities/creative/model";
import type { LaunchedCampaign, LaunchState, QuickStartSettings } from "./model";
import { calcDaysBetween } from "@entities/insights/budget-estimates";

type Scope = { brandProfileId?: string; productId?: string; target: string };

export function buildQuickStartSettings(
  creative: CreativeState,
  launch: LaunchState,
  scope: Scope,
): QuickStartSettings {
  return {
    brandProfileId: scope.brandProfileId,
    productId: scope.productId,
    target: scope.target,
    tone: creative.tone,
    outcomeHint: creative.outcomeHint,
    cta: creative.cta,
    dailyBudget: launch.budget,
    durationDays: calcDaysBetween(launch.dateStart, launch.dateEnd),
    ageMin: launch.ageMin,
    ageMax: launch.ageMax,
    gender: launch.gender,
    countries: launch.countries,
    personaLocation: launch.personaLocation,
    landingUrl: launch.landingUrl,
    delivery: launch.delivery,
    platforms: launch.platforms,
  };
}

export function datesForQuickStart(durationDays: number, today = new Date()): { start: string; end: string } {
  const start = new Date(today);
  const end = new Date(today);
  end.setDate(end.getDate() + Math.max(1, durationDays) - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function latestQuickStart(
  launches: LaunchedCampaign[],
  brandProfileId: string | null,
  productId: string | null,
): { campaignId: string; settings: QuickStartSettings } | null {
  const match = launches.find((launch) => {
    const settings = launch.quickStart;
    return settings
      && settings.brandProfileId === (brandProfileId ?? undefined)
      && (!productId || settings.productId === productId);
  });
  return match?.quickStart ? { campaignId: match.campaignId, settings: match.quickStart } : null;
}
