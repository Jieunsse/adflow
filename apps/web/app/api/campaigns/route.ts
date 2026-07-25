import { NextRequest, NextResponse } from 'next/server'
import { metaAds, type InsightsPeriod } from '@/lib/meta-ads'
import { MOCK_CAMPAIGN_SUMMARIES } from '@/lib/mock-campaigns'
import { withMetaSession } from '@/lib/meta-session'

function parsePeriod(v: string | null): InsightsPeriod {
  return v === '7d' || v === '30d' ? v : 'all'
}

export const GET = withMetaSession(
  ['adAccount'],
  async (req: NextRequest, s) => {
    const period = parsePeriod(req.nextUrl.searchParams.get('period'))
    return NextResponse.json({ campaigns: await metaAds.listCampaigns(s.accessToken, s.adAccountId, period) })
  },
  { onBrowse: () => NextResponse.json({ campaigns: MOCK_CAMPAIGN_SUMMARIES }) },
)
