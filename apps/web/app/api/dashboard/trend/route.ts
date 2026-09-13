import { NextRequest, NextResponse } from 'next/server'
import { metaAds } from '@/lib/meta-ads'
import { withMetaSession } from '@/lib/meta-session'
import { getBrowseDashboardCampaigns, MOCK_CAMPAIGN_SUMMARIES, type BrowseDashboardExample } from '@/lib/mock-campaigns'
import { synthAccountDaily } from '@entities/insights/account-trend'

function parseDays(v: string | null): number {
  const n = Number(v)
  return n === 14 || n === 60 ? n : 14
}

function parseBrowseExample(v: string | null): BrowseDashboardExample | null {
  return v === 'good' || v === 'poor' ? v : null
}

function parseCampaignId(v: string | null): string | undefined {
  return v?.trim() || undefined
}

function parsePlacement(v: string | null): 'facebook' | 'instagram' | undefined {
  return v === 'facebook' || v === 'instagram' ? v : undefined
}

// ADR-059 — 계정 횡단 일별 합산 추세(듀얼추세 입력). 실유저는 계정 레벨 단일 콜(N+1 회피).
// 브라우즈는 mock totals 를 결정적으로 일별 분산("예시"). ADR-033 "실제 라우트+mock" 단일 코드패스.
// days=14(7일 토글, 델타 비교용 직전 7일 포함) / 60(30일 토글, 직전 30일 포함).
export const GET = withMetaSession(
  ['adAccount'],
  async (req: NextRequest, s) => {
    const days = parseDays(req.nextUrl.searchParams.get('days'))
    const campaignId = parseCampaignId(req.nextUrl.searchParams.get('campaignId'))
    const placement = parsePlacement(req.nextUrl.searchParams.get('placement'))
    if (req.nextUrl.searchParams.get('analysis') !== '1') {
      return NextResponse.json({ daily: await metaAds.getAccountDailyTrend(s.accessToken, s.adAccountId, days) })
    }
    return NextResponse.json(await metaAds.getAnalysisTrend(s.accessToken, s.adAccountId, days, campaignId, placement))
  },
  {
    onBrowse: (_session, req) => {
      const days = parseDays(req.nextUrl.searchParams.get('days'))
      const example = parseBrowseExample(req.nextUrl.searchParams.get('example'))
      const campaignId = parseCampaignId(req.nextUrl.searchParams.get('campaignId'))
      const placement = parsePlacement(req.nextUrl.searchParams.get('placement'))
      const today = new Date().toISOString().slice(0, 10)
      const allCampaigns = example ? getBrowseDashboardCampaigns(example) : MOCK_CAMPAIGN_SUMMARIES
      if (req.nextUrl.searchParams.get('analysis') !== '1') {
        return NextResponse.json({ daily: synthAccountDaily(allCampaigns, today, days, example !== 'poor') })
      }
      const selected = campaignId ? allCampaigns.filter((campaign) => campaign.id === campaignId) : allCampaigns
      const matchesPlacement = (campaign: typeof selected[number], value: 'facebook' | 'instagram') => campaign.platforms === 'both' || campaign.platforms === value
      const placements = (['facebook', 'instagram'] as const).filter((value) => selected.some((campaign) => matchesPlacement(campaign, value)))
      const campaigns = placement ? selected.filter((campaign) => matchesPlacement(campaign, placement)) : selected
      return NextResponse.json({
        daily: synthAccountDaily(campaigns, today, days, example !== 'poor'),
        campaignMetrics: campaigns.map((campaign) => ({
          id: campaign.id,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          spend: campaign.spend,
          linkClick: campaign.linkClick,
          landingPageView: campaign.landingPageView,
          purchaseCount: campaign.purchaseCount,
          purchaseValue: campaign.purchaseValue,
        })),
        placements,
      })
    },
  },
)
