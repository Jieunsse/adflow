import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metaAds } from '@/lib/meta-ads'
import { getMockCampaign } from '@/lib/mock-campaigns'
import { withRouteHandler } from '@/lib/route-handler'
import { requireMetaSession } from '@/lib/meta-session'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params
  if (session?.browseMode) {
    const campaign = getMockCampaign(id)
    if (!campaign) return NextResponse.json({ error: '캠페인을 찾을 수 없어요.' }, { status: 404 })
    return NextResponse.json({ campaign })
  }
  return withRouteHandler(true, '', async () => {
    const s = requireMetaSession(session)
    return NextResponse.json({ campaign: await metaAds.getCampaign(id, s.accessToken) })
  })
}
