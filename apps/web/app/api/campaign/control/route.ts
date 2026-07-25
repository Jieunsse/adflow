import { NextRequest, NextResponse } from 'next/server'
import { metaAds } from '@/lib/meta-ads'
import { withMetaSession } from '@/lib/meta-session'
import { ValidationError } from '@/lib/route-handler'

const MIN_DAILY_BUDGET_KRW = 10_000

type ControlBody = {
  campaignId?: string
  adSetId?: string
  adId?: string
  action?: 'pause' | 'resume' | 'set-daily-budget'
  dailyBudget?: number
}

export const POST = withMetaSession(['adAccount'], async (req: NextRequest, s) => {
    const { accessToken } = s
    const body = (await req.json()) as ControlBody
    const { campaignId, adSetId, adId, action, dailyBudget } = body

    if (!campaignId || !action) {
      throw new ValidationError('필수 값이 누락됐어요 (campaignId, action).')
    }

    if (action === 'pause') {
      await metaAds.pauseCampaign(campaignId, accessToken)
      return NextResponse.json({ ok: true, status: 'PAUSED' as const })
    }

    if (action === 'resume') {
      if (!adSetId) throw new ValidationError('재개하려면 adSetId 가 필요해요.')
      await metaAds.resumeCampaign(campaignId, adSetId, adId ?? '', accessToken)
      return NextResponse.json({ ok: true, status: 'ACTIVE' as const })
    }

    if (action === 'set-daily-budget') {
      if (!adSetId) throw new ValidationError('예산을 바꾸려면 adSetId 가 필요해요.')
      if (typeof dailyBudget !== 'number' || !Number.isFinite(dailyBudget) || dailyBudget < MIN_DAILY_BUDGET_KRW) {
        throw new ValidationError(`일일 예산은 최소 ₩${MIN_DAILY_BUDGET_KRW.toLocaleString('ko-KR')} 이상이어야 해요.`)
      }
      await metaAds.setAdSetDailyBudget(adSetId, accessToken, dailyBudget)
      return NextResponse.json({ ok: true, dailyBudget })
    }

    throw new ValidationError('알 수 없는 action 이에요.')
})
