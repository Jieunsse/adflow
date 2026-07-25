import { NextRequest, NextResponse } from 'next/server'
import { metaAds } from '@/lib/meta-ads'
import { withMetaSession } from '@/lib/meta-session'
import { ValidationError } from '@/lib/route-handler'
import { COUNTRY_CODES } from '@shared/lib/geo-options'

const MIN_DAILY_BUDGET_KRW = 10_000

type BoostGoal = 'engagement' | 'profile' | 'website' | 'message'

type BoostPostBody = {
  igMediaId?: string
  dailyBudget?: number
  startDate?: string
  endDate?: string
  ageMin?: number
  ageMax?: number
  genders?: number[]
  countries?: string[]
  status?: 'ACTIVE' | 'PAUSED'
  boostGoal?: BoostGoal
  landingUrl?: string
}

export const POST = withMetaSession(['adAccount', 'page', 'ig'], async (req: NextRequest, s) => {
    const { accessToken, adAccountId, pageId, igUserId } = s
    const body = (await req.json()) as BoostPostBody

    if (!body.igMediaId || typeof body.igMediaId !== 'string') {
      throw new ValidationError('홍보할 게시물을 선택해주세요.')
    }
    if (typeof body.dailyBudget !== 'number' || !Number.isFinite(body.dailyBudget) || body.dailyBudget < MIN_DAILY_BUDGET_KRW) {
      throw new ValidationError(`일일 예산은 최소 ₩${MIN_DAILY_BUDGET_KRW.toLocaleString('ko-KR')} 이상이어야 해요.`)
    }
    if (!body.startDate || !body.endDate) {
      throw new ValidationError('시작일과 종료일을 입력해주세요.')
    }

    const countries = Array.isArray(body.countries)
      ? Array.from(new Set(body.countries.filter((c) => typeof c === 'string' && COUNTRY_CODES.has(c))))
      : []
    if (countries.length === 0) {
      throw new ValidationError('타겟 지역(국가)을 최소 한 곳 선택해주세요.')
    }

    const genders = Array.isArray(body.genders)
      ? Array.from(new Set(body.genders.filter((g) => g === 1 || g === 2)))
      : []

    const VALID_BOOST_GOALS: BoostGoal[] = ['engagement', 'profile', 'website', 'message']
    const boostGoal: BoostGoal = VALID_BOOST_GOALS.includes(body.boostGoal as BoostGoal) ? (body.boostGoal as BoostGoal) : 'engagement'

    if (boostGoal === 'website') {
      if (!body.landingUrl || !body.landingUrl.startsWith('https://')) {
        throw new ValidationError('웹사이트 방문 유도 방식은 https://로 시작하는 랜딩 URL이 필요해요.')
      }
    }

    const status = body.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'
    if (status === 'ACTIVE') {
      const today = new Date().toISOString().slice(0, 10)
      if (body.startDate < today) {
        throw new ValidationError('지금 바로 게재하려면 시작일이 오늘 이후여야 해요.')
      }
    }

    const result = await metaAds.boostPost(
      {
        igMediaId: body.igMediaId,
        igUserId,
        dailyBudget: body.dailyBudget,
        startDate: body.startDate,
        endDate: body.endDate,
        ageMin: body.ageMin ?? 18,
        ageMax: body.ageMax ?? 65,
        genders,
        countries,
        status,
        pageId,
        boostGoal,
        landingUrl: body.landingUrl,
      },
      accessToken,
      adAccountId,
      pageId,
    )
    return NextResponse.json(result)
})
