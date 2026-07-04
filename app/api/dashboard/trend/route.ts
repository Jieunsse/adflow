import { NextRequest, NextResponse } from 'next/server'
import { metaAds } from '@/lib/meta-ads'
import { withMetaSession } from '@/lib/meta-session'
import { MOCK_CAMPAIGN_SUMMARIES } from '@/lib/mock-campaigns'
import { synthAccountDaily } from '@entities/insights/account-trend'

// ADR-059 — 계정 횡단 일별 합산 추세(듀얼추세 입력). 실유저는 계정 레벨 단일 콜(N+1 회피).
// 브라우즈는 mock totals 를 결정적으로 일별 분산("예시"). ADR-033 "실제 라우트+mock" 단일 코드패스.
export const GET = withMetaSession(
  ['adAccount'],
  async (_req: NextRequest, s) => {
    return NextResponse.json({ daily: await metaAds.getAccountDailyTrend(s.accessToken, s.adAccountId, '30d') })
  },
  {
    onBrowse: () => {
      const today = new Date().toISOString().slice(0, 10)
      return NextResponse.json({ daily: synthAccountDaily(MOCK_CAMPAIGN_SUMMARIES, today, 14, true) })
    },
  },
)
