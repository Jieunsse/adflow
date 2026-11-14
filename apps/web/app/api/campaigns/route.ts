import { NextRequest, NextResponse } from 'next/server'
import { metaAds, type InsightsPeriod } from '@/lib/meta-ads'
import { getBrowseDashboardCampaigns, MOCK_CAMPAIGN_SUMMARIES, type BrowseDashboardExample } from '@/lib/mock-campaigns'
import { withMetaSession } from '@/lib/meta-session'

function parsePeriod(v: string | null): InsightsPeriod {
  return v === '7d' || v === '30d' ? v : 'all'
}

function parseBrowseExample(v: string | null): BrowseDashboardExample | null {
  return v === 'good' || v === 'poor' ? v : null
}

export const GET = withMetaSession(
  ['adAccount'],
  async (req: NextRequest, s) => {
    const period = parsePeriod(req.nextUrl.searchParams.get('period'))
    return NextResponse.json({ campaigns: await metaAds.listCampaigns(s.accessToken, s.adAccountId, period) })
  },
  {
    onBrowse: (_session, req) => {
      const example = parseBrowseExample(req.nextUrl.searchParams.get('example'))
      return NextResponse.json({ campaigns: example ? getBrowseDashboardCampaigns(example) : MOCK_CAMPAIGN_SUMMARIES })
    },
  },
)
