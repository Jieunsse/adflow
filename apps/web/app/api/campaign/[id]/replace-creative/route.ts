import { NextRequest, NextResponse } from 'next/server'
import { metaAds } from '@/lib/meta-ads'
import { withMetaSession } from '@/lib/meta-session'
import { ValidationError } from '@/lib/route-handler'

type ReplaceBody = {
  headline: string
  primaryText: string
  imageDataUrl?: string
  reuseExistingImage?: boolean
}

export const POST = withMetaSession<{ params: Promise<{ id: string }> }>(
  ['adAccount'],
  async (req: NextRequest, s, { params }) => {
    const { accessToken, adAccountId } = s
    const { id: campaignId } = await params
    const body = (await req.json()) as ReplaceBody

    if (!body.headline?.trim()) throw new ValidationError('헤드라인을 입력해주세요.')
    if (!body.primaryText?.trim()) throw new ValidationError('본문을 입력해주세요.')

    const campaign = await metaAds.getCampaign(campaignId, accessToken)

    if (!campaign.adId) {
      throw new ValidationError('이 캠페인에 연결된 광고를 찾을 수 없어요. (개발 앱 모드에서는 광고 생성이 생략됩니다)')
    }

    const { newCreativeId } = await metaAds.replaceAdCreative(
      campaign.adId,
      accessToken,
      adAccountId,
      {
        headline: body.headline,
        primaryText: body.primaryText,
        imageDataUrl: body.imageDataUrl,
        reuseExistingImage: body.reuseExistingImage,
      },
    )

    return NextResponse.json({ ok: true, newCreativeId, updatedAt: new Date().toISOString() })
  },
)
