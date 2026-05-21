import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metaAds, type InsightsPeriod } from '@/lib/meta-ads'
import { MOCK_CAMPAIGN_SUMMARIES } from '@/lib/mock-campaigns'
import { withRouteHandler } from '@/lib/route-handler'

function parsePeriod(v: string | null): InsightsPeriod {
  return v === '7d' || v === '30d' ? v : 'all'
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.browseMode) {
    return NextResponse.json({ campaigns: MOCK_CAMPAIGN_SUMMARIES })
  }
  if (!session?.accessToken || !session?.adAccountId) {
    return NextResponse.json({ error: '광고 계정을 먼저 연결해주세요.' }, { status: 401 })
  }
  const { accessToken, adAccountId } = session
  const period = parsePeriod(req.nextUrl.searchParams.get('period'))
  return withRouteHandler(true, '', async () =>
    NextResponse.json({ campaigns: await metaAds.listCampaigns(accessToken, adAccountId, period) })
  )
}
