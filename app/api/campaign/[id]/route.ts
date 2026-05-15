import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metaAds } from '@/lib/meta-ads'
import { withRouteHandler } from '@/lib/route-handler'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: '광고 계정을 먼저 연결해주세요.' }, { status: 401 })
  }
  const { id } = await params
  const { accessToken } = session
  return withRouteHandler(true, '', async () =>
    NextResponse.json({ campaign: await metaAds.getCampaign(id, accessToken) })
  )
}
