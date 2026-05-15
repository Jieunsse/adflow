import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metaAds, type InsightsPeriod, type MetaObjectiveParam } from '@/lib/meta-ads'
import { withRouteHandler } from '@/lib/route-handler'

const VALID_OBJECTIVES: ReadonlySet<MetaObjectiveParam> = new Set(['OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS', 'OUTCOME_ENGAGEMENT'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const { accessToken } = session
  const p = req.nextUrl.searchParams.get('period')
  const period: InsightsPeriod | undefined = p === '7d' || p === '30d' || p === 'all' ? p : undefined
  const objRaw = req.nextUrl.searchParams.get('objective')
  const objective: MetaObjectiveParam | undefined =
    objRaw && VALID_OBJECTIVES.has(objRaw as MetaObjectiveParam) ? (objRaw as MetaObjectiveParam) : undefined
  return withRouteHandler(true, '', async () =>
    NextResponse.json(await metaAds.getInsights(id, accessToken, period, objective))
  )
}
