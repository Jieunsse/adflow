import type { CampaignSummary, InsightsPeriod, InsightsResult } from './meta-ads'
import type { AdInsightsRow } from '@entities/insights/types'

// 둘러보기 모드에서 보여주는 캠페인 목업. 데모 브랜드 프로필(그린루틴 — 비건 스킨케어)에 맞춰 캠페인명/카피/타겟을 구성.
export const MOCK_CAMPAIGN_SUMMARIES: CampaignSummary[] = [
  {
    id: 'cmp_demo_120207641834',
    name: '그린루틴 — 여름 수분 충전 — 데일리 수분 크림',
    headline: '여름 수분 충전 — 데일리 수분 크림',
    status: 'live',
    objective: 'OUTCOME_TRAFFIC',
    goal: '트래픽',
    startDate: '2026-05-08',
    endDate: '2026-05-21',
    adSetId: 'adset_demo_1',
    adId: 'ad_demo_1',
    dailyBudget: 50000,
    impressions: 56706,
    clicks: 1191,
    ctr: 2.10,
    spend: 482000,
    // ADR-030 데모 — CTR 2.10%(Vanity ✓)인데 도착률 33%(Substance ✗) = 가짜 성과 의심.
    linkClick: 1072,
    landingPageView: 354,
    issueReason: null,
    // PRD-ab-testing.md §4.4 — 시연 A/B 캠페인. startDate 가 과거(>7일) 라 winner case 즉시 노출.
    abTestEnabled: true,
    abTestAxis: 'headline',
    abTestVariantA: '여름 수분 충전 — 데일리 수분 크림',
    abTestVariantB: '끈적임 없이 촉촉하게 — 여름 수분 크림 한정',
    primaryText: '땀과 냉방으로 지친 여름 피부, 무향·무색소 수분 크림으로 가볍게 채워보세요.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://greenroutine.example.com/summer/moisture-cream',
    ageMin: 18,
    ageMax: 35,
    genders: [2],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207641709',
    name: '그린루틴 — 신제품 런칭 — 비건 수분 토너',
    headline: '신제품 런칭 — 비건 수분 토너',
    status: 'live',
    objective: 'OUTCOME_AWARENESS',
    goal: '인지도',
    startDate: '2026-05-03',
    endDate: '2026-05-17',
    adSetId: 'adset_demo_2',
    adId: 'ad_demo_2',
    dailyBudget: 30000,
    impressions: 63929,
    clicks: 479,
    ctr: 0.75,
    spend: 268500,
    issueReason: null,
    // PRD-ab-testing.md §4.4 — 시연 A/B 캠페인. startDate 가 과거(>7일).
    abTestEnabled: true,
    abTestAxis: 'headline',
    abTestVariantA: '신제품 런칭 — 비건 수분 토너',
    abTestVariantB: '결을 순하게 — 비건 인증 수분 토너 출시',
    primaryText: '식물성 성분만 담은 수분 토너, 비건 인증 받았어요. 순하게 결을 정돈해보세요.',
    cta: 'SHOP_NOW',
    landingUrl: 'https://greenroutine.example.com/products/vegan-toner',
    ageMin: 22,
    ageMax: 45,
    genders: [2],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207639518',
    name: '그린루틴 — 비건 스킨케어 입문 가이드',
    headline: '비건 스킨케어 입문 가이드',
    status: 'paused',
    objective: 'OUTCOME_ENGAGEMENT',
    goal: '참여',
    startDate: '2026-04-25',
    endDate: '2026-05-09',
    adSetId: 'adset_demo_3',
    adId: 'ad_demo_3',
    dailyBudget: 25000,
    impressions: 31600,
    clicks: 474,
    ctr: 1.50,
    spend: 158000,
    issueReason: null,
    primaryText: '비건 스킨케어가 처음이라면? 무향·무색소 데일리 루틴을 함께 확인해보세요.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://greenroutine.example.com/guide/vegan-beginner',
    ageMin: 18,
    ageMax: 27,
    genders: [2],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'manual',
    placementPositions: ['instagram_feed', 'instagram_stories'],
  },
  {
    id: 'cmp_demo_120207638203',
    name: '그린루틴 — 감사의 마음 — 비건 기프트 세트',
    headline: '감사의 마음 — 비건 기프트 세트',
    status: 'review',
    objective: 'OUTCOME_TRAFFIC',
    goal: '트래픽',
    startDate: '2026-05-04',
    endDate: '2026-05-12',
    adSetId: 'adset_demo_4',
    adId: 'ad_demo_4',
    dailyBudget: 40000,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    spend: 0,
    issueReason: null,
    primaryText: '소중한 분께 건네는 마음. 비건 인증 스킨케어 기프트 세트를 확인해보세요.',
    cta: 'SHOP_NOW',
    landingUrl: 'https://greenroutine.example.com/gift/skincare-set',
    ageMin: 28,
    ageMax: 50,
    genders: [],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207635117',
    name: '그린루틴 — 봄 한정 — 카밍 세럼',
    headline: '봄 한정 — 카밍 세럼',
    status: 'ended',
    objective: 'OUTCOME_TRAFFIC',
    goal: '트래픽',
    startDate: '2026-03-15',
    endDate: '2026-04-15',
    adSetId: 'adset_demo_5',
    adId: 'ad_demo_5',
    dailyBudget: 35000,
    impressions: 159559,
    clicks: 1915,
    ctr: 1.20,
    spend: 1085000,
    // ADR-030 데모 — 도착률 70%(Substance ✓) = 정상. 뱃지 대비용.
    linkClick: 1724,
    landingPageView: 1207,
    issueReason: null,
    primaryText: '환절기 예민해진 피부에. 식물성 진정 성분을 담은 봄 한정 카밍 세럼이에요.',
    cta: 'ORDER_NOW',
    landingUrl: 'https://greenroutine.example.com/spring/calming-serum',
    ageMin: 20,
    ageMax: 40,
    genders: [2],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207642381',
    name: '그린루틴 — 위클리 특가 — 토너·크림 2종 세트',
    headline: '위클리 특가 — 토너·크림 2종 세트',
    status: 'live',
    objective: 'OUTCOME_TRAFFIC',
    goal: '트래픽',
    startDate: '2026-05-10',
    endDate: '2026-05-24',
    adSetId: 'adset_demo_6',
    adId: 'ad_demo_6',
    dailyBudget: 45000,
    impressions: 53214,
    clicks: 612,
    ctr: 1.15,
    spend: 372500,
    // ADR-030 데모 — 도착률 75%(Substance ✓) = 정상.
    linkClick: 551,
    landingPageView: 413,
    issueReason: null,
    primaryText: '토너와 크림을 함께. 무향·무색소 데일리 2종 세트를 합리적인 구성으로 만나보세요.',
    cta: 'ORDER_NOW',
    landingUrl: 'https://greenroutine.example.com/weekly/duo-set',
    ageMin: 20,
    ageMax: 42,
    genders: [2],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207642109',
    name: '그린루틴 — 지속가능한 비건 뷰티 캠페인',
    headline: '지속가능한 비건 뷰티 캠페인',
    status: 'live',
    objective: 'OUTCOME_AWARENESS',
    goal: '인지도',
    startDate: '2026-05-06',
    endDate: '2026-05-20',
    adSetId: 'adset_demo_7',
    adId: 'ad_demo_7',
    dailyBudget: 28000,
    impressions: 49500,
    clicks: 347,
    ctr: 0.70,
    spend: 198000,
    issueReason: null,
    primaryText: '지구에도 피부에도 순하게. 비건 인증 그린루틴의 지속가능한 루틴을 만나보세요.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://greenroutine.example.com/campaign/sustainable',
    ageMin: 18,
    ageMax: 35,
    genders: [2],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'manual',
    placementPositions: ['instagram_feed', 'instagram_stories', 'facebook_feed'],
  },
  {
    id: 'cmp_demo_120207641987',
    name: '그린루틴 — 리뷰 이벤트 — 인스타그램 인증샷',
    headline: '리뷰 이벤트 — 인스타그램 인증샷',
    status: 'live',
    objective: 'OUTCOME_ENGAGEMENT',
    goal: '참여',
    startDate: '2026-05-09',
    endDate: '2026-05-23',
    adSetId: 'adset_demo_8',
    adId: 'ad_demo_8',
    dailyBudget: 20000,
    impressions: 27308,
    clicks: 382,
    ctr: 1.40,
    spend: 142000,
    issueReason: null,
    primaryText: '그린루틴 사용 후기를 인스타그램에 남겨주세요. 참여하면 다음 구매 혜택을 드려요.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://greenroutine.example.com/event/review-challenge',
    ageMin: 18,
    ageMax: 32,
    genders: [2],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207641542',
    name: '그린루틴 — 브랜드 스토리 — 우리가 비건을 택한 이유',
    headline: '브랜드 스토리 — 우리가 비건을 택한 이유',
    status: 'review',
    objective: 'OUTCOME_AWARENESS',
    goal: '인지도',
    startDate: '2026-05-13',
    endDate: '2026-05-27',
    adSetId: 'adset_demo_9',
    adId: 'ad_demo_9',
    dailyBudget: 32000,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    spend: 0,
    issueReason: null,
    primaryText: '화학 첨가물 대신 식물성 성분을 택한 이유. 그린루틴의 시작 이야기를 들려드려요.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://greenroutine.example.com/brand/our-story',
    ageMin: 25,
    ageMax: 55,
    genders: [],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207641223',
    name: '그린루틴 — 다음 신제품 투표 — 커뮤니티 참여',
    headline: '다음 신제품 투표 — 커뮤니티 참여',
    status: 'review',
    objective: 'OUTCOME_ENGAGEMENT',
    goal: '참여',
    startDate: '2026-05-14',
    endDate: '2026-05-28',
    adSetId: 'adset_demo_10',
    adId: 'ad_demo_10',
    dailyBudget: 18000,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    spend: 0,
    issueReason: null,
    primaryText: '다음에 출시할 비건 스킨케어를 직접 골라주세요. 투표에 참여하면 샘플을 드려요.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://greenroutine.example.com/vote/next-product',
    ageMin: 20,
    ageMax: 45,
    genders: [2],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207640814',
    name: '그린루틴 — 봄맞이 멤버십 혜택',
    headline: '봄맞이 멤버십 혜택',
    status: 'issue',
    objective: 'OUTCOME_TRAFFIC',
    goal: '트래픽',
    startDate: '2026-05-02',
    endDate: '2026-05-16',
    adSetId: 'adset_demo_11',
    adId: 'ad_demo_11',
    dailyBudget: 38000,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    spend: 0,
    issueReason: {
      summary: '랜딩 페이지가 정책 위반',
      message: '광고 랜딩 페이지가 Meta 광고 정책 — 비기능적 랜딩 페이지 — 에 위반된다고 표시됐어요. 페이지 로딩 오류 또는 페이지 내 광고와 직접적인 관련이 없는 콘텐츠 때문일 수 있어요.',
    },
    primaryText: '그린루틴 멤버십으로 누리는 봄맞이 혜택. 자세한 내용을 확인해보세요.',
    cta: 'SHOP_NOW',
    landingUrl: 'https://greenroutine.example.com/membership/spring',
    ageMin: 28,
    ageMax: 50,
    genders: [2],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207640321',
    name: '그린루틴 — 봄맞이 기획전 — 데일리 선크림',
    headline: '봄맞이 기획전 — 데일리 선크림',
    status: 'paused',
    objective: 'OUTCOME_AWARENESS',
    goal: '인지도',
    startDate: '2026-04-18',
    endDate: '2026-05-04',
    adSetId: 'adset_demo_12',
    adId: 'ad_demo_12',
    dailyBudget: 26000,
    impressions: 72558,
    clicks: 522,
    ctr: 0.72,
    spend: 312000,
    issueReason: null,
    primaryText: '가볍게 발리는 무향 데일리 선크림. 봄맞이 기획전 구성을 확인해보세요.',
    cta: 'SHOP_NOW',
    landingUrl: 'https://greenroutine.example.com/spring/sunscreen',
    ageMin: 20,
    ageMax: 45,
    genders: [2],
    countries: ['KR'],
    platforms: 'facebook',
    placementMode: 'manual',
    placementPositions: ['facebook_feed'],
  },
  {
    // ADR-057 데모 — 전환(sales) 캠페인. ROAS 카드를 그럴듯하게 시연(데모≠실값). purchaseValue/roas 합성.
    id: 'cmp_demo_120207643012',
    name: '그린루틴 — 가을 세일 — 비건 세트 구매 전환',
    headline: '가을 세일 — 비건 세트 구매 전환',
    status: 'live',
    objective: 'OUTCOME_SALES',
    goal: '전환',
    startDate: '2026-05-07',
    endDate: '2026-05-21',
    adSetId: 'adset_demo_14',
    adId: 'ad_demo_14',
    dailyBudget: 60000,
    impressions: 76500,
    clicks: 995,
    ctr: 1.30,
    spend: 612000,
    linkClick: 876,
    landingPageView: 613,
    purchaseCount: 46,
    purchaseValue: 1_518_000,
    roas: 2.48,
    issueReason: null,
    primaryText: '가을 세일 한정 구성. 비건 토너·크림 세트를 합리적인 가격에 만나보세요.',
    cta: 'SHOP_NOW',
    landingUrl: 'https://greenroutine.example.com/sale/autumn-set',
    ageMin: 22,
    ageMax: 45,
    genders: [2],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207634892',
    name: '그린루틴 — 겨울 한정 — 고보습 나이트 크림',
    headline: '겨울 한정 — 고보습 나이트 크림',
    status: 'ended',
    objective: 'OUTCOME_ENGAGEMENT',
    goal: '참여',
    startDate: '2026-02-01',
    endDate: '2026-03-01',
    adSetId: 'adset_demo_13',
    adId: 'ad_demo_13',
    dailyBudget: 30000,
    impressions: 150000,
    clicks: 2025,
    ctr: 1.35,
    spend: 825000,
    issueReason: null,
    primaryText: '건조한 겨울밤, 자는 동안 채우는 고보습 나이트 크림. 식물성 성분으로 순하게.',
    cta: 'ORDER_NOW',
    landingUrl: 'https://greenroutine.example.com/winter/night-cream',
    ageMin: 22,
    ageMax: 50,
    genders: [2],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'auto',
  },
]

export function getMockCampaign(id: string): CampaignSummary | null {
  return MOCK_CAMPAIGN_SUMMARIES.find((c) => c.id === id) ?? null
}

// PRD-ab-testing.md §4.4 / §7.5 — 사용자 생성 캠페인의 fake adIds (`mock_ad_{campaignId}_a/b`) 와 동일 prefix.
// mock 시연 캠페인이 abTestEnabled 면 동일 형식의 adIds 자동 도출 — getMockInsights 가 광고별 시드 진입에 사용.
export function getMockCampaignAdIds(id: string): [string, string] | null {
  const c = getMockCampaign(id)
  if (!c?.abTestEnabled) return null
  return [`mock_ad_${id}_a`, `mock_ad_${id}_b`]
}

// Deterministic pseudo-random so the same id always produces the same series.
function seededVariance(seed: string, index: number, span = 0.35): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  h = (h * 9301 + index * 49297 + 233280) | 0
  const r = ((h % 10000) + 10000) % 10000 / 10000
  return 1 - span / 2 + r * span
}

function daysBetween(start: string, end: string): number {
  const s = Date.parse(start + 'T00:00:00+09:00')
  const e = Date.parse(end + 'T00:00:00+09:00')
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

function isoDate(start: string, offsetDays: number): string {
  const s = new Date(start + 'T00:00:00+09:00')
  s.setDate(s.getDate() + offsetDays)
  return s.toISOString().slice(0, 10)
}

export function getMockInsights(id: string, period: InsightsPeriod = 'all', adIds?: [string, string]): InsightsResult {
  const c = getMockCampaign(id)
  if (!c || !c.startDate || !c.endDate) {
    return { impressions: 0, clicks: 0, ctr: 0, spend: 0, daily: [] }
  }
  const totalDays = daysBetween(c.startDate, c.endDate)
  const windowDays = period === '7d' ? Math.min(7, totalDays) : period === '30d' ? Math.min(30, totalDays) : totalDays
  const startOffset = totalDays - windowDays

  // Distribute totals across windowDays with deterministic variance, then normalize back to totals.
  const rawClicks = Array.from({ length: windowDays }, (_, i) => (c.clicks / totalDays) * seededVariance(c.id + 'c', i))
  const rawImps = Array.from({ length: windowDays }, (_, i) => (c.impressions / totalDays) * seededVariance(c.id + 'i', i))
  const rawSpend = Array.from({ length: windowDays }, (_, i) => (c.spend / totalDays) * seededVariance(c.id + 's', i))

  const sumClicks = rawClicks.reduce((a, b) => a + b, 0) || 1
  const sumImps = rawImps.reduce((a, b) => a + b, 0) || 1
  const sumSpend = rawSpend.reduce((a, b) => a + b, 0) || 1

  // Scale to match window-proportional totals (e.g. 7d window of 14d campaign ≈ half the totals).
  const windowImpressions = Math.round(c.impressions * (windowDays / totalDays))
  const windowClicks = Math.round(c.clicks * (windowDays / totalDays))
  const windowSpend = Math.round(c.spend * (windowDays / totalDays))

  const daily = Array.from({ length: windowDays }, (_, i) => {
    const clicks = Math.round((rawClicks[i] / sumClicks) * windowClicks)
    const impressions = Math.round((rawImps[i] / sumImps) * windowImpressions)
    const spend = Math.round((rawSpend[i] / sumSpend) * windowSpend)
    const ctr = impressions ? (clicks / impressions) * 100 : 0
    return { date: isoDate(c.startDate!, startOffset + i), clicks, ctr, spend, impressions }
  })

  const totalImpressions = daily.reduce((s, d) => s + (d.impressions ?? 0), 0)
  const totalClicks = daily.reduce((s, d) => s + d.clicks, 0)
  const totalSpend = daily.reduce((s, d) => s + d.spend, 0)
  const ctr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0

  // PRD-ab-testing.md §7.3 — adIds 가 있으면 광고별 row 두 개 시드. startDate ↔ 현재 날짜 차이로 단계 결정.
  // 결정적 시드 = campaignId hash. 같은 캠페인 + 같은 시간 구간이면 항상 같은 결과.
  const ads = adIds ? seedMockAdRows(id, c.startDate!, adIds) : undefined

  return { impressions: totalImpressions, clicks: totalClicks, ctr, spend: totalSpend, daily, ...(ads ? { ads } : {}) }
}

// PRD-ab-testing.md §7.3 — 단계 룰:
//   < 1일      → insufficient(impressions) — 광고당 < 1000 노출
//   1~3일      → insufficient(clicks)      — 광고당 ≥ 1000 노출 + < 10 클릭
//   3~7일      → inconclusive(90%) / winner(10%)
//   > 7일      → winner(80%) / inconclusive(20%)
// export — client(개발모드 사용자 생성 캠페인의 fake adIds) 가 launched.startDate 로 합성에 사용.
export function seedMockAdRows(campaignId: string, startDate: string, adIds: [string, string]): [AdInsightsRow, AdInsightsRow] {
  const now = Date.now()
  const start = Date.parse(startDate + 'T00:00:00+09:00')
  const daysSince = Math.floor((now - start) / 86400000)

  let h = 0
  for (let i = 0; i < campaignId.length; i++) h = (h * 31 + campaignId.charCodeAt(i)) | 0
  const r = ((h % 100) + 100) % 100  // 0–99 결정적

  const mk = (id: string, impressions: number, clicks: number, spend: number): AdInsightsRow => ({
    adId: id,
    impressions,
    clicks,
    ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
    spend,
  })

  if (daysSince < 1) {
    // < 1일 — 광고당 < 1000 노출 (insufficient impressions).
    const impA = 500 + (r % 50) * 4
    return [mk(adIds[0], impA, 5, 12000), mk(adIds[1], impA - 60, 4, 11500)]
  }
  if (daysSince <= 3) {
    // 1~3일 — 광고당 ≥ 1000 노출, < 10 클릭 (insufficient clicks).
    const impA = 2000 + (r % 100) * 30
    return [mk(adIds[0], impA, 8, 45000), mk(adIds[1], impA - 200, 6, 44000)]
  }
  if (daysSince <= 7) {
    // 3~7일 — inconclusive 90% / winner 10%.
    const isWinner = r < 10
    const impA = 12000 + (r % 100) * 100
    if (isWinner) {
      return [mk(adIds[0], impA, 200, 110000), mk(adIds[1], impA, 300, 112000)]  // B 우세 1.5×
    }
    return [mk(adIds[0], impA, 200, 100000), mk(adIds[1], impA - 200, 210, 102000)]  // 차이 ~ 1.06×
  }
  // > 7일 — winner 80% / inconclusive 20%.
  if (r < 80) {
    const impA = 25000 + (r % 100) * 200
    const winnerIsB = r % 2 === 0
    return winnerIsB
      ? [mk(adIds[0], impA, 400, 220000), mk(adIds[1], impA, 600, 228000)]   // B 우세 1.5×
      : [mk(adIds[0], impA, 600, 228000), mk(adIds[1], impA, 400, 220000)]   // A 우세 1.5×
  }
  const impA = 25000 + (r % 100) * 150
  return [mk(adIds[0], impA, 420, 230000), mk(adIds[1], impA - 500, 440, 226000)]  // 차이 ~ 1.05×
}
