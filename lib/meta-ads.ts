// Server-side only — do not import from client components; access tokens would be exposed.

import { AuthError } from './route-handler'

const GRAPH = 'https://graph.facebook.com/v20.0'

export type MetaObjectiveParam = 'OUTCOME_TRAFFIC' | 'OUTCOME_AWARENESS' | 'OUTCOME_ENGAGEMENT'
export type BidStrategyParam = 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP'
export type PlacementsParam = { mode: 'auto' } | { mode: 'manual'; positions: string[] }
export type PlatformsParam = 'both' | 'facebook' | 'instagram'

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

  // PRD-create-modes-and-objectives §5.5 — objective/bid/placement branching
  objective?: MetaObjectiveParam     // defaults to OUTCOME_TRAFFIC when omitted
  bidStrategy?: BidStrategyParam     // defaults to LOWEST_COST_WITHOUT_CAP when omitted
  bidAmount?: number                  // KRW — only used when bidStrategy is a cap variant
  placements?: PlacementsParam        // defaults to auto (Advantage+) when omitted
  platforms?: PlatformsParam          // omitted or 'both' = let Meta auto-select publisher_platforms
  pixelId?: string                    // optional — adds tracking_specs for passive pixel event tracking
  mode?: 'simple' | 'detailed'
  // Meta 앱 개발 모드 호환 — POST /adcreatives 가 subcode 1885183 으로 막혀서 Campaign + AdSet 까지만 생성하고 종료
  skipAdCreation?: boolean
}

export interface CampaignResult {
  campaignId: string
  adSetId: string
  adId?: string
}

export interface InsightsResult {
  impressions: number
  spend: number
  clicks: number
  ctr: number
  // Awareness-objective fields — only populated for that objective
  reach?: number
  frequency?: number
  cpm?: number
  // Engagement-objective fields — extracted from the actions array
  postEngagement?: number
  postReaction?: number
  postComment?: number
  postShare?: number
  pageLike?: number
  daily: Array<{
    date: string
    clicks: number
    ctr: number
    spend: number
    impressions?: number
    reach?: number
    frequency?: number
    cpm?: number
    postEngagement?: number
    postReaction?: number
    postComment?: number
    postShare?: number
  }>
}

export interface AccountStatus {
  connected: boolean
  accountId: string
  accountName: string
  currency: string
}

export type CampaignStatusBucket = 'live' | 'review' | 'paused' | 'ended' | 'issue'
export type InsightsPeriod = '7d' | '30d' | 'all'

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

const OPTIMIZATION_GOAL_BY_OBJECTIVE: Record<MetaObjectiveParam, string> = {
  OUTCOME_TRAFFIC:    'LINK_CLICKS',
  OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
  OUTCOME_AWARENESS:  'REACH',
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

interface RawCampaign {
  id: string
  name: string
  effective_status?: string
  objective?: string
  start_time?: string
  stop_time?: string
  daily_budget?: string
  adsets?: { data?: Array<{ id: string; daily_budget?: string; ads?: { data?: Array<{ id: string }> } }> }
  insights?: { data?: Array<{ impressions?: string; clicks?: string; ctr?: string; spend?: string }> }
}

const CAMPAIGN_FIELDS = (period: InsightsPeriod) => [
  'id', 'name', 'effective_status', 'objective', 'start_time', 'stop_time', 'daily_budget',
  'adsets.limit(1){id,daily_budget,ads.limit(1){id}}',
  `insights.date_preset(${presetFor(period)}){impressions,clicks,ctr,spend}`,
].join(',')

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
  }
}

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

  async createCampaign(params: CreateCampaignParams, token: string, accountId: string, pageId: string): Promise<CampaignResult> {
    if (!pageId) {
      throw new Error('광고를 게재하려면 페이스북 페이지를 먼저 선택해야 해요.')
    }
    if (!params.countries || params.countries.length === 0) {
      throw new Error('타겟 지역(국가)을 최소 한 곳 선택해야 해요.')
    }
    const status = params.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'

    const imageHash = params.imageDataUrl
      ? await uploadAdImage(params.imageDataUrl, token, accountId)
      : undefined

    const objective: MetaObjectiveParam = params.objective ?? 'OUTCOME_TRAFFIC'
    const optimizationGoal = params.mode === 'simple' && objective === 'OUTCOME_TRAFFIC'
      ? 'LANDING_PAGE_VIEWS'
      : OPTIMIZATION_GOAL_BY_OBJECTIVE[objective]
    const bidStrategy: BidStrategyParam = params.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP'
    const manualPlacement = buildPlacementTargeting(params.placements)
    // Manual placements already encode publisher_platforms per position; only fall back
    // to the platform picker when no manual positions are set.
    const placement = Object.keys(manualPlacement).length > 0
      ? manualPlacement
      : buildPlatformOnlyTargeting(params.platforms)

    const campaign = await graphFetch<{ id: string }>(`/${accountId}/campaigns`, {
      method: 'POST',
      body: JSON.stringify({
        name: `AdFlow — ${params.headline}`,
        objective,
        status,
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
        access_token: token,
      }),
    })

    // On failure after the campaign is created, delete it so the ad account is left clean.
    try {
      const adSet = await graphFetch<{ id: string }>(`/${accountId}/adsets`, {
        method: 'POST',
        body: JSON.stringify({
          name: `AdFlow AdSet — ${params.headline}`,
          campaign_id: campaign.id,
          billing_event: 'IMPRESSIONS',
          optimization_goal: optimizationGoal,
          bid_strategy: bidStrategy,
          ...(bidStrategy !== 'LOWEST_COST_WITHOUT_CAP' && params.bidAmount
            ? { bid_amount: String(params.bidAmount) }
            : {}),
          daily_budget: String(params.dailyBudget),
          ...(objective === 'OUTCOME_TRAFFIC' ? { destination_type: 'WEBSITE' } : {}),
          targeting: {
            age_min: params.ageMin,
            age_max: params.ageMax,
            ...(params.genders && params.genders.length > 0 ? { genders: params.genders } : {}),
            geo_locations: { countries: params.countries },
            targeting_automation: { advantage_audience: params.mode === 'simple' ? 1 : 0 },
            ...placement,
          },
          start_time: toUnixKST(params.startDate),
          end_time: toUnixKST(params.endDate, true),
          status,
          ...(params.pixelId ? { tracking_specs: [{ 'action.type': ['offsite_conversion'], 'fb.pixel': [params.pixelId] }] } : {}),
          access_token: token,
        }),
      })

      // Meta 앱 개발 모드 호환 — Ad Creative/Ad 단계는 공개 모드 앱만 허용되므로 여기서 종료
      if (params.skipAdCreation) {
        return { campaignId: campaign.id, adSetId: adSet.id }
      }

      const creative = await graphFetch<{ id: string }>(`/${accountId}/adcreatives`, {
        method: 'POST',
        body: JSON.stringify({
          name: `AdFlow Creative — ${params.headline}`,
          object_story_spec: {
            page_id: pageId,
            link_data: {
              message: params.primaryText,
              link: params.linkUrl,
              name: params.headline,
              call_to_action: { type: params.ctaType },
              ...(imageHash ? { image_hash: imageHash } : {}),
            },
          },
          ...(params.mode === 'simple' ? { degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_IN' } } } } : {}),
          access_token: token,
        }),
      })

      const ad = await graphFetch<{ id: string }>(`/${accountId}/ads`, {
        method: 'POST',
        body: JSON.stringify({
          name: `AdFlow Ad — ${params.headline}`,
          adset_id: adSet.id,
          creative: { creative_id: creative.id },
          status,
          access_token: token,
        }),
      })

      return { campaignId: campaign.id, adSetId: adSet.id, adId: ad.id }
    } catch (err) {
      try {
        await graphFetch<{ success?: boolean }>(`/${campaign.id}?access_token=${token}`, { method: 'DELETE' })
      } catch {
        // Cleanup failure is intentionally swallowed; we re-throw the original error.
      }
      throw err
    }
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

  async getInsights(campaignId: string, token: string, period?: InsightsPeriod, objective?: MetaObjectiveParam): Promise<InsightsResult> {
    const preset =
      period === '7d' ? '&date_preset=last_7d' :
      period === '30d' ? '&date_preset=last_30d' :
      period === 'all' ? '&date_preset=maximum' : ''
    const fields = ((): string => {
      switch (objective) {
        case 'OUTCOME_AWARENESS':  return 'impressions,reach,frequency,cpm,spend'
        case 'OUTCOME_ENGAGEMENT': return 'impressions,spend,actions'
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

    const daily = data.data.map((d) => ({
      date: d.date_start,
      impressions: d.impressions !== undefined ? Number(d.impressions) : undefined,
      clicks: Number(d.clicks ?? 0),
      ctr: parseFloat(d.ctr ?? '0'),
      spend: parseFloat(d.spend ?? '0'),
      reach: d.reach !== undefined ? Number(d.reach) : undefined,
      frequency: d.frequency !== undefined ? parseFloat(d.frequency) : undefined,
      cpm: d.cpm !== undefined ? parseFloat(d.cpm) : undefined,
      postEngagement: objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'post_engagement') : undefined,
      postReaction:   objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'post_reaction') : undefined,
      postComment:    objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'comment') : undefined,
      postShare:      objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'post') : undefined,
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
    const postEngagementTotal = data.data.reduce((s, d) => s + (objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'post_engagement') : 0), 0)
    const postReactionTotal   = data.data.reduce((s, d) => s + (objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'post_reaction') : 0), 0)
    const postCommentTotal    = data.data.reduce((s, d) => s + (objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'comment') : 0), 0)
    const postShareTotal      = data.data.reduce((s, d) => s + (objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'post') : 0), 0)
    const pageLikeTotal       = data.data.reduce((s, d) => s + (objective === 'OUTCOME_ENGAGEMENT' ? extractAction(d.actions, 'like') : 0), 0)

    return {
      impressions: impressionsTotal,
      clicks: totals.clicks,
      ctr: Math.round(ctr * 100) / 100,
      spend: Math.round(totals.spend),
      ...(objective === 'OUTCOME_AWARENESS' ? {
        reach: reachTotal,
        frequency: Math.round(frequencyAvg * 100) / 100,
        cpm: Math.round(cpmAvg),
      } : {}),
      ...(objective === 'OUTCOME_ENGAGEMENT' ? {
        postEngagement: postEngagementTotal,
        postReaction: postReactionTotal,
        postComment: postCommentTotal,
        postShare: postShareTotal,
        pageLike: pageLikeTotal,
      } : {}),
      daily,
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
}
