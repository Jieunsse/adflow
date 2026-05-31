import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metaAds, VALID_OBJECTIVES, type InsightsPeriod, type MetaObjectiveParam } from '@/lib/meta-ads'
import { OBJECTIVES_PHASE1, type ObjectivePhase1Id } from '@entities/creative/options'
import { getMockInsights } from '@/lib/mock-campaigns'
import { withRouteHandler } from '@/lib/route-handler'
import { requireMetaSession } from '@/lib/meta-session'

const VALID_GOAL_IDS: ReadonlySet<string> = new Set(OBJECTIVES_PHASE1.map((g) => g.id))

// PRD-ab-testing.md §7.2 — `?adIds=a,b` 형식. 정확히 두 개일 때만 광고별 row 분기 진입.
function parseAdIdsParam(raw: string | null): [string, string] | undefined {
  if (!raw) return undefined
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length === 2 ? [parts[0], parts[1]] : undefined
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params
  const p = req.nextUrl.searchParams.get('period')
  const period: InsightsPeriod | undefined = p === '7d' || p === '30d' || p === 'all' ? p : undefined
  const adIds = parseAdIdsParam(req.nextUrl.searchParams.get('adIds'))
  if (session?.browseMode) {
    return NextResponse.json(getMockInsights(id, period ?? 'all', adIds))
  }
  const objRaw = req.nextUrl.searchParams.get('objective')
  const objective: MetaObjectiveParam | undefined =
    objRaw && VALID_OBJECTIVES.has(objRaw as MetaObjectiveParam) ? (objRaw as MetaObjectiveParam) : undefined
  // PRD §13 — goalId 우선. KpiGrid 가 goal 단위로 분기하려면 서버에서 fields 도 goal 기준 결정 필요.
  const goalRaw = req.nextUrl.searchParams.get('goal')
  const goalId: ObjectivePhase1Id | undefined =
    goalRaw && VALID_GOAL_IDS.has(goalRaw) ? (goalRaw as ObjectivePhase1Id) : undefined
  // PRD-ab-testing.md §7.5 — 개발모드 fake adIds (`mock_ad_...`) 는 Meta API 가 모르는 ID 라 lib 의 level=ad 호출 불가.
  // server 는 캠페인 합계만 라이브로 fetch, 광고별 row 는 client 가 launched.startDate 로 seedMockAdRows 합성.
  const isFakeAd = adIds?.every((a) => a.startsWith('mock_ad_')) ?? false
  const liveAdIds = isFakeAd ? undefined : adIds
  return withRouteHandler(true, '', async () => {
    const s = requireMetaSession(session)
    return NextResponse.json(await metaAds.getInsights(id, s.accessToken, period, objective, goalId, liveAdIds))
  })
}
