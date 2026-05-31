// Server-side only — do not import from client components; access tokens would be exposed.
// Barrel: re-exports from meta-ads-campaign and meta-ads-insights.

export type {
  MetaObjectiveParam,
  BidStrategyParam,
  PlacementsParam,
  PlatformsParam,
  AbTestAxisParam,
  AbTestVariantBParam,
  CreateCampaignParams,
  CampaignResult,
} from './meta-ads-campaign'

export type {
  InsightsResult,
  AccountStatus,
  CampaignStatusBucket,
  InsightsPeriod,
  CampaignIssueReason,
  CampaignSummary,
} from './meta-ads-insights'

export { VALID_OBJECTIVES } from './meta-ads-campaign'

import { metaAdsCampaign } from './meta-ads-campaign'
import { metaAdsInsights } from './meta-ads-insights'

export const metaAds = {
  ...metaAdsCampaign,
  ...metaAdsInsights,
}
