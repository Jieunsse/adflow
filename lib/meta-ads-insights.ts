// Server-side only — read/reporting operations. Do not import from client components.

import type { Insights, AdInsightsRow } from '@entities/insights/types'
import type { AccountDailyPoint } from '@entities/insights/account-trend'
import type { Billing, FundingSource, BusinessInfo, AccountStatusCode } from '@entities/billing/types'
import type { ObjectivePhase1Id } from '@entities/creative/options'
import { graphFetch } from './meta-ads-graph'
import type { MetaObjectiveParam, BidStrategyParam, PlatformsParam, AbTestAxisParam } from './meta-ads-campaign'
import type { AdSnapshot, AdEffectiveStatus } from './notifications/ad-status-diff'

// 도메인 타입은 src/entities/insights/types.ts 단일 출처. caller 호환용 alias 만 유지.
export type InsightsResult = Insights

export interface AccountStatus {
  connected: boolean
  accountId: string
  accountName: string
  currency: string
}

export type CampaignStatusBucket = 'live' | 'review' | 'paused' | 'ended' | 'issue'
export type InsightsPeriod = '7d' | '30d' | 'all'

export interface CampaignIssueReason {
  summary: string   // error_summary — 한 줄 요약 (행 인라인 표시용)
  message: string   // error_message — 풀텍스트 (모달 표시용). summary 와 동일하면 summary 만 사용
}

export interface CampaignSummary {
  id: string
  name: string
  headline: string  // name with 'AdFlow — ' prefix stripped; falls back to name as-is
  status: CampaignStatusBucket
  objective: string
  goal: string
  startDate: string | null  // YYYY-MM-DD
  endDate: string | null
  adSetId: string | null  // needed for pause/resume/budget actions on the row
  adId: string | null     // must also be ACTIVE when resuming
  dailyBudget: number | null  // KRW
  impressions: number
  clicks: number
  ctr: number   // %
  spend: number // KRW
  // ADR-030 — 가짜 성과 의심 판정용. actions[] 에서 추출. action 부재 시 undefined(= 픽셀 미측정 → 판정 안 함).
  linkClick?: number
  landingPageView?: number
  // ADR-057 — 전환 가치(읽기 경로). 전환 캠페인+Pixel 보유 시에만 채워짐(미측정 시 undefined → ROAS 게이트).
  purchaseCount?: number
  purchaseValue?: number
  roas?: number
  issueReason: CampaignIssueReason | null  // /approvals 에서 노출. status='issue' 일 때만 채워지는 경향 (Meta 가 review 단계에서도 줄 수 있음)
  // PRD-ab-testing.md §4.4 — mock 시연 캠페인의 A/B 시드. live API 매핑은 채우지 않음.
  abTestEnabled?: boolean
  abTestAxis?: AbTestAxisParam
  abTestVariantA?: string  // axis 종속 — headline 텍스트 / primaryText / 이미지 URL
  abTestVariantB?: string
  // ADR-011 — Campaign Configuration 탭용 소재·타겟팅 필드
  imageUrl?: string
  primaryText?: string
  cta?: string
  landingUrl?: string
  ageMin?: number
  ageMax?: number
  genders?: number[]
  countries?: string[]
  platforms?: PlatformsParam
  placementMode?: 'auto' | 'manual'
  placementPositions?: string[]
  bidStrategy?: BidStrategyParam
  bidAmount?: number | null
}

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_TRAFFIC: '트래픽',
  OUTCOME_SALES: '전환',
  OUTCOME_AWARENESS: '인지도',
  OUTCOME_LEADS: '잠재고객',
  OUTCOME_ENGAGEMENT: '참여',
  OUTCOME_APP_PROMOTION: '앱 설치',
  LINK_CLICKS: '트래픽',
  CONVERSIONS: '전환',
  REACH: '인지도',
}

function mapCampaignStatus(effStatus: string | undefined, stopTime: string | undefined): CampaignStatusBucket {
  const s = String(effStatus ?? '').toUpperCase()
  if (s === 'WITH_ISSUES' || s === 'DISAPPROVED' || s === 'ADSET_PAUSED_WITH_ISSUES') return 'issue'
  if (s === 'IN_PROCESS' || s === 'PENDING_REVIEW' || s === 'PENDING_BILLING_INFO' || s === 'PREAPPROVED' || s === 'PENDING_PROCESSING') return 'review'
  if (s === 'ARCHIVED' || s === 'DELETED') return 'ended'
  if (stopTime) {
    const t = Date.parse(stopTime)
    if (Number.isFinite(t) && t < Date.now()) return 'ended'
  }
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 'paused'
  if (s === 'ACTIVE') return 'live'
  return 'review'
}

function toDateOnly(iso: string | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  if (m) return m[1]
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
}

function stripHeadline(name: string): string {
  const m = /^AdFlow\s*[—–\-]\s*(.+)$/.exec(name)
  return (m ? m[1] : name).trim()
}

function presetFor(period: InsightsPeriod): string {
  return period === '7d' ? 'last_7d' : period === '30d' ? 'last_30d' : 'maximum'
}

interface RawIssueInfo {
  level?: string           // CAMPAIGN | AD_SET | AD
  error_code?: number
  error_summary?: string
  error_message?: string
  error_type?: string
}

interface RawCampaign {
  id: string
  name: string
  effective_status?: string
  objective?: string
  start_time?: string
  stop_time?: string
  daily_budget?: string
  adsets?: { data?: Array<{
    id: string
    daily_budget?: string
    bid_strategy?: string
    bid_amount?: string
    targeting?: {
      age_min?: number
      age_max?: number
      genders?: number[]
      geo_locations?: { countries?: string[] }
      publisher_platforms?: string[]
      facebook_positions?: string[]
      instagram_positions?: string[]
    }
    ads?: { data?: Array<{ id: string }> }
  }> }
  insights?: { data?: Array<{ impressions?: string; clicks?: string; ctr?: string; spend?: string; actions?: Array<{ action_type?: string; value?: string }>; action_values?: Array<{ action_type?: string; value?: string }>; purchase_roas?: Array<{ action_type?: string; value?: string }> }> }
  issues_info?: RawIssueInfo[]
}

const CAMPAIGN_FIELDS = (period: InsightsPeriod) => [
  'id', 'name', 'effective_status', 'objective', 'start_time', 'stop_time', 'daily_budget',
  'issues_info',
  'adsets.limit(1){id,daily_budget,bid_strategy,bid_amount,targeting{age_min,age_max,genders,geo_locations,publisher_platforms,facebook_positions,instagram_positions},ads.limit(1){id}}',
  `insights.date_preset(${presetFor(period)}){impressions,clicks,ctr,spend,actions,action_values,purchase_roas}`,
].join(',')

function pickIssueReason(issues: RawIssueInfo[] | undefined): CampaignIssueReason | null {
  if (!issues?.length) return null
  const first = issues[0]
  const summary = first.error_summary?.trim() ?? ''
  const message = first.error_message?.trim() ?? ''
  if (!summary && !message) return null
  return { summary: summary || message, message: message || summary }
}

interface RawPollAd {
  id: string
  name?: string
  effective_status?: string
  issues_info?: RawIssueInfo[]
  campaign?: { id?: string }
}

const POLL_STATUS_SET = new Set<AdEffectiveStatus>(['PENDING_REVIEW', 'ACTIVE', 'WITH_ISSUES', 'DISAPPROVED', 'PAUSED'])

function toAdSnapshot(ad: RawPollAd): AdSnapshot | null {
  const status = String(ad.effective_status ?? '').toUpperCase() as AdEffectiveStatus
  if (!POLL_STATUS_SET.has(status)) return null
  const campaignId = ad.campaign?.id ?? ''
  if (!campaignId) return null
  const issue = ad.issues_info?.[0]
  const issueReason = issue?.error_summary?.trim() || issue?.error_message?.trim() || null
  return {
    adId: ad.id,
    campaignId,
    name: ad.name ?? '',
    status,
    issueReason,
  }
}

function mapRawCampaign(c: RawCampaign): CampaignSummary {
  const adset = c.adsets?.data?.[0]
  const ins = c.insights?.data?.[0]
  const impressions = Math.round(Number(ins?.impressions ?? 0))
  const clicks = Math.round(Number(ins?.clicks ?? 0))
  const ctr = ins?.ctr != null
    ? Math.round(parseFloat(ins.ctr) * 100) / 100
    : impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0
  const spend = Math.round(parseFloat(ins?.spend ?? '0'))
  // ADR-030 — action 부재 = undefined(픽셀 미측정). 존재하면 숫자(0 포함).
  const actionVal = (type: string): number | undefined => {
    const f = ins?.actions?.find((a) => a.action_type === type)
    return f ? Math.round(Number(f.value ?? 0)) : undefined
  }
  const linkClick = actionVal('link_click')
  const landingPageView = actionVal('landing_page_view')
  // ADR-057 — 전환 가치(읽기 경로). 전환 캠페인+Pixel 보유 시에만 옴. 없으면 undefined → ROAS 게이트.
  const pickValue = (rows: Array<{ action_type?: string; value?: string }> | undefined): number | undefined => {
    const f = rows?.find((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
    return f ? Number(f.value ?? 0) : undefined
  }
  const purchaseCount = actionVal('purchase') ?? actionVal('omni_purchase')
  const purchaseValueRaw = pickValue(ins?.action_values)
  const purchaseValue = purchaseValueRaw != null ? Math.round(purchaseValueRaw) : undefined
  const roasRaw = pickValue(ins?.purchase_roas)
  const roas = roasRaw != null
    ? Math.round(roasRaw * 100) / 100
    : purchaseValue != null && spend > 0 ? Math.round((purchaseValue / spend) * 100) / 100 : undefined
  const dailyBudgetRaw = c.daily_budget ?? adset?.daily_budget
  const obj = c.objective ?? ''
  const tgt = adset?.targeting
  const pubPlatforms = tgt?.publisher_platforms ?? []
  const hasFb = pubPlatforms.includes('facebook')
  const hasIg = pubPlatforms.includes('instagram')
  const platforms: PlatformsParam =
    pubPlatforms.length === 0 ? 'both'
    : hasFb && hasIg ? 'both'
    : hasFb ? 'facebook'
    : hasIg ? 'instagram'
    : 'both'
  const fbPos = tgt?.facebook_positions ?? []
  const igPos = tgt?.instagram_positions ?? []
  const placementPositions: string[] = [
    ...fbPos.map((p) => `facebook_${p}`),
    ...igPos.map((p) => p === 'stream' ? 'instagram_feed' : p === 'story' ? 'instagram_stories' : `instagram_${p}`),
  ]
  return {
    id: c.id,
    name: c.name,
    headline: stripHeadline(c.name ?? ''),
    status: mapCampaignStatus(c.effective_status, c.stop_time),
    objective: obj,
    goal: OBJECTIVE_LABEL[obj] ?? (obj ? obj.replace(/^OUTCOME_/, '') : '—'),
    startDate: toDateOnly(c.start_time),
    endDate: toDateOnly(c.stop_time),
    adSetId: adset?.id ?? null,
    adId: adset?.ads?.data?.[0]?.id ?? null,
    dailyBudget: dailyBudgetRaw != null && Number.isFinite(Number(dailyBudgetRaw)) ? Math.round(Number(dailyBudgetRaw)) : null,
    impressions, clicks, ctr, spend,
    linkClick, landingPageView,
    purchaseCount, purchaseValue, roas,
    issueReason: pickIssueReason(c.issues_info),
    ageMin: tgt?.age_min,
    ageMax: tgt?.age_max,
    genders: tgt?.genders,
    countries: tgt?.geo_locations?.countries,
    platforms,
    placementMode: placementPositions.length > 0 ? 'manual' : 'auto',
    placementPositions: placementPositions.length > 0 ? placementPositions : undefined,
    bidStrategy: adset?.bid_strategy as BidStrategyParam | undefined,
    bidAmount: adset?.bid_amount != null ? Math.round(Number(adset.bid_amount)) : null,
  }
}

// ── getBilling 매퍼 ────────────────────────────────────────────────────────

interface RawFundingSourceRow {
  id?: string
  display_string?: string
  type?: string | number
}

interface RawBilling {
  name?: string
  account_status?: number
  currency?: string
  balance?: string | number | null
  spend_cap?: string | number | null
  amount_spent?: string | number | null
  business_name?: string | null
  business_street?: string | null
  business_city?: string | null
  business_state?: string | null
  business_zip?: string | null
  business_country_code?: string | null
  // Meta 버전 따라 raw array 또는 { data: [...] } 래핑 — 양쪽 다 처리
  funding_source_details?: RawFundingSourceRow[] | { data?: RawFundingSourceRow[] }
}

function toMinorUnitOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

function normalizeFundingSources(raw: RawBilling['funding_source_details']): FundingSource[] {
  if (!raw) return []
  const rows: RawFundingSourceRow[] = Array.isArray(raw) ? raw : (raw.data ?? [])
  return rows
    .filter((r) => r && (r.id || r.display_string))
    .map((r) => ({
      id: String(r.id ?? ''),
      displayString: String(r.display_string ?? ''),
      type: String(r.type ?? ''),
    }))
}

function mapRawBilling(accountId: string, raw: RawBilling): Billing {
  const business: BusinessInfo = {
    name: raw.business_name ?? null,
    street: raw.business_street ?? null,
    city: raw.business_city ?? null,
    state: raw.business_state ?? null,
    zip: raw.business_zip ?? null,
    countryCode: raw.business_country_code ?? null,
  }
  return {
    accountId,
    accountName: raw.name ?? null,
    currency: raw.currency ?? '',
    accountStatus: (raw.account_status ?? 0) as AccountStatusCode | number,
    balance: toMinorUnitOrNull(raw.balance),
    spendCap: toMinorUnitOrNull(raw.spend_cap),
    amountSpent: toMinorUnitOrNull(raw.amount_spent),
    fundingSources: normalizeFundingSources(raw.funding_source_details),
    business,
  }
}

const BILLING_FIELDS = [
  'name',
  'account_status',
  'currency',
  'balance',
  'spend_cap',
  'amount_spent',
  'business_name',
  'business_street',
  'business_city',
  'business_state',
  'business_zip',
  'business_country_code',
  'funding_source_details',
].join(',')

// ADR-038 §4 — ad study(SPLIT_TEST) 결과. Meta 가 셀별 유의성·winner 를 판정한다(엔진 z-검정 대신 채택).
// 결과 JSON 형태는 버전·계정마다 편차가 있어 관대하게 파싱: 결과 엔트리가 하나도 없으면 "진행 중"(null)으로
// 보고 cron 이 다음 폴에서 재시도, 결과가 있으면 유의 winner 셀(A/B)과 confidence 를 뽑는다.
interface RawAdStudyResultEntry {
  cell?: string
  cell_name?: string
  name?: string
  winner?: boolean
  is_winner?: boolean
  is_significant?: boolean
  significant?: boolean
  confidence?: number | string
  p_value?: number | string
}
interface RawAdStudyCell {
  name?: string
  results?: RawAdStudyResultEntry[] | { data?: RawAdStudyResultEntry[] }
}
interface RawAdStudy {
  id?: string
  cells?: { data?: RawAdStudyCell[] }
  results?: RawAdStudyResultEntry[] | { data?: RawAdStudyResultEntry[] }
}

function toEntryArray(r: RawAdStudyResultEntry[] | { data?: RawAdStudyResultEntry[] } | undefined): RawAdStudyResultEntry[] {
  if (!r) return []
  return Array.isArray(r) ? r : (r.data ?? [])
}

// 셀 이름을 A/B 로 정규화 — 'A' / 'Cell A' / 'B안' 등 흔한 표기 흡수. 매칭 실패 시 null.
function normalizeCell(name: string | undefined): 'A' | 'B' | null {
  const s = (name ?? '').toUpperCase()
  if (/\bA\b|^A|CELL A|챔피언/.test(s)) return 'A'
  if (/\bB\b|^B|CELL B|챌린저/.test(s)) return 'B'
  return null
}

function toConfidence(e: RawAdStudyResultEntry, significant: boolean): number {
  const conf = e.confidence != null ? Number(e.confidence) : NaN
  if (Number.isFinite(conf)) return Math.min(Math.max(conf > 1 ? conf / 100 : conf, 0), 1)
  const p = e.p_value != null ? Number(e.p_value) : NaN
  if (Number.isFinite(p)) return Math.min(Math.max(1 - (p > 1 ? p / 100 : p), 0), 1)
  return significant ? 0.95 : 0.5
}

function parseAdStudyResult(data: RawAdStudy): { winner: 'A' | 'B' | null; confidence: number } | null {
  // 모든 결과 엔트리 수집 (top-level results + 셀별 results). 셀 이름은 엔트리 자체 or 부모 셀에서.
  const entries: Array<{ cell: 'A' | 'B' | null; e: RawAdStudyResultEntry }> = []
  for (const e of toEntryArray(data.results)) {
    entries.push({ cell: normalizeCell(e.cell ?? e.cell_name ?? e.name), e })
  }
  for (const cell of data.cells?.data ?? []) {
    const cellName = normalizeCell(cell.name)
    for (const e of toEntryArray(cell.results)) {
      entries.push({ cell: normalizeCell(e.cell ?? e.cell_name ?? e.name) ?? cellName, e })
    }
  }
  if (entries.length === 0) return null // 결과 미생성 = 스터디 진행 중

  const sig = (e: RawAdStudyResultEntry) => e.winner === true || e.is_winner === true || e.is_significant === true || e.significant === true
  const winnerEntry = entries.find((x) => sig(x.e) && x.cell !== null)
  if (winnerEntry) {
    return { winner: winnerEntry.cell, confidence: toConfidence(winnerEntry.e, true) }
  }
  // 유의 winner 없음 = inconclusive(챔피언 방어). confidence 는 보고된 값 중 최대 or 0.5.
  const conf = entries.reduce((m, x) => Math.max(m, toConfidence(x.e, false)), 0.5)
  return { winner: null, confidence: conf }
}

export const metaAdsInsights = {
  // ADR-038 §4 — ad study 의 Meta 유의성 결과. null=진행 중(폴 재시도), winner=null=inconclusive(챔피언 방어).
  async getSplitTestResult(studyId: string, token: string): Promise<{ winner: 'A' | 'B' | null; confidence: number } | null> {
    try {
      const data = await graphFetch<RawAdStudy>(
        `/${studyId}?fields=id,results,cells{name,results}&access_token=${token}`,
      )
      return parseAdStudyResult(data)
    } catch {
      return null
    }
  },

  async checkAccount(token: string, accountId: string): Promise<AccountStatus> {
    const data = await graphFetch<{
      name: string
      account_status: number
      currency: string
    }>(`/${accountId}?fields=name,account_status,currency&access_token=${token}`)
    return {
      connected: data.account_status === 1,
      accountId,
      accountName: data.name,
      currency: data.currency,
    }
  },

  async getBilling(token: string, accountId: string): Promise<Billing> {
    const data = await graphFetch<RawBilling>(
      `/${accountId}?fields=${BILLING_FIELDS}&access_token=${token}`,
    )
    return mapRawBilling(accountId, data)
  },

  async getCampaignBrief(campaignId: string, token: string): Promise<{
    name: string;
    headline: string;
    objective: string;
    status: CampaignStatusBucket;
  } | null> {
    try {
      const data = await graphFetch<RawCampaign>(
        `/${campaignId}?fields=id,name,effective_status,objective,stop_time&access_token=${token}`
      )
      return {
        name: data.name,
        headline: stripHeadline(data.name),
        objective: data.objective ?? 'OUTCOME_TRAFFIC',
        status: mapCampaignStatus(data.effective_status, data.stop_time),
      }
    } catch {
      return null
    }
  },

  async listAdsForPolling(token: string, accountId: string): Promise<AdSnapshot[]> {
    const fields = encodeURIComponent('id,name,effective_status,issues_info{error_message,error_summary},campaign{id}')
    const filtering = encodeURIComponent(JSON.stringify([{
      field: 'ad.effective_status',
      operator: 'IN',
      value: ['PENDING_REVIEW', 'ACTIVE', 'WITH_ISSUES', 'DISAPPROVED', 'PAUSED'],
    }]))
    const data = await graphFetch<{ data: RawPollAd[] }>(
      `/${accountId}/ads?fields=${fields}&filtering=${filtering}&limit=100&access_token=${token}`
    )
    return (data.data ?? []).map(toAdSnapshot).filter((a): a is AdSnapshot => a !== null)
  },

  // ADR-059 — 계정 횡단 일별 합산(듀얼추세 입력). level=account + time_increment=1 단일 콜로
  // Meta 가 캠페인 합산을 직접 내려준다(per-campaign N+1 불필요). 라우트가 staleTime 으로 캐시.
  async getAccountDailyTrend(token: string, accountId: string, period: InsightsPeriod = '30d'): Promise<AccountDailyPoint[]> {
    const preset = presetFor(period)
    const extract = (rows: Array<{ action_type?: string; value?: string }> | undefined, type: string): number => {
      const f = rows?.find((a) => a.action_type === type)
      return f ? Number(f.value ?? 0) : 0
    }
    const data = await graphFetch<{
      data: Array<{
        date_start: string
        spend?: string
        impressions?: string
        clicks?: string
        actions?: Array<{ action_type?: string; value?: string }>
        action_values?: Array<{ action_type?: string; value?: string }>
      }>
    }>(
      `/${accountId}/insights?level=account&time_increment=1&date_preset=${preset}` +
        `&fields=spend,impressions,clicks,actions,action_values&access_token=${token}`
    )
    return (data.data ?? []).map((d) => ({
      date: d.date_start,
      spend: Math.round(parseFloat(d.spend ?? '0')),
      impressions: Math.round(Number(d.impressions ?? 0)),
      clicks: Math.round(Number(d.clicks ?? 0)),
      landingPageView: Math.round(extract(d.actions, 'landing_page_view')),
      purchaseValue: Math.round(extract(d.action_values, 'purchase') + extract(d.action_values, 'omni_purchase')),
    }))
  },

  async listCampaigns(token: string, accountId: string, period: InsightsPeriod = 'all'): Promise<CampaignSummary[]> {
    const fields = encodeURIComponent(CAMPAIGN_FIELDS(period))
    const data = await graphFetch<{ data: RawCampaign[] }>(
      `/${accountId}/campaigns?fields=${fields}&limit=50&access_token=${token}`
    )
    return (data.data ?? []).map(mapRawCampaign)
  },

  async getCampaign(campaignId: string, token: string): Promise<CampaignSummary> {
    const fields = encodeURIComponent(CAMPAIGN_FIELDS('all'))
    const c = await graphFetch<RawCampaign>(`/${campaignId}?fields=${fields}&access_token=${token}`)
    return mapRawCampaign(c)
  },

  // PRD §13 — goalId 우선. 미제공 시 objective 기반 레거시 fallback.
  // PRD-ab-testing.md §7.2 — adIds 제공 시 추가 호출로 광고별 row 두 개. 캠페인 합계 + 광고별 row 둘 다 반환.
  async getInsights(
    campaignId: string,
    token: string,
    period?: InsightsPeriod,
    // ADR-057 — 읽기 경로는 OUTCOME_SALES 도 허용(전환 가치 회수). 생성용 MetaObjectiveParam(sales 제외)은 불변.
    objective?: MetaObjectiveParam | 'OUTCOME_SALES',
    goalId?: ObjectivePhase1Id,
    adIds?: [string, string],
  ): Promise<Insights> {
    const preset =
      period === '7d' ? '&date_preset=last_7d' :
      period === '30d' ? '&date_preset=last_30d' :
      period === 'all' ? '&date_preset=maximum' : ''
    // PRD §13 — 신규 4 goal 의 KPI 들이 actions[]/reach/frequency/cpm 을 추가로 요구.
    // engagement_page_likes/engagement_messages/leads_call 모두 도달·CPM 4-카드 셋이라 동일 fields 사용.
    const fields = ((): string => {
      if (goalId) {
        switch (goalId) {
          case 'awareness':              return 'impressions,reach,frequency,cpm,spend'
          case 'traffic':                return 'impressions,clicks,ctr,spend'
          case 'traffic_page_visit':     return 'impressions,clicks,ctr,spend,actions'
          case 'engagement':             return 'impressions,spend,actions'
          case 'engagement_page_likes':
          case 'engagement_messages':
          case 'leads_call':             return 'impressions,reach,frequency,cpm,spend,actions'
        }
      }
      switch (objective) {
        case 'OUTCOME_AWARENESS':  return 'impressions,reach,frequency,cpm,spend'
        case 'OUTCOME_ENGAGEMENT': return 'impressions,spend,actions'
        case 'OUTCOME_LEADS':      return 'impressions,reach,frequency,cpm,spend,actions'
        // ADR-057 — 전환 가치(읽기 경로). sales 생성은 여전히 제외(CONTEXT 94), 회수만.
        case 'OUTCOME_SALES':      return 'impressions,clicks,ctr,spend,actions,action_values,purchase_roas'
        case 'OUTCOME_TRAFFIC':
        default:                   return 'impressions,clicks,ctr,spend'
      }
    })()
    const data = await graphFetch<{
      data: Array<{
        date_start: string
        impressions?: string
        clicks?: string
        ctr?: string
        spend?: string
        reach?: string
        frequency?: string
        cpm?: string
        actions?: Array<{ action_type?: string; value?: string }>
        action_values?: Array<{ action_type?: string; value?: string }>
        purchase_roas?: Array<{ action_type?: string; value?: string }>
      }>
    }>(
      `/${campaignId}/insights` +
        `?fields=${fields}` +
        `&time_increment=1${preset}` +
        `&access_token=${token}`
    )

    const extractAction = (acts: Array<{ action_type?: string; value?: string }> | undefined, type: string): number => {
      if (!acts) return 0
      const f = acts.find((a) => a.action_type === type)
      return f ? Number(f.value ?? 0) : 0
    }

    // PRD §13 — goalId 별 daily action 추출.
    const isPostEngagementGoal = goalId === 'engagement' || (!goalId && objective === 'OUTCOME_ENGAGEMENT')
    const isPageLikesGoal      = goalId === 'engagement_page_likes'
    const isMessagesGoal       = goalId === 'engagement_messages'
    const isCallGoal           = goalId === 'leads_call'
    const isPageVisitGoal      = goalId === 'traffic_page_visit'

    const daily = data.data.map((d) => ({
      date: d.date_start,
      impressions: d.impressions !== undefined ? Number(d.impressions) : undefined,
      clicks: Number(d.clicks ?? 0),
      ctr: parseFloat(d.ctr ?? '0'),
      spend: parseFloat(d.spend ?? '0'),
      reach: d.reach !== undefined ? Number(d.reach) : undefined,
      frequency: d.frequency !== undefined ? parseFloat(d.frequency) : undefined,
      cpm: d.cpm !== undefined ? parseFloat(d.cpm) : undefined,
      postEngagement: isPostEngagementGoal ? extractAction(d.actions, 'post_engagement') : undefined,
      postReaction:   isPostEngagementGoal ? extractAction(d.actions, 'post_reaction') : undefined,
      postComment:    isPostEngagementGoal ? extractAction(d.actions, 'comment') : undefined,
      postShare:      isPostEngagementGoal ? extractAction(d.actions, 'post') : undefined,
      landingPageView:               isPageVisitGoal ? extractAction(d.actions, 'landing_page_view') : undefined,
      pageLikeNew:                   isPageLikesGoal ? extractAction(d.actions, 'like') : undefined,
      messagingConversationsStarted: isMessagesGoal  ? extractAction(d.actions, 'onsite_conversion.messaging_conversation_started_7d') : undefined,
      callConfirm:                   isCallGoal      ? extractAction(d.actions, 'click_to_call_call_confirm') : undefined,
    }))

    const totals = daily.reduce(
      (acc, d) => ({
        impressions: acc.impressions,
        clicks: acc.clicks + d.clicks,
        spend: acc.spend + d.spend,
      }),
      { impressions: 0, clicks: 0, spend: 0 }
    )

    const impressionsTotal = data.data.reduce((s, d) => s + Number(d.impressions ?? 0), 0)
    const ctr = impressionsTotal > 0 ? (totals.clicks / impressionsTotal) * 100 : 0

    const reachTotal = data.data.reduce((s, d) => s + (d.reach !== undefined ? Number(d.reach) : 0), 0)
    const frequencyAvg = data.data.length > 0
      ? data.data.reduce((s, d) => s + (d.frequency !== undefined ? parseFloat(d.frequency) : 0), 0) / data.data.length
      : 0
    const cpmAvg = data.data.length > 0
      ? data.data.reduce((s, d) => s + (d.cpm !== undefined ? parseFloat(d.cpm) : 0), 0) / data.data.length
      : 0
    const sumAction = (type: string) => data.data.reduce((s, d) => s + extractAction(d.actions, type), 0)
    const postEngagementTotal = isPostEngagementGoal ? sumAction('post_engagement') : 0
    const postReactionTotal   = isPostEngagementGoal ? sumAction('post_reaction') : 0
    const postCommentTotal    = isPostEngagementGoal ? sumAction('comment') : 0
    const postShareTotal      = isPostEngagementGoal ? sumAction('post') : 0
    const pageLikeTotal       = isPostEngagementGoal ? sumAction('like') : 0

    // PRD §13 신규 goal totals.
    const landingPageViewTotal               = isPageVisitGoal ? sumAction('landing_page_view') : 0
    const pageLikeNewTotal                   = isPageLikesGoal ? sumAction('like') : 0
    const messagingConversationsStartedTotal = isMessagesGoal  ? sumAction('onsite_conversion.messaging_conversation_started_7d') : 0
    const callConfirmTotal                   = isCallGoal      ? sumAction('click_to_call_call_confirm') : 0

    // 도달·빈도·CPM 은 인지도뿐 아니라 페이지팔로우/메시지/전화 goal 에서도 KPI.
    const needsReachStats = objective === 'OUTCOME_AWARENESS' || isPageLikesGoal || isMessagesGoal || isCallGoal

    // ADR-057 — 전환 가치(읽기 경로). 전환 캠페인에서만. 미측정 시 undefined → ROAS 게이트.
    const isSalesObjective = objective === 'OUTCOME_SALES'
    const sumActionTyped = (rows: (d: { action_values?: Array<{ action_type?: string; value?: string }>; purchase_roas?: Array<{ action_type?: string; value?: string }> }) => Array<{ action_type?: string; value?: string }> | undefined) =>
      data.data.reduce((s, d) => {
        const f = rows(d)?.find((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
        return s + (f ? Number(f.value ?? 0) : 0)
      }, 0)
    const purchaseCountTotal = isSalesObjective ? sumAction('purchase') + sumAction('omni_purchase') : 0
    const purchaseValueTotal = isSalesObjective ? sumActionTyped((d) => d.action_values) : 0
    const purchaseValueRound = Math.round(purchaseValueTotal)
    const salesSpend = Math.round(totals.spend)
    const roasTotal = isSalesObjective && salesSpend > 0
      ? Math.round((purchaseValueRound / salesSpend) * 100) / 100
      : 0

    // PRD-ab-testing.md §7.2 — adIds 있으면 level=ad 추가 호출로 광고별 row 두 개.
    let ads: [AdInsightsRow, AdInsightsRow] | undefined
    if (adIds) {
      const adFiltering = encodeURIComponent(JSON.stringify([{ field: 'ad.id', operator: 'IN', value: adIds }]))
      const adData = await graphFetch<{
        data: Array<{ ad_id?: string; impressions?: string; clicks?: string; ctr?: string; spend?: string }>
      }>(
        `/${campaignId}/insights` +
          `?level=ad` +
          `&fields=ad_id,impressions,clicks,ctr,spend` +
          `&filtering=${adFiltering}` +
          (preset || '') +
          `&access_token=${token}`
      )
      const rows = adData.data ?? []
      const mapRow = (id: string): AdInsightsRow => {
        const r = rows.find((row) => row.ad_id === id)
        return {
          adId: id,
          impressions: Math.round(Number(r?.impressions ?? 0)),
          clicks: Math.round(Number(r?.clicks ?? 0)),
          ctr: r?.ctr != null ? Math.round(parseFloat(r.ctr) * 100) / 100 : 0,
          spend: Math.round(parseFloat(r?.spend ?? '0')),
        }
      }
      ads = [mapRow(adIds[0]), mapRow(adIds[1])]
    }

    return {
      impressions: impressionsTotal,
      clicks: totals.clicks,
      ctr: Math.round(ctr * 100) / 100,
      spend: Math.round(totals.spend),
      ...(needsReachStats ? {
        reach: reachTotal,
        frequency: Math.round(frequencyAvg * 100) / 100,
        cpm: Math.round(cpmAvg),
      } : {}),
      ...(isPostEngagementGoal ? {
        postEngagement: postEngagementTotal,
        postReaction: postReactionTotal,
        postComment: postCommentTotal,
        postShare: postShareTotal,
        pageLike: pageLikeTotal,
      } : {}),
      ...(isPageVisitGoal ? { landingPageView: landingPageViewTotal } : {}),
      ...(isPageLikesGoal ? { pageLikeNew: pageLikeNewTotal } : {}),
      ...(isMessagesGoal ? { messagingConversationsStarted: messagingConversationsStartedTotal } : {}),
      ...(isCallGoal ? { callConfirm: callConfirmTotal } : {}),
      ...(isSalesObjective && purchaseValueRound > 0 ? {
        purchaseCount: purchaseCountTotal,
        purchaseValue: purchaseValueRound,
        roas: roasTotal,
      } : {}),
      daily,
      ...(ads ? { ads } : {}),
    }
  },
}
