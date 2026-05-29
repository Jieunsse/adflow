// Server-side only — campaign CRUD operations. Do not import from client components.

import { OBJECTIVES_PHASE1, type ObjectivePhase1Id } from '@entities/creative/options'
import { graphFetch } from './meta-ads-graph'

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
  location?: string[]  // Persona 자유 태그 — V1: geo_locations.countries 에 추가, Meta 오류 시 무시
  linkUrl: string
  ctaType: string      // Meta call_to_action.type e.g. LEARN_MORE, SHOP_NOW
  status: 'ACTIVE' | 'PAUSED'
  imageDataUrl?: string // optional — data:image/...;base64,...
  phoneNumber?: string  // leads_call 전용 — promoted_object.phone_number + CTA value.link(tel:) 에 주입
  brandName?: string    // 캠페인 이름 조합용 (최대 20자)

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
export function buildPlacementTargeting(p?: PlacementsParam): Record<string, unknown> {
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
    if (goalDef.promotedObject === 'page') {
      promotedObject = { page_id: pageId }
      // leads_call 은 전화번호를 promoted_object 에 포함해야 Meta가 PHONE_CALL destination 을 수락함.
      if (goalDef.id === 'leads_call' && params.phoneNumber) {
        promotedObject.phone_number = params.phoneNumber
      }
    }
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
  const goalDef = params.goalId ? OBJECTIVES_PHASE1.find((g) => g.id === params.goalId) : null
  const goalLabel = goalDef?.label ?? plan.objective.replace('OUTCOME_', '')
  const mmdd = params.startDate.slice(5, 7) + params.startDate.slice(8, 10)
  const brandPart = params.brandName ? ` — ${params.brandName}` : ''
  return {
    name: `AdFlow${brandPart} — ${goalLabel} — ${params.headline} — ${mmdd}`,
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
      geo_locations: { countries: [...params.countries, ...(params.location ?? [])] },
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

// PRD §13 — Messenger 광고는 app_destination = 'MESSENGER', CALL_NOW 는 tel: 링크가 필요.
function buildCtaForCreative(ctaType: string, phoneNumber?: string): Record<string, unknown> {
  if (ctaType === 'MESSAGE_PAGE') {
    return { type: ctaType, value: { app_destination: 'MESSENGER' } }
  }
  if (ctaType === 'CALL_NOW' && phoneNumber) {
    return { type: ctaType, value: { link: `tel:${phoneNumber}` } }
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
        call_to_action: buildCtaForCreative(params.ctaType, params.phoneNumber),
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

export const metaAdsCampaign = {
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
      // graphFetch 가 MetaError 를 plain Error 메시지로 평탄화하므로 진단용으로 코드/서브코드를 재추출.
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
    await metaAdsCampaign.setStatus(campaignId, token, 'PAUSED')
  },

  // Resumes campaign + adset + ad — all three may have been created PAUSED.
  async resumeCampaign(campaignId: string, adSetId: string, adId: string, token: string): Promise<void> {
    await metaAdsCampaign.setStatus(campaignId, token, 'ACTIVE')
    await metaAdsCampaign.setStatus(adSetId, token, 'ACTIVE')
    if (adId) await metaAdsCampaign.setStatus(adId, token, 'ACTIVE')
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
