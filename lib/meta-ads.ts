// Server-side only — do not import from client components; access tokens would be exposed.

import type { Insights, AdInsightsRow } from '@entities/insights/types'
import type { Billing, FundingSource, BusinessInfo, AccountStatusCode } from '@entities/billing/types'
import { OBJECTIVES_PHASE1, type ObjectivePhase1Id } from '@entities/creative/options'
import { AuthError } from './route-handler'
import type { AdSnapshot, AdEffectiveStatus } from './notifications/ad-status-diff'

const GRAPH = 'https://graph.facebook.com/v20.0'

// PRD §13 — leads_call goal 추가로 OUTCOME_LEADS 도 합법 objective.
// 단 leads_form (Phase 2 Instant Form) 은 페이지 ToS · Lead Form 빌더 필요해서 별도 트랙.
export type MetaObjectiveParam = 'OUTCOME_TRAFFIC' | 'OUTCOME_AWARENESS' | 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEADS'
export type BidStrategyParam = 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP'
export type PlacementsParam = { mode: 'auto' } | { mode: 'manual'; positions: string[] }
export type PlatformsParam = 'both' | 'facebook' | 'instagram'

// PRD-ab-testing.md §4.1 — A/B 시험 축. server·client 둘 다 type 만 사용. entity 의 동명 type 과 형태 일치.
export type AbTestAxisParam = 'headline' | 'primary_text' | 'image'
export type AbTestVariantBParam =
  | { axis: 'headline'; headline: string }
  | { axis: 'primary_text'; primaryText: string }
  | { axis: 'image'; imageDataUrl: string }

export interface CreateCampaignParams {
  headline: string
  primaryText: string
  dailyBudget: number  // KRW integer — passed as-is to Meta (KRW has no fractional units)
  startDate: string    // YYYY-MM-DD
  endDate: string      // YYYY-MM-DD
  ageMin: number
  ageMax: number
  genders?: number[]   // Meta spec: 1=male, 2=female, empty/omitted = all
  countries: string[]  // ISO 3166-1 alpha-2 (at least one required)
  linkUrl: string
  ctaType: string      // Meta call_to_action.type e.g. LEARN_MORE, SHOP_NOW
  status: 'ACTIVE' | 'PAUSED'
  imageDataUrl?: string // optional — data:image/...;base64,...

  // PRD §13 — Phase 1 goal id (예: 'leads_call'). 제공되면 OBJECTIVES_PHASE1 entry 에서
  // optimization_goal · destination_type · promoted_object 를 전부 도출. objective 보다 우선.
  // 미제공 시 레거시 경로: objective 만으로 plan derive.
  goalId?: ObjectivePhase1Id
  // PRD-create-modes-and-objectives §5.5 — objective/bid/placement branching
  objective?: MetaObjectiveParam     // defaults to OUTCOME_TRAFFIC when omitted
  bidStrategy?: BidStrategyParam     // defaults to LOWEST_COST_WITHOUT_CAP when omitted
  bidAmount?: number                  // KRW — only used when bidStrategy is a cap variant
  placements?: PlacementsParam        // defaults to auto (Advantage+) when omitted
  platforms?: PlatformsParam          // omitted or 'both' = let Meta auto-select publisher_platforms
  pixelId?: string                    // optional — adds tracking_specs for passive pixel event tracking
  mode?: 'simple' | 'detailed'
  // PRD-ab-testing.md §4.2 — A/B 시험. enabled 면 axis + variantB 필수. Phase 1 = headline 축만 실제 분기.
  abTestEnabled?: boolean
  abTestAxis?: AbTestAxisParam
  abTestVariantB?: AbTestVariantBParam
  // Meta 앱 개발 모드 호환 — POST /adcreatives 가 subcode 1885183 으로 막혀서 Campaign + AdSet 까지만 생성하고 종료
  skipAdCreation?: boolean
}

export interface CampaignResult {
  campaignId: string
  adSetId: string
  adId?: string
  // A/B 시험 — 두 광고 ID. 단일 광고면 undefined, adId 사용. STEP 03 인사이트에서 adIds 존재로 A/B 판정.
  adIds?: [string, string]
}

// 도메인 타입은 src/entities/insights/types.ts 단일 출처. caller 호환용 alias 만 유지.
export type InsightsResult = Insights

export interface AccountStatus {
  connected: boolean
  accountId: string
  accountName: string
  currency: string
}

export type CampaignStatusBucket = 'live' | 'review' | 'paused' | 'ended' | 'issue'
export type InsightsPeriod = '7d' | '30d' | 'all'

export interface CampaignIssueReason {
  summary: string   // error_summary — 한 줄 요약 (행 인라인 표시용)
  message: string   // error_message — 풀텍스트 (모달 표시용). summary 와 동일하면 summary 만 사용
}

export interface CampaignSummary {
  id: string
  name: string
  headline: string  // name with 'AdFlow — ' prefix stripped; falls back to name as-is
  status: CampaignStatusBucket
  objective: string
  goal: string
  startDate: string | null  // YYYY-MM-DD
  endDate: string | null
  adSetId: string | null  // needed for pause/resume/budget actions on the row
  adId: string | null     // must also be ACTIVE when resuming
  dailyBudget: number | null  // KRW
  impressions: number
  clicks: number
  ctr: number   // %
  spend: number // KRW
  issueReason: CampaignIssueReason | null  // /approvals 에서 노출. status='issue' 일 때만 채워지는 경향 (Meta 가 review 단계에서도 줄 수 있음)
  // PRD-ab-testing.md §4.4 — mock 시연 캠페인의 A/B 시드. live API 매핑은 채우지 않음.
  abTestEnabled?: boolean
  abTestAxis?: AbTestAxisParam
  abTestVariantA?: string  // axis 종속 — headline 텍스트 / primaryText / 이미지 URL
  abTestVariantB?: string
  // ADR-011 — Campaign Configuration 탭용 소재·타겟팅 필드
  imageUrl?: string
  primaryText?: string
  cta?: string
  landingUrl?: string
  ageMin?: number
  ageMax?: number
  genders?: number[]
  countries?: string[]
  platforms?: PlatformsParam
  placementMode?: 'auto' | 'manual'
  placementPositions?: string[]
  bidStrategy?: BidStrategyParam
  bidAmount?: number | null
}

interface MetaError { error: { message: string; code: number; error_subcode?: number; error_user_msg?: string; error_data?: string } }

async function graphFetch<T extends object>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${GRAPH}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const json = (await res.json()) as T | MetaError
  if ('error' in json) {
    const e = (json as MetaError).error
    // code 190 = access token expired/invalid → user must re-login
    if (e.code === 190) {
      throw new AuthError('Meta 인증이 만료됐어요. 로그아웃 후 다시 로그인해주세요.')
    }
    const detail = [
      e.error_subcode ? `subcode=${e.error_subcode}` : '',
      e.error_user_msg ?? '',
      e.error_data ? `data=${e.error_data}` : '',
    ].filter(Boolean).join(' | ')
    throw new Error(`Meta API 오류 (${e.code}): ${e.message}${detail ? ` — ${detail}` : ''}`)
  }
  return json as T
}

function toUnixKST(date: string, endOfDay = false): number {
  const d = new Date(`${date}T${endOfDay ? '23:59:59' : '00:00:00'}+09:00`)
  return Math.floor(d.getTime() / 1000)
}

async function uploadAdImage(dataUrl: string, token: string, accountId: string): Promise<string> {
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
  const data = await graphFetch<{ images: Record<string, { hash: string; url: string }> }>(
    `/${accountId}/adimages`,
    { method: 'POST', body: JSON.stringify({ bytes: base64, access_token: token }) },
  )
  const first = Object.values(data.images ?? {})[0]
  if (!first?.hash) throw new Error('광고 이미지 업로드에 실패했어요. 다른 이미지로 다시 시도해주세요.')
  return first.hash
}

// 레거시 fallback — goalId 가 없을 때만 사용. Phase 1 goal 확장 이전 동작 보존용.
// OUTCOME_LEADS 는 goalId 'leads_call' 경로로만 들어오므로 여기 fallback 은 traffic 으로 격하.
const OPTIMIZATION_GOAL_BY_OBJECTIVE: Record<MetaObjectiveParam, string> = {
  OUTCOME_TRAFFIC:    'LINK_CLICKS',
  OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
  OUTCOME_AWARENESS:  'REACH',
  OUTCOME_LEADS:      'LINK_CLICKS',
}

// 'both' = omit publisher_platforms so Meta Advantage+ picks freely across all platforms.
function buildPlatformOnlyTargeting(platforms?: PlatformsParam): Record<string, unknown> {
  if (!platforms || platforms === 'both') return {}
  return { publisher_platforms: [platforms] }
}

// Auto (Advantage+) returns {} — no placement keys in targeting.
function buildPlacementTargeting(p?: PlacementsParam): Record<string, unknown> {
  if (!p || p.mode === 'auto' || p.positions.length === 0) return {}
  const publisherPlatforms = new Set<string>()
  const facebookPositions = new Set<string>()
  const instagramPositions = new Set<string>()
  const audienceNetworkPositions = new Set<string>()
  const messengerPositions = new Set<string>()
  for (const pos of p.positions) {
    switch (pos) {
      case 'facebook_feed':      publisherPlatforms.add('facebook');         facebookPositions.add('feed');              break
      case 'instagram_feed':     publisherPlatforms.add('instagram');        instagramPositions.add('stream');           break
      case 'instagram_stories':  publisherPlatforms.add('instagram');        instagramPositions.add('story');            break
      case 'audience_network':   publisherPlatforms.add('audience_network'); audienceNetworkPositions.add('classic');    break
      case 'messenger':          publisherPlatforms.add('messenger');        messengerPositions.add('messenger_home');   break
    }
  }
  return {
    publisher_platforms: [...publisherPlatforms],
    ...(facebookPositions.size > 0 ? { facebook_positions: [...facebookPositions] } : {}),
    ...(instagramPositions.size > 0 ? { instagram_positions: [...instagramPositions] } : {}),
    ...(audienceNetworkPositions.size > 0 ? { audience_network_positions: [...audienceNetworkPositions] } : {}),
    ...(messengerPositions.size > 0 ? { messenger_positions: [...messengerPositions] } : {}),
  }
}

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_TRAFFIC: '트래픽',
  OUTCOME_SALES: '전환',
  OUTCOME_AWARENESS: '인지도',
  OUTCOME_LEADS: '잠재고객',
  OUTCOME_ENGAGEMENT: '참여',
  OUTCOME_APP_PROMOTION: '앱 설치',
  LINK_CLICKS: '트래픽',
  CONVERSIONS: '전환',
  REACH: '인지도',
}

function mapCampaignStatus(effStatus: string | undefined, stopTime: string | undefined): CampaignStatusBucket {
  const s = String(effStatus ?? '').toUpperCase()
  if (s === 'WITH_ISSUES' || s === 'DISAPPROVED' || s === 'ADSET_PAUSED_WITH_ISSUES') return 'issue'
  if (s === 'IN_PROCESS' || s === 'PENDING_REVIEW' || s === 'PENDING_BILLING_INFO' || s === 'PREAPPROVED' || s === 'PENDING_PROCESSING') return 'review'
  if (s === 'ARCHIVED' || s === 'DELETED') return 'ended'
  if (stopTime) {
    const t = Date.parse(stopTime)
    if (Number.isFinite(t) && t < Date.now()) return 'ended'
  }
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 'paused'
  if (s === 'ACTIVE') return 'live'
  return 'review'
}

function toDateOnly(iso: string | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  if (m) return m[1]
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
}

function stripHeadline(name: string): string {
  const m = /^AdFlow\s*[—–\-]\s*(.+)$/.exec(name)
  return (m ? m[1] : name).trim()
}

function presetFor(period: InsightsPeriod): string {
  return period === '7d' ? 'last_7d' : period === '30d' ? 'last_30d' : 'maximum'
}

interface RawIssueInfo {
  level?: string           // CAMPAIGN | AD_SET | AD
  error_code?: number
  error_summary?: string
  error_message?: string
  error_type?: string
}

interface RawCampaign {
  id: string
  name: string
  effective_status?: string
  objective?: string
  start_time?: string
  stop_time?: string
  daily_budget?: string
  adsets?: { data?: Array<{
    id: string
    daily_budget?: string
    bid_strategy?: string
    bid_amount?: string
    targeting?: {
      age_min?: number
      age_max?: number
      genders?: number[]
      geo_locations?: { countries?: string[] }
      publisher_platforms?: string[]
      facebook_positions?: string[]
      instagram_positions?: string[]
    }
    ads?: { data?: Array<{ id: string }> }
  }> }
  insights?: { data?: Array<{ impressions?: string; clicks?: string; ctr?: string; spend?: string }> }
  issues_info?: RawIssueInfo[]
}

const CAMPAIGN_FIELDS = (period: InsightsPeriod) => [
  'id', 'name', 'effective_status', 'objective', 'start_time', 'stop_time', 'daily_budget',
  'issues_info',
  'adsets.limit(1){id,daily_budget,bid_strategy,bid_amount,targeting{age_min,age_max,genders,geo_locations,publisher_platforms,facebook_positions,instagram_positions},ads.limit(1){id}}',
  `insights.date_preset(${presetFor(period)}){impressions,clicks,ctr,spend}`,
].join(',')

function pickIssueReason(issues: RawIssueInfo[] | undefined): CampaignIssueReason | null {
  if (!issues?.length) return null
  const first = issues[0]
  const summary = first.error_summary?.trim() ?? ''
  const message = first.error_message?.trim() ?? ''
  if (!summary && !message) return null
  return { summary: summary || message, message: message || summary }
}

interface RawPollAd {
  id: string
  name?: string
  effective_status?: string
  issues_info?: RawIssueInfo[]
  campaign?: { id?: string }
}

const POLL_STATUS_SET = new Set<AdEffectiveStatus>(['PENDING_REVIEW', 'ACTIVE', 'WITH_ISSUES', 'DISAPPROVED', 'PAUSED'])

function toAdSnapshot(ad: RawPollAd): AdSnapshot | null {
  const status = String(ad.effective_status ?? '').toUpperCase() as AdEffectiveStatus
  if (!POLL_STATUS_SET.has(status)) return null
  const campaignId = ad.campaign?.id ?? ''
  if (!campaignId) return null
  const issue = ad.issues_info?.[0]
  const issueReason = issue?.error_summary?.trim() || issue?.error_message?.trim() || null
  return {
    adId: ad.id,
    campaignId,
    name: ad.name ?? '',
    status,
    issueReason,
  }
}

function mapRawCampaign(c: RawCampaign): CampaignSummary {
  const adset = c.adsets?.data?.[0]
  const ins = c.insights?.data?.[0]
  const impressions = Math.round(Number(ins?.impressions ?? 0))
  const clicks = Math.round(Number(ins?.clicks ?? 0))
  const ctr = ins?.ctr != null
    ? Math.round(parseFloat(ins.ctr) * 100) / 100
    : impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0
  const spend = Math.round(parseFloat(ins?.spend ?? '0'))
  const dailyBudgetRaw = c.daily_budget ?? adset?.daily_budget
  const obj = c.objective ?? ''
  const tgt = adset?.targeting
  const pubPlatforms = tgt?.publisher_platforms ?? []
  const hasFb = pubPlatforms.includes('facebook')
  const hasIg = pubPlatforms.includes('instagram')
  const platforms: PlatformsParam =
    pubPlatforms.length === 0 ? 'both'
    : hasFb && hasIg ? 'both'
    : hasFb ? 'facebook'
    : hasIg ? 'instagram'
    : 'both'
  const fbPos = tgt?.facebook_positions ?? []
  const igPos = tgt?.instagram_positions ?? []
  const placementPositions: string[] = [
    ...fbPos.map((p) => `facebook_${p}`),
    ...igPos.map((p) => p === 'stream' ? 'instagram_feed' : p === 'story' ? 'instagram_stories' : `instagram_${p}`),
  ]
  return {
    id: c.id,
    name: c.name,
    headline: stripHeadline(c.name ?? ''),
    status: mapCampaignStatus(c.effective_status, c.stop_time),
    objective: obj,
    goal: OBJECTIVE_LABEL[obj] ?? (obj ? obj.replace(/^OUTCOME_/, '') : '—'),
    startDate: toDateOnly(c.start_time),
    endDate: toDateOnly(c.stop_time),
    adSetId: adset?.id ?? null,
    adId: adset?.ads?.data?.[0]?.id ?? null,
    dailyBudget: dailyBudgetRaw != null && Number.isFinite(Number(dailyBudgetRaw)) ? Math.round(Number(dailyBudgetRaw)) : null,
    impressions, clicks, ctr, spend,
    issueReason: pickIssueReason(c.issues_info),
    ageMin: tgt?.age_min,
    ageMax: tgt?.age_max,
    genders: tgt?.genders,
    countries: tgt?.geo_locations?.countries,
    platforms,
    placementMode: placementPositions.length > 0 ? 'manual' : 'auto',
    placementPositions: placementPositions.length > 0 ? placementPositions : undefined,
    bidStrategy: adset?.bid_strategy as BidStrategyParam | undefined,
    bidAmount: adset?.bid_amount != null ? Math.round(Number(adset.bid_amount)) : null,
  }
}

// ── createCampaign internal seam ────────────────────────────────────────────
// Pure builders — orchestrator(`metaAds.createCampaign`) 가 plan 한 번 derive 한 뒤 4 stage POST 의 body 를 합쳐 보냄.
// access_token 은 transport 관심사라 builder 에 안 들어옴 — orchestrator 가 fetch 직전 합침.

interface LaunchPlan {
  objective: MetaObjectiveParam
  optimizationGoal: string
  // PRD §13 — goal 별 AdSet 분기. 미정의 시 omit.
  destinationType?: string
  promotedObject?: Record<string, string>
  bidStrategy: BidStrategyParam
  status: 'ACTIVE' | 'PAUSED'
  placement: Record<string, unknown> // empty = Advantage+ auto
}

function deriveLaunchPlan(params: CreateCampaignParams, pageId: string): LaunchPlan {
  // Goal-first path — goalId 제공되면 OBJECTIVES_PHASE1 entry 에서 전부 도출 (PRD §13).
  const goalDef = params.goalId
    ? OBJECTIVES_PHASE1.find((g) => g.id === params.goalId)
    : null

  let objective: MetaObjectiveParam
  let optimizationGoal: string
  let destinationType: string | undefined
  let promotedObject: Record<string, string> | undefined

  if (goalDef) {
    objective = goalDef.metaObjective as MetaObjectiveParam
    // simple 모드 + traffic goal 만 LANDING_PAGE_VIEWS 권장 (CPC 안정).
    // traffic_page_visit 은 이미 LANDING_PAGE_VIEWS 라 mode 무관.
    optimizationGoal = params.mode === 'simple' && goalDef.id === 'traffic'
      ? 'LANDING_PAGE_VIEWS'
      : goalDef.optimizationGoal
    destinationType = goalDef.destinationType ?? undefined
    if (goalDef.promotedObject === 'page') promotedObject = { page_id: pageId }
  } else {
    // 레거시 — objective 만 받은 경우. PRD §13 이전 호출 흐름 회귀 보호.
    objective = params.objective ?? 'OUTCOME_TRAFFIC'
    optimizationGoal = params.mode === 'simple' && objective === 'OUTCOME_TRAFFIC'
      ? 'LANDING_PAGE_VIEWS'
      : OPTIMIZATION_GOAL_BY_OBJECTIVE[objective]
    destinationType = objective === 'OUTCOME_TRAFFIC' ? 'WEBSITE' : undefined
  }

  const bidStrategy: BidStrategyParam = params.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP'
  const status: 'ACTIVE' | 'PAUSED' = params.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'
  // Manual placements 가 publisher_platforms 까지 인코드함. manual 비어있을 때만 platform picker 로 폴백.
  const manualPlacement = buildPlacementTargeting(params.placements)
  const placement = Object.keys(manualPlacement).length > 0
    ? manualPlacement
    : buildPlatformOnlyTargeting(params.platforms)
  return { objective, optimizationGoal, destinationType, promotedObject, bidStrategy, status, placement }
}

function buildCampaignBody(params: CreateCampaignParams, plan: LaunchPlan): Record<string, unknown> {
  return {
    name: `AdFlow — ${params.headline}`,
    objective: plan.objective,
    status: plan.status,
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  }
}

function buildAdSetBody(params: CreateCampaignParams, plan: LaunchPlan, campaignId: string): Record<string, unknown> {
  return {
    name: `AdFlow AdSet — ${params.headline}`,
    campaign_id: campaignId,
    billing_event: 'IMPRESSIONS',
    optimization_goal: plan.optimizationGoal,
    bid_strategy: plan.bidStrategy,
    ...(plan.bidStrategy !== 'LOWEST_COST_WITHOUT_CAP' && params.bidAmount
      ? { bid_amount: String(params.bidAmount) }
      : {}),
    daily_budget: String(params.dailyBudget),
    // PRD §13 — goal 기반 plan.destinationType / promotedObject. 레거시 경로(traffic)도 동일하게 'WEBSITE' 채워짐.
    ...(plan.destinationType ? { destination_type: plan.destinationType } : {}),
    ...(plan.promotedObject ? { promoted_object: plan.promotedObject } : {}),
    targeting: {
      age_min: params.ageMin,
      // Advantage+ audience(simple 모드)는 Meta 가 age_max ≥ 65 를 강제(subcode 1870189). 유저 선택값은 권장 사항으로 격하됨.
      age_max: params.mode === 'simple' ? Math.max(params.ageMax, 65) : params.ageMax,
      ...(params.genders && params.genders.length > 0 ? { genders: params.genders } : {}),
      geo_locations: { countries: params.countries },
      targeting_automation: { advantage_audience: params.mode === 'simple' ? 1 : 0 },
      ...plan.placement,
    },
    start_time: toUnixKST(params.startDate),
    end_time: toUnixKST(params.endDate, true),
    status: plan.status,
    ...(params.pixelId ? { tracking_specs: [{ 'action.type': ['offsite_conversion'], 'fb.pixel': [params.pixelId] }] } : {}),
  }
}

// A/B 시험 시 변형(variant) 라벨 — Meta Ads Manager 에서 한 눈에 A/B 구분되도록 name 에 prefix.
type VariantTag = '' | 'A' | 'B'

// PRD §13 — Messenger 광고는 call_to_action.value.app_destination = 'MESSENGER' 가 필요.
// 다른 CTA 는 value 불요. 추후 CALL_NOW 의 phone_number 등 확장 가능.
function buildCtaForCreative(ctaType: string): Record<string, unknown> {
  if (ctaType === 'MESSAGE_PAGE') {
    return { type: ctaType, value: { app_destination: 'MESSENGER' } }
  }
  return { type: ctaType }
}

// PRD-ab-testing.md §4.2 — buildCreativeBody 시그니처를 축별 override 가능하도록 일반화.
// 호출자가 axis 별로 headline/primaryText/imageHash 를 다르게 넘겨서 두 AdCreative 가 한 축에서만 갈리도록.
interface CreativeOverride {
  imageHash: string | undefined
  headline: string
  primaryText: string
}

function buildCreativeBody(
  params: CreateCampaignParams,
  pageId: string,
  override: CreativeOverride,
  variant: VariantTag,
): Record<string, unknown> {
  const tag = variant ? ` ${variant}` : ''
  return {
    name: `AdFlow Creative${tag} — ${override.headline}`,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        message: override.primaryText,
        link: params.linkUrl,
        name: override.headline,
        call_to_action: buildCtaForCreative(params.ctaType),
        ...(override.imageHash ? { image_hash: override.imageHash } : {}),
      },
    },
    // 간단 모드 — Meta 의 standard enhancements(자동 카피 변형·자르기 등) 옵트인.
    ...(params.mode === 'simple' ? { degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_IN' } } } } : {}),
  }
}

function buildAdBody(
  adSetId: string,
  creativeId: string,
  status: 'ACTIVE' | 'PAUSED',
  headline: string,
  variant: VariantTag,
): Record<string, unknown> {
  const tag = variant ? ` ${variant}` : ''
  return {
    name: `AdFlow Ad${tag} — ${headline}`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status,
  }
}

// ── getBilling 매퍼 ────────────────────────────────────────────────────────
// Meta /act_{id}?fields=balance,spend_cap,amount_spent,funding_source_details,... 응답을
// 도메인 타입 Billing 으로 변환. 결측 필드는 모두 null 보존(빈 문자열 아님).

interface RawFundingSourceRow {
  id?: string
  display_string?: string
  type?: string | number
}

interface RawBilling {
  name?: string
  account_status?: number
  currency?: string
  balance?: string | number | null
  spend_cap?: string | number | null
  amount_spent?: string | number | null
  business_name?: string | null
  business_street?: string | null
  business_city?: string | null
  business_state?: string | null
  business_zip?: string | null
  business_country_code?: string | null
  // Meta 버전 따라 raw array 또는 { data: [...] } 래핑 — 양쪽 다 처리
  funding_source_details?: RawFundingSourceRow[] | { data?: RawFundingSourceRow[] }
}

function toMinorUnitOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

function normalizeFundingSources(raw: RawBilling['funding_source_details']): FundingSource[] {
  if (!raw) return []
  const rows: RawFundingSourceRow[] = Array.isArray(raw) ? raw : (raw.data ?? [])
  return rows
    .filter((r) => r && (r.id || r.display_string))
    .map((r) => ({
      id: String(r.id ?? ''),
      displayString: String(r.display_string ?? ''),
      type: String(r.type ?? ''),
    }))
}

function mapRawBilling(accountId: string, raw: RawBilling): Billing {
  const business: BusinessInfo = {
    name: raw.business_name ?? null,
    street: raw.business_street ?? null,
    city: raw.business_city ?? null,
    state: raw.business_state ?? null,
    zip: raw.business_zip ?? null,
    countryCode: raw.business_country_code ?? null,
  }
  return {
    accountId,
    accountName: raw.name ?? null,
    currency: raw.currency ?? '',
    accountStatus: (raw.account_status ?? 0) as AccountStatusCode | number,
    balance: toMinorUnitOrNull(raw.balance),
    spendCap: toMinorUnitOrNull(raw.spend_cap),
    amountSpent: toMinorUnitOrNull(raw.amount_spent),
    fundingSources: normalizeFundingSources(raw.funding_source_details),
    business,
  }
}

const BILLING_FIELDS = [
  'name',
  'account_status',
  'currency',
  'balance',
  'spend_cap',
  'amount_spent',
  'business_name',
  'business_street',
  'business_city',
  'business_state',
  'business_zip',
  'business_country_code',
  'funding_source_details',
].join(',')

export const metaAds = {
  async checkAccount(token: string, accountId: string): Promise<AccountStatus> {
    const data = await graphFetch<{
      name: string
      account_status: number
      currency: string
    }>(`/${accountId}?fields=name,account_status,currency&access_token=${token}`)
    return {
      connected: data.account_status === 1,
      accountId,
      accountName: data.name,
      currency: data.currency,
    }
  },

  async getBilling(token: string, accountId: string): Promise<Billing> {
    const data = await graphFetch<RawBilling>(
      `/${accountId}?fields=${BILLING_FIELDS}&access_token=${token}`,
    )
    return mapRawBilling(accountId, data)
  },

  async createCampaign(params: CreateCampaignParams, token: string, accountId: string, pageId: string): Promise<CampaignResult> {
    if (!pageId) {
      throw new Error('광고를 게재하려면 페이스북 페이지를 먼저 선택해야 해요.')
    }
    if (!params.countries || params.countries.length === 0) {
      throw new Error('타겟 지역(국가)을 최소 한 곳 선택해야 해요.')
    }

    const plan = deriveLaunchPlan(params, pageId)
    const imageHash = params.imageDataUrl
      ? await uploadAdImage(params.imageDataUrl, token, accountId)
      : undefined

    const post = <T extends object>(path: string, body: Record<string, unknown>) =>
      graphFetch<T>(path, {
        method: 'POST',
        body: JSON.stringify({ ...body, access_token: token }),
      })

    const campaign = await post<{ id: string }>(`/${accountId}/campaigns`, buildCampaignBody(params, plan))

    // 캠페인 생성 후 단계가 실패하면 광고 계정이 빈 캠페인으로 더러워지지 않도록 정리.
    // catch 에서 "어디까지 통과했는지" 진단하려면 단계별 ID 가 try 밖 스코프에 있어야 함.
    let adSetId: string | undefined
    let creativeId: string | undefined
    let adId: string | undefined
    try {
      const adSet = await post<{ id: string }>(`/${accountId}/adsets`, buildAdSetBody(params, plan, campaign.id))
      adSetId = adSet.id

      // Meta 앱 개발 모드 호환 — Ad Creative/Ad 단계는 공개 모드 앱만 허용되므로 여기서 종료.
      if (params.skipAdCreation) {
        return { campaignId: campaign.id, adSetId: adSet.id }
      }

      // PRD-ab-testing.md §4.2 — 축별 A/B 분기. 같은 AdSet 에 두 광고, axis 외 필드는 공유.
      if (params.abTestEnabled && params.abTestAxis && params.abTestVariantB) {
        const axis = params.abTestAxis
        const variantB = params.abTestVariantB
        if (variantB.axis !== axis) {
          throw new Error('A/B 시험 축과 B안 형식이 맞지 않아요.')
        }
        const overrideA: CreativeOverride = { imageHash, headline: params.headline, primaryText: params.primaryText }
        let overrideB: CreativeOverride
        if (variantB.axis === 'headline') {
          overrideB = { imageHash, headline: variantB.headline, primaryText: params.primaryText }
        } else if (variantB.axis === 'primary_text') {
          overrideB = { imageHash, headline: params.headline, primaryText: variantB.primaryText }
        } else {
          // image axis — 라이브모드에서는 별도 이미지 업로드 필요. 현재는 개발모드 전용.
          overrideB = { imageHash, headline: params.headline, primaryText: params.primaryText }
        }
        const creativeA = await post<{ id: string }>(`/${accountId}/adcreatives`, buildCreativeBody(params, pageId, overrideA, 'A'))
        creativeId = creativeA.id
        const creativeB = await post<{ id: string }>(`/${accountId}/adcreatives`, buildCreativeBody(params, pageId, overrideB, 'B'))
        creativeId = creativeB.id
        const adA = await post<{ id: string }>(`/${accountId}/ads`, buildAdBody(adSet.id, creativeA.id, plan.status, overrideA.headline, 'A'))
        adId = adA.id
        const adB = await post<{ id: string }>(`/${accountId}/ads`, buildAdBody(adSet.id, creativeB.id, plan.status, overrideB.headline, 'B'))
        adId = adB.id
        return { campaignId: campaign.id, adSetId: adSet.id, adIds: [adA.id, adB.id] }
      }

      const single: CreativeOverride = { imageHash, headline: params.headline, primaryText: params.primaryText }
      const creative = await post<{ id: string }>(`/${accountId}/adcreatives`, buildCreativeBody(params, pageId, single, ''))
      creativeId = creative.id
      const ad = await post<{ id: string }>(`/${accountId}/ads`, buildAdBody(adSet.id, creative.id, plan.status, params.headline, ''))
      adId = ad.id

      return { campaignId: campaign.id, adSetId: adSet.id, adId: ad.id }
    } catch (err) {
      // graphFetch 가 MetaError 를 plain Error 메시지로 평탄화하므로 (lib/meta-ads.ts:117) 진단용으로 코드/서브코드를 재추출.
      const errorMessage = err instanceof Error ? err.message : String(err)
      const codeMatch = errorMessage.match(/오류 \((\d+)\)/)
      const subcodeMatch = errorMessage.match(/subcode=(\d+)/)
      console.error('[meta-ads] createCampaign failed', {
        campaignId: campaign.id,
        adSetId,
        creativeId,
        adId,
        imageHash,
        pageId,
        accountId,
        errorCode: codeMatch ? Number(codeMatch[1]) : undefined,
        errorSubcode: subcodeMatch ? Number(subcodeMatch[1]) : undefined,
        errorMessage,
      })
      try {
        await graphFetch<{ success?: boolean }>(`/${campaign.id}?access_token=${token}`, { method: 'DELETE' })
      } catch {
        // 정리 실패는 의도적으로 swallow — 원래 에러를 다시 던짐.
      }
      throw err
    }
  },

  async getCampaignBrief(campaignId: string, token: string): Promise<{
    name: string;
    headline: string;
    objective: string;
    status: CampaignStatusBucket;
  } | null> {
    try {
      const data = await graphFetch<RawCampaign>(
        `/${campaignId}?fields=id,name,effective_status,objective,stop_time&access_token=${token}`
      )
      return {
        name: data.name,
        headline: stripHeadline(data.name),
        objective: data.objective ?? 'OUTCOME_TRAFFIC',
        status: mapCampaignStatus(data.effective_status, data.stop_time),
      }
    } catch {
      return null
    }
  },

  async listAdsForPolling(token: string, accountId: string): Promise<AdSnapshot[]> {
    const fields = encodeURIComponent('id,name,effective_status,issues_info{error_message,error_summary},campaign{id}')
    const filtering = encodeURIComponent(JSON.stringify([{
      field: 'ad.effective_status',
      operator: 'IN',
      value: ['PENDING_REVIEW', 'ACTIVE', 'WITH_ISSUES', 'DISAPPROVED', 'PAUSED'],
    }]))
    const data = await graphFetch<{ data: RawPollAd[] }>(
      `/${accountId}/ads?fields=${fields}&filtering=${filtering}&limit=100&access_token=${token}`
    )
    return (data.data ?? []).map(toAdSnapshot).filter((a): a is AdSnapshot => a !== null)
  },

  async listCampaigns(token: string, accountId: string, period: InsightsPeriod = 'all'): Promise<CampaignSummary[]> {
    const fields = encodeURIComponent(CAMPAIGN_FIELDS(period))
    const data = await graphFetch<{ data: RawCampaign[] }>(
      `/${accountId}/campaigns?fields=${fields}&limit=50&access_token=${token}`
    )
    return (data.data ?? []).map(mapRawCampaign)
  },

  async getCampaign(campaignId: string, token: string): Promise<CampaignSummary> {
    const fields = encodeURIComponent(CAMPAIGN_FIELDS('all'))
    const c = await graphFetch<RawCampaign>(`/${campaignId}?fields=${fields}&access_token=${token}`)
    return mapRawCampaign(c)
  },

  // PRD §13 — goalId 우선. 미제공 시 objective 기반 레거시 fallback.
  // PRD-ab-testing.md §7.2 — adIds 제공 시 추가 호출로 광고별 row 두 개. 캠페인 합계 + 광고별 row 둘 다 반환.
  async getInsights(
    campaignId: string,
    token: string,
    period?: InsightsPeriod,
    objective?: MetaObjectiveParam,
    goalId?: ObjectivePhase1Id,
    adIds?: [string, string],
  ): Promise<Insights> {
    const preset =
      period === '7d' ? '&date_preset=last_7d' :
      period === '30d' ? '&date_preset=last_30d' :
      period === 'all' ? '&date_preset=maximum' : ''
    // PRD §13 — 신규 4 goal 의 KPI 들이 actions[]/reach/frequency/cpm 을 추가로 요구.
    // engagement_page_likes/engagement_messages/leads_call 모두 도달·CPM 4-카드 셋이라 동일 fields 사용.
    const fields = ((): string => {
      if (goalId) {
        switch (goalId) {
          case 'awareness':              return 'impressions,reach,frequency,cpm,spend'
          case 'traffic':                return 'impressions,clicks,ctr,spend'
          case 'traffic_page_visit':     return 'impressions,clicks,ctr,spend,actions'
          case 'engagement':             return 'impressions,spend,actions'
          case 'engagement_page_likes':
          case 'engagement_messages':
          case 'leads_call':             return 'impressions,reach,frequency,cpm,spend,actions'
        }
      }
      switch (objective) {
        case 'OUTCOME_AWARENESS':  return 'impressions,reach,frequency,cpm,spend'
        case 'OUTCOME_ENGAGEMENT': return 'impressions,spend,actions'
        case 'OUTCOME_LEADS':      return 'impressions,reach,frequency,cpm,spend,actions'
        case 'OUTCOME_TRAFFIC':
        default:                   return 'impressions,clicks,ctr,spend'
      }
    })()
    const data = await graphFetch<{
      data: Array<{
        date_start: string
        impressions?: string
        clicks?: string
        ctr?: string
        spend?: string
        reach?: string
        frequency?: string
        cpm?: string
        actions?: Array<{ action_type?: string; value?: string }>
      }>
    }>(
      `/${campaignId}/insights` +
        `?fields=${fields}` +
        `&time_increment=1${preset}` +
        `&access_token=${token}`
    )

    const extractAction = (acts: Array<{ action_type?: string; value?: string }> | undefined, type: string): number => {
      if (!acts) return 0
      const f = acts.find((a) => a.action_type === type)
      return f ? Number(f.value ?? 0) : 0
    }

    // PRD §13 — goalId 별 daily action 추출. 같은 액션이 여러 goal 에서 노출될 수 있음(예: like).
    // 효과: 비-relevant goal 의 row 에는 undefined 로 빠져있어 KpiGrid 가 모든 가능성 처리 가능.
    const isPostEngagementGoal = goalId === 'engagement' || (!goalId && objective === 'OUTCOME_ENGAGEMENT')
    const isPageLikesGoal      = goalId === 'engagement_page_likes'
    const isMessagesGoal       = goalId === 'engagement_messages'
    const isCallGoal           = goalId === 'leads_call'
    const isPageVisitGoal      = goalId === 'traffic_page_visit'

    const daily = data.data.map((d) => ({
      date: d.date_start,
      impressions: d.impressions !== undefined ? Number(d.impressions) : undefined,
      clicks: Number(d.clicks ?? 0),
      ctr: parseFloat(d.ctr ?? '0'),
      spend: parseFloat(d.spend ?? '0'),
      reach: d.reach !== undefined ? Number(d.reach) : undefined,
      frequency: d.frequency !== undefined ? parseFloat(d.frequency) : undefined,
      cpm: d.cpm !== undefined ? parseFloat(d.cpm) : undefined,
      postEngagement: isPostEngagementGoal ? extractAction(d.actions, 'post_engagement') : undefined,
      postReaction:   isPostEngagementGoal ? extractAction(d.actions, 'post_reaction') : undefined,
      postComment:    isPostEngagementGoal ? extractAction(d.actions, 'comment') : undefined,
      postShare:      isPostEngagementGoal ? extractAction(d.actions, 'post') : undefined,
      landingPageView:               isPageVisitGoal ? extractAction(d.actions, 'landing_page_view') : undefined,
      pageLikeNew:                   isPageLikesGoal ? extractAction(d.actions, 'like') : undefined,
      messagingConversationsStarted: isMessagesGoal  ? extractAction(d.actions, 'onsite_conversion.messaging_conversation_started_7d') : undefined,
      callConfirm:                   isCallGoal      ? extractAction(d.actions, 'click_to_call_call_confirm') : undefined,
    }))

    const totals = daily.reduce(
      (acc, d) => ({
        impressions: acc.impressions,
        clicks: acc.clicks + d.clicks,
        spend: acc.spend + d.spend,
      }),
      { impressions: 0, clicks: 0, spend: 0 }
    )

    const impressionsTotal = data.data.reduce((s, d) => s + Number(d.impressions ?? 0), 0)
    const ctr = impressionsTotal > 0 ? (totals.clicks / impressionsTotal) * 100 : 0

    const reachTotal = data.data.reduce((s, d) => s + (d.reach !== undefined ? Number(d.reach) : 0), 0)
    const frequencyAvg = data.data.length > 0
      ? data.data.reduce((s, d) => s + (d.frequency !== undefined ? parseFloat(d.frequency) : 0), 0) / data.data.length
      : 0
    const cpmAvg = data.data.length > 0
      ? data.data.reduce((s, d) => s + (d.cpm !== undefined ? parseFloat(d.cpm) : 0), 0) / data.data.length
      : 0
    const sumAction = (type: string) => data.data.reduce((s, d) => s + extractAction(d.actions, type), 0)
    const postEngagementTotal = isPostEngagementGoal ? sumAction('post_engagement') : 0
    const postReactionTotal   = isPostEngagementGoal ? sumAction('post_reaction') : 0
    const postCommentTotal    = isPostEngagementGoal ? sumAction('comment') : 0
    const postShareTotal      = isPostEngagementGoal ? sumAction('post') : 0
    const pageLikeTotal       = isPostEngagementGoal ? sumAction('like') : 0

    // PRD §13 신규 goal totals.
    const landingPageViewTotal               = isPageVisitGoal ? sumAction('landing_page_view') : 0
    const pageLikeNewTotal                   = isPageLikesGoal ? sumAction('like') : 0
    const messagingConversationsStartedTotal = isMessagesGoal  ? sumAction('onsite_conversion.messaging_conversation_started_7d') : 0
    const callConfirmTotal                   = isCallGoal      ? sumAction('click_to_call_call_confirm') : 0

    // 도달·빈도·CPM 은 인지도뿐 아니라 페이지팔로우/메시지/전화 goal 에서도 KPI — 동일 카드 셋이라 같이 채움.
    const needsReachStats = objective === 'OUTCOME_AWARENESS' || isPageLikesGoal || isMessagesGoal || isCallGoal

    // PRD-ab-testing.md §7.2 — adIds 있으면 level=ad 추가 호출로 광고별 row 두 개. filtering 으로 두 adId 만.
    let ads: [AdInsightsRow, AdInsightsRow] | undefined
    if (adIds) {
      const adFiltering = encodeURIComponent(JSON.stringify([{ field: 'ad.id', operator: 'IN', value: adIds }]))
      const adData = await graphFetch<{
        data: Array<{ ad_id?: string; impressions?: string; clicks?: string; ctr?: string; spend?: string }>
      }>(
        `/${campaignId}/insights` +
          `?level=ad` +
          `&fields=ad_id,impressions,clicks,ctr,spend` +
          `&filtering=${adFiltering}` +
          (preset || '') +
          `&access_token=${token}`
      )
      const rows = adData.data ?? []
      const mapRow = (id: string): AdInsightsRow => {
        const r = rows.find((row) => row.ad_id === id)
        return {
          adId: id,
          impressions: Math.round(Number(r?.impressions ?? 0)),
          clicks: Math.round(Number(r?.clicks ?? 0)),
          ctr: r?.ctr != null ? Math.round(parseFloat(r.ctr) * 100) / 100 : 0,
          spend: Math.round(parseFloat(r?.spend ?? '0')),
        }
      }
      ads = [mapRow(adIds[0]), mapRow(adIds[1])]
    }

    return {
      impressions: impressionsTotal,
      clicks: totals.clicks,
      ctr: Math.round(ctr * 100) / 100,
      spend: Math.round(totals.spend),
      ...(needsReachStats ? {
        reach: reachTotal,
        frequency: Math.round(frequencyAvg * 100) / 100,
        cpm: Math.round(cpmAvg),
      } : {}),
      ...(isPostEngagementGoal ? {
        postEngagement: postEngagementTotal,
        postReaction: postReactionTotal,
        postComment: postCommentTotal,
        postShare: postShareTotal,
        pageLike: pageLikeTotal,
      } : {}),
      ...(isPageVisitGoal ? { landingPageView: landingPageViewTotal } : {}),
      ...(isPageLikesGoal ? { pageLikeNew: pageLikeNewTotal } : {}),
      ...(isMessagesGoal ? { messagingConversationsStarted: messagingConversationsStartedTotal } : {}),
      ...(isCallGoal ? { callConfirm: callConfirmTotal } : {}),
      daily,
      ...(ads ? { ads } : {}),
    }
  },

  // Meta uses POST /{id} instead of PATCH to update object fields.
  async setStatus(objectId: string, token: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    await graphFetch<{ success?: boolean }>(`/${objectId}`, {
      method: 'POST',
      body: JSON.stringify({ status, access_token: token }),
    })
  },

  async setAdSetDailyBudget(adSetId: string, token: string, dailyBudgetKrw: number): Promise<void> {
    await graphFetch<{ success?: boolean }>(`/${adSetId}`, {
      method: 'POST',
      body: JSON.stringify({ daily_budget: String(dailyBudgetKrw), access_token: token }),
    })
  },

  async pauseCampaign(campaignId: string, token: string): Promise<void> {
    await this.setStatus(campaignId, token, 'PAUSED')
  },

  // Resumes campaign + adset + ad — all three may have been created PAUSED.
  async resumeCampaign(campaignId: string, adSetId: string, adId: string, token: string): Promise<void> {
    await this.setStatus(campaignId, token, 'ACTIVE')
    await this.setStatus(adSetId, token, 'ACTIVE')
    if (adId) await this.setStatus(adId, token, 'ACTIVE')
  },

  async updateAdSet(
    adSetId: string,
    token: string,
    payload: {
      dailyBudget?: number
      startDate?: string
      endDate?: string | null
      targeting?: { ageMin?: number; ageMax?: number; genders?: number[]; countries?: string[] }
      bidStrategy?: BidStrategyParam
      bidAmount?: number | null
      platforms?: PlatformsParam
      placements?: PlacementsParam
    },
  ): Promise<string[]> {
    const body: Record<string, unknown> = { access_token: token }
    const applied: string[] = []
    if (payload.dailyBudget !== undefined) {
      body.daily_budget = String(payload.dailyBudget)
      applied.push('dailyBudget')
    }
    if (payload.startDate !== undefined) {
      body.start_time = toUnixKST(payload.startDate)
      applied.push('startDate')
    }
    if ('endDate' in payload) {
      body.end_time = payload.endDate ? toUnixKST(payload.endDate, true) : ''
      applied.push('endDate')
    }
    if (payload.bidStrategy !== undefined) {
      body.bid_strategy = payload.bidStrategy
      applied.push('bidStrategy')
    }
    if ('bidAmount' in payload) {
      body.bid_amount = payload.bidAmount != null ? String(payload.bidAmount) : null
      applied.push('bidAmount')
    }
    if (payload.targeting || payload.platforms !== undefined || payload.placements !== undefined) {
      const current = await graphFetch<{ targeting?: Record<string, unknown> }>(
        `/${adSetId}?fields=targeting&access_token=${token}`,
      )
      const base = { ...(current.targeting ?? {}) }
      if (payload.targeting) {
        const t = payload.targeting
        if (t.ageMin !== undefined) base.age_min = t.ageMin
        if (t.ageMax !== undefined) base.age_max = t.ageMax
        if (t.genders !== undefined) base.genders = t.genders.length > 0 ? t.genders : undefined
        if (t.countries !== undefined) base.geo_locations = { countries: t.countries }
        applied.push('targeting')
      }
      if (payload.platforms !== undefined) {
        base.publisher_platforms = payload.platforms === 'both' ? undefined
          : payload.platforms === 'facebook' ? ['facebook']
          : ['instagram']
        applied.push('platforms')
      }
      if (payload.placements !== undefined) {
        const merged = { ...buildPlacementTargeting(payload.placements) }
        Object.assign(base, merged)
        applied.push('placements')
      }
      body.targeting = base
    }
    await graphFetch<{ success?: boolean }>(`/${adSetId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return applied
  },

  async replaceAdCreative(
    adId: string,
    token: string,
    accountId: string,
    params: { headline: string; primaryText: string; imageDataUrl?: string; reuseExistingImage?: boolean },
  ): Promise<{ newCreativeId: string }> {
    type RawAd = {
      creative?: {
        id?: string
        object_story_spec?: {
          page_id?: string
          link_data?: { link?: string; call_to_action?: Record<string, unknown>; image_hash?: string }
        }
      }
    }
    const ad = await graphFetch<RawAd>(
      `/${adId}?fields=creative{id,object_story_spec{page_id,link_data{link,call_to_action,image_hash}}}&access_token=${token}`,
    )
    const spec = ad.creative?.object_story_spec
    const pageId = spec?.page_id ?? ''
    const linkData = spec?.link_data ?? {}
    if (!pageId) throw new Error('광고 크리에이티브 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.')

    const imageHash = params.imageDataUrl
      ? await uploadAdImage(params.imageDataUrl, token, accountId)
      : params.reuseExistingImage
        ? (linkData.image_hash ?? undefined)
        : undefined

    const newCreative = await graphFetch<{ id: string }>(`/${accountId}/adcreatives`, {
      method: 'POST',
      body: JSON.stringify({
        name: `AdFlow Creative — ${params.headline}`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            message: params.primaryText,
            link: linkData.link,
            name: params.headline,
            call_to_action: linkData.call_to_action,
            ...(imageHash ? { image_hash: imageHash } : {}),
          },
        },
        access_token: token,
      }),
    })

    await graphFetch<{ success?: boolean }>(`/${adId}`, {
      method: 'POST',
      body: JSON.stringify({ creative: { creative_id: newCreative.id }, access_token: token }),
    })

    return { newCreativeId: newCreative.id }
  },

  async boostPost(
    params: {
      igMediaId: string; igUserId: string; dailyBudget: number; startDate: string; endDate: string
      ageMin: number; ageMax: number; genders?: number[]; countries: string[]
      status: 'ACTIVE' | 'PAUSED'; pageId: string
      boostGoal?: 'engagement' | 'profile' | 'website' | 'message'
      landingUrl?: string
    },
    token: string, accountId: string, pageId: string,
  ): Promise<CampaignResult> {
    const { igMediaId, igUserId, dailyBudget, startDate, endDate, ageMin, ageMax, genders, countries, status, boostGoal = 'engagement', landingUrl } = params

    const BOOST_GOAL_MAP: Record<string, { optimizationGoal: string; destinationType?: string }> = {
      engagement: { optimizationGoal: 'POST_ENGAGEMENT' },
      profile:    { optimizationGoal: 'PROFILE_VISIT' },
      website:    { optimizationGoal: 'LINK_CLICKS', destinationType: 'WEBSITE' },
      message:    { optimizationGoal: 'CONVERSATIONS' },
    }
    const { optimizationGoal, destinationType } = BOOST_GOAL_MAP[boostGoal] ?? BOOST_GOAL_MAP.engagement

    const campaign = await graphFetch<{ id: string }>(`/act_${accountId}/campaigns`, {
      method: 'POST',
      body: JSON.stringify({
        objective: 'OUTCOME_ENGAGEMENT',
        name: `AdFlow Boost — ${igMediaId}`,
        status,
        special_ad_categories: [],
        access_token: token,
      }),
    })

    const adSet = await graphFetch<{ id: string }>(`/act_${accountId}/adsets`, {
      method: 'POST',
      body: JSON.stringify({
        campaign_id: campaign.id,
        name: `AdFlow Boost AdSet — ${igMediaId}`,
        optimization_goal: optimizationGoal,
        ...(destinationType ? { destination_type: destinationType } : {}),
        billing_event: 'IMPRESSIONS',
        daily_budget: dailyBudget,
        start_time: new Date(`${startDate}T00:00:00+09:00`).toISOString(),
        end_time: new Date(`${endDate}T23:59:59+09:00`).toISOString(),
        targeting: {
          age_min: ageMin,
          age_max: ageMax,
          ...(genders?.length ? { genders } : {}),
          geo_locations: { countries },
        },
        promoted_object: { page_id: pageId, instagram_media_id: igMediaId },
        status,
        access_token: token,
      }),
    })

    const creative = await graphFetch<{ id: string }>(`/act_${accountId}/adcreatives`, {
      method: 'POST',
      body: JSON.stringify({
        name: `AdFlow Boost Creative — ${igMediaId}`,
        object_story_id: `${igUserId}_${igMediaId}`,
        ...(boostGoal === 'website' && landingUrl ? { object_story_spec: undefined, link_url: landingUrl } : {}),
        access_token: token,
      }),
    })

    const ad = await graphFetch<{ id: string }>(`/act_${accountId}/ads`, {
      method: 'POST',
      body: JSON.stringify({
        name: `AdFlow Boost Ad — ${igMediaId}`,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status,
        access_token: token,
      }),
    })

    return { campaignId: campaign.id, adSetId: adSet.id, adId: ad.id }
  },
}
