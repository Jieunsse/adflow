import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metaAds } from '@/lib/meta-ads'
import { MOCK_BILLING } from '@/lib/mock-billing'
import { withRouteHandler } from '@/lib/route-handler'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.browseMode) {
    return NextResponse.json(MOCK_BILLING)
  }
  if (!session?.accessToken || !session?.adAccountId) {
    return NextResponse.json({ error: '광고 계정을 먼저 연결해주세요.' }, { status: 401 })
  }
  const { accessToken, adAccountId } = session
  return withRouteHandler(true, '', async () =>
    NextResponse.json(await metaAds.getBilling(accessToken, adAccountId)),
  )
}
