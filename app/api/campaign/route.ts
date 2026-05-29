import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metaAds, type MetaObjectiveParam, type BidStrategyParam, type PlacementsParam, type PlatformsParam, type AbTestAxisParam, type AbTestVariantBParam } from '@/lib/meta-ads'
import { resolveAdAccountId, resolveAccessToken } from '@/lib/env'
import { withRouteHandler, ValidationError } from '@/lib/route-handler'
import { CTA_META_TYPE, OBJECTIVES_PHASE1, type CtaId, type ObjectivePhase1Id } from '@entities/creative/options'
import { COUNTRY_CODES } from '@shared/lib/geo-options'

const MIN_DAILY_BUDGET_KRW = 10_000
// base64-encoded 3 MB image ≈ 4 MB with data URL prefix overhead
const MAX_IMAGE_DATA_URL_LEN = 4_300_000
// Meta can't crawl images from sites that block its bot; proxy the og:image ourselves
const MAX_OG_IMAGE_BYTES = 3 * 1024 * 1024

async function fetchOgImageAsDataUrl(pageUrl: string): Promise<string | undefined> {
  try {
    const pageRes = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdFlowBot/1.0)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!pageRes.ok) return undefined
    const html = await pageRes.text()
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (!m?.[1]) return undefined
    const imageUrl = new URL(m[1], pageUrl).href
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(6000) })
    if (!imgRes.ok) return undefined
    const buf = await imgRes.arrayBuffer()
    if (buf.byteLength > MAX_OG_IMAGE_BYTES) return undefined
    const mime = imgRes.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return undefined
  }
}

// PRD §13 — leads_call goal 추가로 OUTCOME_LEADS 도 합법 objective.
const VALID_OBJECTIVES: ReadonlySet<MetaObjectiveParam> = new Set(['OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS'])
const VALID_GOAL_IDS: ReadonlySet<string> = new Set(OBJECTIVES_PHASE1.map((g) => g.id))
const VALID_BID_STRATEGIES: ReadonlySet<BidStrategyParam> = new Set(['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'])
const VALID_PLATFORMS: ReadonlySet<PlatformsParam> = new Set(['both', 'facebook', 'instagram'])
const VALID_PLACEMENT_POSITIONS = new Set([
  'facebook_feed', 'instagram_feed', 'instagram_stories', 'audience_network', 'messenger',
])

type CampaignRequestBody = {
  headline?: string
  primaryText?: string
  dailyBudget?: number
  startDate?: string
  endDate?: string
  ageMin?: number
  ageMax?: number
  genders?: number[]
  countries?: string[]
  linkUrl?: string
  cta?: CtaId
  status?: 'ACTIVE' | 'PAUSED'
  imageDataUrl?: string
  objective?: string
  goalId?: string
  mode?: 'simple' | 'detailed'
  bidStrategy?: string
  bidAmount?: number
  placements?: { mode: 'auto' } | { mode: 'manual'; positions: string[] }
  platforms?: string
  // PRD-ab-testing.md §4 — A/B 축 + 변형. Phase 1 = headline 만 실제 분기.
  abTestEnabled?: boolean
  abTestAxis?: string
  abTestVariantB?: { axis?: string; headline?: string; primaryText?: string; imageDataUrl?: string }
  skipAdCreation?: boolean
  location?: string[]
  brandName?: string
}

const VALID_AB_AXES: ReadonlySet<AbTestAxisParam> = new Set(['headline', 'primary_text', 'image'])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken || !session?.adAccountId || !session?.pageId) {
    return NextResponse.json(
      { error: '광고 계정과 페이스북 페이지를 먼저 선택해주세요.' },
      { status: 401 },
    )
  }
  const { pageId, pixelId } = session
  const accessToken = resolveAccessToken(session.accessToken)
  const adAccountId = resolveAdAccountId(session.adAccountId)
  return withRouteHandler(true, '', async () => {
      const body = (await req.json()) as CampaignRequestBody
      const { headline, primaryText, dailyBudget, startDate, endDate, ageMin, ageMax, linkUrl, cta, imageDataUrl, location, brandName } = body

      const skipAdCreation = body.skipAdCreation === true
      if (skipAdCreation && process.env.NEXT_PUBLIC_META_APP_MODE !== 'development') {
        throw new ValidationError('이 기능은 Meta App 개발 모드 환경에서만 사용할 수 있어요.')
      }

      const genders = Array.isArray(body.genders)
        ? Array.from(new Set(body.genders.filter((g) => g === 1 || g === 2)))
        : []
      const countries = Array.isArray(body.countries)
        ? Array.from(new Set(body.countries.filter((c) => typeof c === 'string' && COUNTRY_CODES.has(c))))
        : []
      if (countries.length === 0) {
        throw new ValidationError('타겟 지역(국가)을 최소 한 곳 선택해주세요.')
      }

      if (!headline || !dailyBudget || !startDate || !endDate) {
        throw new ValidationError('필수 필드가 누락됐어요.')
      }
      // Ad Creative 단계에서만 쓰이는 필드 — skip 모드에선 검증 생략
      if (!skipAdCreation) {
        if (!primaryText || !linkUrl) {
          throw new ValidationError('필수 필드가 누락됐어요.')
        }
        let parsedUrl: URL
        try {
          parsedUrl = new URL(linkUrl)
        } catch {
          throw new ValidationError('랜딩 URL 형식이 올바르지 않아요.')
        }
        if (parsedUrl.protocol !== 'https:') {
          throw new ValidationError('랜딩 URL 은 https:// 로 시작해야 해요.')
        }
      }

      if (typeof dailyBudget !== 'number' || !Number.isFinite(dailyBudget) || dailyBudget < MIN_DAILY_BUDGET_KRW) {
        throw new ValidationError(`일일 예산은 최소 ₩${MIN_DAILY_BUDGET_KRW.toLocaleString('ko-KR')} 이상이어야 해요.`)
      }

      // skip 모드는 Ad Creative 가 없으므로 ACTIVE 가 무의미 — PAUSED 강제
      const status = skipAdCreation
        ? 'PAUSED'
        : body.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'
      if (status === 'ACTIVE') {
        const today = new Date().toISOString().slice(0, 10)
        if (startDate < today) {
          throw new ValidationError('지금 바로 게재하려면 시작일이 오늘 이후여야 해요.')
        }
      }

      if (imageDataUrl !== undefined) {
        if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
          throw new ValidationError('업로드한 이미지 형식을 인식할 수 없어요.')
        }
        if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LEN) {
          throw new ValidationError('이미지 용량은 3MB 이하여야 해요. (JPEG 권장)')
        }
      }

      // skip 모드는 og:image fetch 도 불필요 — Ad Creative 가 안 만들어짐
      const resolvedImageDataUrl = skipAdCreation
        ? undefined
        : imageDataUrl ?? (linkUrl ? await fetchOgImageAsDataUrl(linkUrl) : undefined)

      const ctaType = (cta && CTA_META_TYPE[cta]) || 'LEARN_MORE'

      // Invalid detail-mode values fall through to defaults rather than rejecting the whole request.
      const isSimple = body.mode === 'simple'
      // PRD §13 — goalId 가 있으면 meta-ads 가 OBJECTIVES_PHASE1 entry 에서 derive. 없거나 invalid 면 objective 폴백.
      const goalId: ObjectivePhase1Id | undefined =
        body.goalId && VALID_GOAL_IDS.has(body.goalId) ? (body.goalId as ObjectivePhase1Id) : undefined
      const objective: MetaObjectiveParam = isSimple
        ? 'OUTCOME_TRAFFIC'
        : body.objective && VALID_OBJECTIVES.has(body.objective as MetaObjectiveParam)
          ? (body.objective as MetaObjectiveParam)
          : 'OUTCOME_TRAFFIC'
      const bidStrategy: BidStrategyParam =
        body.bidStrategy && VALID_BID_STRATEGIES.has(body.bidStrategy as BidStrategyParam)
          ? (body.bidStrategy as BidStrategyParam)
          : 'LOWEST_COST_WITHOUT_CAP'
      const bidAmount =
        bidStrategy !== 'LOWEST_COST_WITHOUT_CAP' && typeof body.bidAmount === 'number' && Number.isFinite(body.bidAmount) && body.bidAmount > 0
          ? body.bidAmount
          : undefined
      let placements: PlacementsParam | undefined
      if (body.placements?.mode === 'manual' && Array.isArray(body.placements.positions)) {
        const positions = body.placements.positions.filter((p) => typeof p === 'string' && VALID_PLACEMENT_POSITIONS.has(p))
        placements = positions.length > 0 ? { mode: 'manual', positions } : { mode: 'auto' }
      } else {
        placements = { mode: 'auto' }
      }
      const platforms: PlatformsParam = !isSimple && body.platforms && VALID_PLATFORMS.has(body.platforms as PlatformsParam)
        ? (body.platforms as PlatformsParam)
        : 'both'

      // PRD-ab-testing.md §4 — A/B 시험. 축 일반화 (Phase 1 = headline 만 실제 분기).
      // v0.2 Q4 (§7.5) — !skipAdCreation 게이트 제거. 개발모드에서도 A/B 분기 활성화, route 가 fake adIds 합성.
      // Invalid 입력은 ValidationError — silent fall-through 안 함.
      let abTestAxis: AbTestAxisParam | undefined
      let abTestVariantB: AbTestVariantBParam | undefined
      const abTestEnabled = !isSimple && body.abTestEnabled === true
      if (abTestEnabled) {
        const axisRaw = typeof body.abTestAxis === 'string' ? body.abTestAxis : 'headline'
        if (!VALID_AB_AXES.has(axisRaw as AbTestAxisParam)) {
          throw new ValidationError('A/B 시험 축 값이 올바르지 않아요.')
        }
        const axis = axisRaw as AbTestAxisParam
        if (axis !== 'headline') {
          throw new ValidationError(`A/B 시험 축 '${axis}' 은 아직 지원되지 않아요 (현재는 헤드라인만).`)
        }
        const variantB = body.abTestVariantB
        const variantBHeadline = typeof variantB?.headline === 'string' ? variantB.headline.trim() : ''
        if (!variantBHeadline || variantB?.axis !== 'headline') {
          throw new ValidationError('A/B 시험을 켜면 B안 헤드라인이 필요해요.')
        }
        if (variantBHeadline === headline.trim()) {
          throw new ValidationError('A/B 시험의 두 헤드라인이 같아요. B안을 다른 헤드라인으로 골라주세요.')
        }
        abTestAxis = axis
        abTestVariantB = { axis: 'headline', headline: variantBHeadline }
      }

      // leads_call 목표는 전화번호를 Meta AdSet.promoted_object 와 CTA value 에 주입해야 함.
      let phoneNumber: string | undefined
      if (goalId === 'leads_call' && pageId) {
        try {
          const phoneRes = await fetch(
            `https://graph.facebook.com/v20.0/${pageId}?fields=phone&access_token=${accessToken}`,
            { signal: AbortSignal.timeout(5000) }
          )
          if (phoneRes.ok) {
            const phoneData = (await phoneRes.json()) as { phone?: string }
            phoneNumber = phoneData.phone ?? undefined
          }
        } catch { /* 전화번호 조회 실패 시 무시 — Meta 가 없는 전화번호로 거절 */ }
      }

      const campaignParams = {
        headline,
        primaryText: primaryText ?? '',
        dailyBudget,
        startDate,
        endDate,
        ageMin: ageMin ?? 18,
        ageMax: ageMax ?? 65,
        genders,
        countries,
        linkUrl: linkUrl ?? '',
        ctaType,
        status: status as 'ACTIVE' | 'PAUSED',
        imageDataUrl: resolvedImageDataUrl,
        objective,
        goalId,
        bidStrategy,
        bidAmount,
        placements,
        platforms,
        abTestEnabled: abTestEnabled || undefined,
        abTestAxis,
        abTestVariantB,
        pixelId,
        mode: body.mode,
        skipAdCreation,
        phoneNumber,
        brandName: typeof brandName === 'string' ? brandName.slice(0, 20) : undefined,
      }
      const extraLocation = Array.isArray(location) && location.length > 0
        ? location.map(String)
        : undefined

      let result
      if (extraLocation) {
        try {
          result = await metaAds.createCampaign({ ...campaignParams, location: extraLocation }, accessToken, adAccountId, pageId)
        } catch {
          result = await metaAds.createCampaign(campaignParams, accessToken, adAccountId, pageId)
        }
      } else {
        result = await metaAds.createCampaign(campaignParams, accessToken, adAccountId, pageId)
      }

      // PRD-ab-testing.md §7.5 — 개발모드 + A/B 활성 시 fake adIds 두 개 합성.
      // lib/meta-ads.ts 는 skipAdCreation 시 adSet 까지만 만들고 끝. route 가 mock_ad_{campaignId}_a/b 발급.
      // getMockInsights 가 이 prefix 로 광고별 시드 진입.
      if (abTestEnabled && skipAdCreation && !result.adIds) {
        const fakeAdIds: [string, string] = [`mock_ad_${result.campaignId}_a`, `mock_ad_${result.campaignId}_b`]
        return NextResponse.json({ ...result, adIds: fakeAdIds })
      }
      return NextResponse.json(result)
    })
}
