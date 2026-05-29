import type { CampaignSummary, InsightsPeriod, InsightsResult } from './meta-ads'
import type { AdInsightsRow } from '@entities/insights/types'

// 둘러보기 모드에서 보여주는 캠페인 목업. 대시보드의 MOCK_CAMPAIGNS 와 시각적 일관성을 위해 캠페인명/지표를 맞춤.
export const MOCK_CAMPAIGN_SUMMARIES: CampaignSummary[] = [
  {
    id: 'cmp_demo_120207641834',
    name: 'AdFlow — 여름 시즌 한정 — 트로피컬 아이스티',
    headline: '여름 시즌 한정 — 트로피컬 아이스티',
    status: 'live',
    objective: 'OUTCOME_TRAFFIC',
    goal: '트래픽',
    startDate: '2026-05-08',
    endDate: '2026-05-21',
    adSetId: 'adset_demo_1',
    adId: 'ad_demo_1',
    dailyBudget: 50000,
    impressions: 184320,
    clicks: 4926,
    ctr: 2.67,
    spend: 482000,
    // ADR-030 데모 — CTR 2.67%(Vanity ✓)인데 도착률 35%(Substance ✗) = 가짜 성과 의심.
    linkClick: 4200,
    landingPageView: 1470,
    issueReason: null,
    // PRD-ab-testing.md §4.4 — 시연 A/B 캠페인. startDate 가 과거(>7일) 라 winner case 즉시 노출.
    abTestEnabled: true,
    abTestAxis: 'headline',
    abTestVariantA: '여름 시즌 한정 — 트로피컬 아이스티',
    abTestVariantB: '여름엔 시원하게 — 트로피컬 아이스티 한정 할인',
    primaryText: '무더운 여름, 시원함을 한 잔에! 기간 한정 특별 출시, 지금 만나보세요.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://cafe.example.com/seasonal/tropical',
    ageMin: 18,
    ageMax: 35,
    genders: [],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207641709',
    name: 'AdFlow — 신상 런칭 — 콜드브루 오리지널',
    headline: '신상 런칭 — 콜드브루 오리지널',
    status: 'live',
    objective: 'OUTCOME_AWARENESS',
    goal: '인지도',
    startDate: '2026-05-03',
    endDate: '2026-05-17',
    adSetId: 'adset_demo_2',
    adId: 'ad_demo_2',
    dailyBudget: 30000,
    impressions: 98140,
    clicks: 2104,
    ctr: 2.14,
    spend: 268500,
    issueReason: null,
    // PRD-ab-testing.md §4.4 — 시연 A/B 캠페인. startDate 가 과거(>7일).
    abTestEnabled: true,
    abTestAxis: 'headline',
    abTestVariantA: '신상 런칭 — 콜드브루 오리지널',
    abTestVariantB: '오리지널 풍미 그대로 — 콜드브루 신상 출시',
    primaryText: '진한 원두 풍미 그대로, 콜드브루 오리지널. 지금 맛보세요.',
    cta: 'SHOP_NOW',
    landingUrl: 'https://cafe.example.com/menu/cold-brew',
    ageMin: 22,
    ageMax: 45,
    genders: [],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207639518',
    name: 'AdFlow — 수험생 응원 — 에너지 패키지',
    headline: '수험생 응원 — 에너지 패키지',
    status: 'paused',
    objective: 'OUTCOME_ENGAGEMENT',
    goal: '참여',
    startDate: '2026-04-25',
    endDate: '2026-05-09',
    adSetId: 'adset_demo_3',
    adId: 'ad_demo_3',
    dailyBudget: 25000,
    impressions: 62480,
    clicks: 1287,
    ctr: 2.06,
    spend: 158000,
    issueReason: null,
    primaryText: '수험생 여러분을 응원합니다. 에너지 충전 패키지로 힘내세요!',
    cta: 'LEARN_MORE',
    landingUrl: 'https://cafe.example.com/student-pack',
    ageMin: 16,
    ageMax: 25,
    genders: [],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'manual',
    placementPositions: ['instagram_feed', 'instagram_stories'],
  },
  {
    id: 'cmp_demo_120207638203',
    name: 'AdFlow — 어버이날 특별 패키지',
    headline: '어버이날 특별 패키지',
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
    primaryText: '부모님께 감사함을 전하세요. 어버이날 특별 선물 패키지 한정 판매!',
    cta: 'SHOP_NOW',
    landingUrl: 'https://cafe.example.com/gift/parents-day',
    ageMin: 28,
    ageMax: 50,
    genders: [],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207635117',
    name: 'AdFlow — 봄 신상 — 라벤더 라떼',
    headline: '봄 신상 — 라벤더 라떼',
    status: 'ended',
    objective: 'OUTCOME_TRAFFIC',
    goal: '트래픽',
    startDate: '2026-03-15',
    endDate: '2026-04-15',
    adSetId: 'adset_demo_5',
    adId: 'ad_demo_5',
    dailyBudget: 35000,
    impressions: 312840,
    clicks: 7521,
    ctr: 2.40,
    spend: 1085000,
    // ADR-030 데모 — 도착률 70%(Substance ✓) = 정상. 뱃지 대비용.
    linkClick: 6800,
    landingPageView: 4760,
    issueReason: null,
    primaryText: '봄의 향기를 담은 라벤더 라떼, 기간 한정 신메뉴. 지금 주문하세요.',
    cta: 'ORDER_NOW',
    landingUrl: 'https://cafe.example.com/spring/lavender-latte',
    ageMin: 20,
    ageMax: 40,
    genders: [2],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207642381',
    name: 'AdFlow — 주말 한정 — 베이커리 세트',
    headline: '주말 한정 — 베이커리 세트',
    status: 'live',
    objective: 'OUTCOME_TRAFFIC',
    goal: '트래픽',
    startDate: '2026-05-10',
    endDate: '2026-05-24',
    adSetId: 'adset_demo_6',
    adId: 'ad_demo_6',
    dailyBudget: 45000,
    impressions: 142680,
    clicks: 3814,
    ctr: 2.67,
    spend: 372500,
    // ADR-030 데모 — 도착률 75%(Substance ✓) = 정상.
    linkClick: 3400,
    landingPageView: 2550,
    issueReason: null,
    primaryText: '주말만의 특별한 베이커리 세트. 갓 구운 빵과 음료의 완벽한 조합!',
    cta: 'ORDER_NOW',
    landingUrl: 'https://cafe.example.com/weekend/bakery-set',
    ageMin: 20,
    ageMax: 42,
    genders: [],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207642109',
    name: 'AdFlow — 시즌 캠페인 — 한정 굿즈 컬렉션',
    headline: '시즌 캠페인 — 한정 굿즈 컬렉션',
    status: 'live',
    objective: 'OUTCOME_AWARENESS',
    goal: '인지도',
    startDate: '2026-05-06',
    endDate: '2026-05-20',
    adSetId: 'adset_demo_7',
    adId: 'ad_demo_7',
    dailyBudget: 28000,
    impressions: 76420,
    clicks: 1502,
    ctr: 1.96,
    spend: 198000,
    issueReason: null,
    primaryText: '한정 굿즈 컬렉션, 지금만 만날 수 있어요. 놓치기 전에 확인하세요!',
    cta: 'LEARN_MORE',
    landingUrl: 'https://cafe.example.com/goods/season',
    ageMin: 18,
    ageMax: 35,
    genders: [],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'manual',
    placementPositions: ['instagram_feed', 'instagram_stories', 'facebook_feed'],
  },
  {
    id: 'cmp_demo_120207641987',
    name: 'AdFlow — 팔로워 이벤트 — 인스타그램 챌린지',
    headline: '팔로워 이벤트 — 인스타그램 챌린지',
    status: 'live',
    objective: 'OUTCOME_ENGAGEMENT',
    goal: '참여',
    startDate: '2026-05-09',
    endDate: '2026-05-23',
    adSetId: 'adset_demo_8',
    adId: 'ad_demo_8',
    dailyBudget: 20000,
    impressions: 54310,
    clicks: 1287,
    ctr: 2.37,
    spend: 142000,
    issueReason: null,
    primaryText: '인스타그램 팔로워 이벤트 참여하고 특별 혜택 받으세요!',
    cta: 'LEARN_MORE',
    landingUrl: 'https://cafe.example.com/event/challenge',
    ageMin: 18,
    ageMax: 32,
    genders: [],
    countries: ['KR'],
    platforms: 'instagram',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207641542',
    name: 'AdFlow — 브랜드 스토리 — 우리의 시작',
    headline: '브랜드 스토리 — 우리의 시작',
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
    primaryText: '우리의 작은 시작, 그 이야기를 함께 나눠요. AdFlow 카페 브랜드 스토리.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://cafe.example.com/brand/our-story',
    ageMin: 25,
    ageMax: 55,
    genders: [],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207641223',
    name: 'AdFlow — 신메뉴 투표 — 커뮤니티 참여',
    headline: '신메뉴 투표 — 커뮤니티 참여',
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
    primaryText: '다음 신메뉴를 직접 골라주세요! 커뮤니티 투표 참여하면 쿠폰 증정.',
    cta: 'LEARN_MORE',
    landingUrl: 'https://cafe.example.com/vote/new-menu',
    ageMin: 20,
    ageMax: 45,
    genders: [],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207640814',
    name: 'AdFlow — 가정의 달 — 가족 패키지',
    headline: '가정의 달 — 가족 패키지',
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
    primaryText: '가정의 달 특별 패키지, 가족과 함께하는 특별한 시간.',
    cta: 'SHOP_NOW',
    landingUrl: 'https://cafe.example.com/family-pack',
    ageMin: 30,
    ageMax: 55,
    genders: [],
    countries: ['KR'],
    platforms: 'both',
    placementMode: 'auto',
  },
  {
    id: 'cmp_demo_120207640321',
    name: 'AdFlow — 봄맞이 세일 — 라이트 라떼',
    headline: '봄맞이 세일 — 라이트 라떼',
    status: 'paused',
    objective: 'OUTCOME_AWARENESS',
    goal: '인지도',
    startDate: '2026-04-18',
    endDate: '2026-05-04',
    adSetId: 'adset_demo_12',
    adId: 'ad_demo_12',
    dailyBudget: 26000,
    impressions: 89240,
    clicks: 1872,
    ctr: 2.10,
    spend: 312000,
    issueReason: null,
    primaryText: '봄맞이 세일! 라이트 라떼 50% 할인. 지금 바로 만나보세요.',
    cta: 'SHOP_NOW',
    landingUrl: 'https://cafe.example.com/spring-sale',
    ageMin: 20,
    ageMax: 45,
    genders: [],
    countries: ['KR'],
    platforms: 'facebook',
    placementMode: 'manual',
    placementPositions: ['facebook_feed'],
  },
  {
    id: 'cmp_demo_120207634892',
    name: 'AdFlow — 겨울 한정 — 핫초콜릿 프리미엄',
    headline: '겨울 한정 — 핫초콜릿 프리미엄',
    status: 'ended',
    objective: 'OUTCOME_ENGAGEMENT',
    goal: '참여',
    startDate: '2026-02-01',
    endDate: '2026-03-01',
    adSetId: 'adset_demo_13',
    adId: 'ad_demo_13',
    dailyBudget: 30000,
    impressions: 198450,
    clicks: 4218,
    ctr: 2.13,
    spend: 825000,
    issueReason: null,
    primaryText: '따뜻한 겨울밤, 프리미엄 핫초콜릿 한 잔의 여유.',
    cta: 'ORDER_NOW',
    landingUrl: 'https://cafe.example.com/winter/hot-choco',
    ageMin: 22,
    ageMax: 50,
    genders: [],
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
