import type { CampaignSummary } from './meta-ads'
import { MOCK_CAMPAIGN_SUMMARIES } from './mock-campaigns'

export type Role = 'owner' | 'launcher' | 'reviewer'
export type MemberStatus = 'active' | 'invited'

export interface Member {
  id: string
  name: string | null
  email: string
  role: Role
  status: MemberStatus
  joined: string | null
  lastActive: string | null
  avatarBg: string | null
}

export const MOCK_MEMBERS: Member[] = [
  { id: 'u1', name: '둘러보기 사용자', email: 'demo@greenroutine.co', role: 'owner', status: 'active', joined: '2025-05-11', lastActive: '방금 전', avatarBg: '#ff7a59' },
  { id: 'u2', name: '박서윤', email: 'seoyoon@greenroutine.co', role: 'launcher', status: 'active', joined: '2024-12-03', lastActive: '12분 전', avatarBg: '#0066ff' },
  { id: 'u3', name: '이도현', email: 'dohyun@greenroutine.co', role: 'launcher', status: 'active', joined: '2025-01-20', lastActive: '1시간 전', avatarBg: '#008a2e' },
  { id: 'u4', name: '정민서', email: 'minseo@greenroutine.co', role: 'launcher', status: 'active', joined: '2025-02-08', lastActive: '어제', avatarBg: '#c2185b' },
  { id: 'u5', name: '김하늘', email: 'haneul@greenroutine.co', role: 'reviewer', status: 'active', joined: '2025-03-15', lastActive: '어제', avatarBg: '#6541f2' },
  { id: 'u6', name: '오현우', email: 'hyunwoo@greenroutine.co', role: 'reviewer', status: 'active', joined: '2025-04-02', lastActive: '3일 전', avatarBg: '#9c5800' },
  { id: 'i1', name: null, email: 'newbie@greenroutine.co', role: 'launcher', status: 'invited', joined: null, lastActive: null, avatarBg: null },
  { id: 'i2', name: null, email: 'intern@greenroutine.co', role: 'reviewer', status: 'invited', joined: null, lastActive: null, avatarBg: null },
]

export function getMember(id: string): Member | null {
  return MOCK_MEMBERS.find((m) => m.id === id) ?? null
}

// 캠페인당 생성자·게재자 매핑. reviewer 도 생성은 가능 (게재는 owner/launcher 만).
export const MOCK_CAMPAIGN_ATTRIBUTION: Record<string, { createdBy: string; launchedBy: string | null }> = {
  cmp_demo_120207641834: { createdBy: 'u1', launchedBy: 'u1' }, // 트로피컬 아이스티
  cmp_demo_120207641709: { createdBy: 'u2', launchedBy: 'u2' }, // 콜드브루
  cmp_demo_120207639518: { createdBy: 'u3', launchedBy: 'u3' }, // 수험생
  cmp_demo_120207638203: { createdBy: 'u4', launchedBy: 'u4' }, // 어버이날 (review)
  cmp_demo_120207635117: { createdBy: 'u5', launchedBy: 'u1' }, // 라벤더 — 김하늘이 만들고 Jayden 이 게재
  cmp_demo_120207642381: { createdBy: 'u3', launchedBy: 'u3' }, // 베이커리
  cmp_demo_120207642109: { createdBy: 'u2', launchedBy: 'u2' }, // 굿즈
  cmp_demo_120207641987: { createdBy: 'u4', launchedBy: 'u4' }, // 인스타 챌린지
  cmp_demo_120207641542: { createdBy: 'u2', launchedBy: 'u2' }, // 브랜드 스토리 (review)
  cmp_demo_120207641223: { createdBy: 'u5', launchedBy: 'u4' }, // 신메뉴 투표 — 김하늘이 만들고 정민서가 게재 (review)
  cmp_demo_120207640814: { createdBy: 'u1', launchedBy: 'u1' }, // 가정의 달 (issue)
  cmp_demo_120207640321: { createdBy: 'u6', launchedBy: 'u3' }, // 라이트 라떼 — 오현우가 만들고 이도현이 게재
  cmp_demo_120207634892: { createdBy: 'u6', launchedBy: 'u2' }, // 핫초콜릿 — 오현우가 만들고 박서윤이 게재
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface ReviewRequest {
  id: string
  campaignId: string
  requestedBy: string  // memberId — 보낸 사람
  requestedTo: string  // memberId — 받는 사람
  status: ReviewStatus
  requestedAt: string  // YYYY-MM-DD
  respondedAt: string | null
  comment: string | null  // 반려 사유 등
}

export const MOCK_REVIEW_REQUESTS: ReviewRequest[] = [
  { id: 'rr01', campaignId: 'cmp_demo_120207641834', requestedBy: 'u1', requestedTo: 'u5', status: 'approved',  requestedAt: '2026-05-06', respondedAt: '2026-05-07', comment: null },
  { id: 'rr02', campaignId: 'cmp_demo_120207641709', requestedBy: 'u2', requestedTo: 'u6', status: 'approved',  requestedAt: '2026-05-01', respondedAt: '2026-05-02', comment: null },
  { id: 'rr03', campaignId: 'cmp_demo_120207639518', requestedBy: 'u3', requestedTo: 'u5', status: 'approved',  requestedAt: '2026-04-23', respondedAt: '2026-04-24', comment: null },
  { id: 'rr04', campaignId: 'cmp_demo_120207638203', requestedBy: 'u4', requestedTo: 'u5', status: 'pending',   requestedAt: '2026-05-13', respondedAt: null,         comment: null },
  { id: 'rr05', campaignId: 'cmp_demo_120207638203', requestedBy: 'u4', requestedTo: 'u6', status: 'pending',   requestedAt: '2026-05-13', respondedAt: null,         comment: null },
  { id: 'rr06', campaignId: 'cmp_demo_120207635117', requestedBy: 'u5', requestedTo: 'u6', status: 'approved',  requestedAt: '2026-03-13', respondedAt: '2026-03-14', comment: null },
  { id: 'rr07', campaignId: 'cmp_demo_120207642381', requestedBy: 'u3', requestedTo: 'u6', status: 'approved',  requestedAt: '2026-05-08', respondedAt: '2026-05-09', comment: null },
  { id: 'rr08', campaignId: 'cmp_demo_120207642109', requestedBy: 'u2', requestedTo: 'u5', status: 'pending',   requestedAt: '2026-05-05', respondedAt: null,         comment: null },
  { id: 'rr09', campaignId: 'cmp_demo_120207641987', requestedBy: 'u4', requestedTo: 'u5', status: 'approved',  requestedAt: '2026-05-07', respondedAt: '2026-05-08', comment: null },
  { id: 'rr10', campaignId: 'cmp_demo_120207641542', requestedBy: 'u2', requestedTo: 'u5', status: 'pending',   requestedAt: '2026-05-12', respondedAt: null,         comment: null },
  { id: 'rr11', campaignId: 'cmp_demo_120207641542', requestedBy: 'u2', requestedTo: 'u6', status: 'rejected',  requestedAt: '2026-05-12', respondedAt: '2026-05-13', comment: '브랜드 스토리 톤이 자사 가이드와 너무 다르게 느껴져요. 결말 부분을 좀 더 우리답게 톤다운하면 좋겠어요.' },
  { id: 'rr12', campaignId: 'cmp_demo_120207641223', requestedBy: 'u5', requestedTo: 'u6', status: 'pending',   requestedAt: '2026-05-14', respondedAt: null,         comment: null },
  { id: 'rr13', campaignId: 'cmp_demo_120207640814', requestedBy: 'u1', requestedTo: 'u5', status: 'rejected',  requestedAt: '2026-04-30', respondedAt: '2026-05-01', comment: '랜딩 페이지 정책 위반 이슈가 해결되지 않으면 게재 어려울 것 같아요. 페이지 로딩 부분부터 다시 확인 부탁드려요.' },
  { id: 'rr14', campaignId: 'cmp_demo_120207640814', requestedBy: 'u1', requestedTo: 'u6', status: 'approved',  requestedAt: '2026-04-30', respondedAt: '2026-05-02', comment: null },
  { id: 'rr15', campaignId: 'cmp_demo_120207640321', requestedBy: 'u6', requestedTo: 'u5', status: 'approved',  requestedAt: '2026-04-16', respondedAt: '2026-04-17', comment: null },
  { id: 'rr16', campaignId: 'cmp_demo_120207634892', requestedBy: 'u6', requestedTo: 'u5', status: 'approved',  requestedAt: '2026-01-29', respondedAt: '2026-01-30', comment: null },
  { id: 'rr17', campaignId: 'cmp_demo_120207634892', requestedBy: 'u2', requestedTo: 'u6', status: 'approved',  requestedAt: '2026-01-30', respondedAt: '2026-01-31', comment: null },
]

export type ReviewDirection = 'outgoing' | 'incoming'

export interface ReviewActivityItem {
  request: ReviewRequest
  campaign: CampaignSummary
  direction: ReviewDirection  // outgoing = 내가 보낸 요청, incoming = 내가 받은 요청
  counterpart: Member          // 상대 멤버
}

export interface MemberActivity {
  created: CampaignSummary[]
  launched: CampaignSummary[]
  reviews: ReviewActivityItem[]
}

export function getMemberActivity(memberId: string): MemberActivity {
  const created: CampaignSummary[] = []
  const launched: CampaignSummary[] = []

  for (const c of MOCK_CAMPAIGN_SUMMARIES) {
    const attr = MOCK_CAMPAIGN_ATTRIBUTION[c.id]
    if (!attr) continue
    if (attr.createdBy === memberId) created.push(c)
    if (attr.launchedBy === memberId) launched.push(c)
  }

  const reviews: ReviewActivityItem[] = []
  for (const r of MOCK_REVIEW_REQUESTS) {
    const isOut = r.requestedBy === memberId
    const isIn = r.requestedTo === memberId
    if (!isOut && !isIn) continue
    const campaign = MOCK_CAMPAIGN_SUMMARIES.find((c) => c.id === r.campaignId)
    if (!campaign) continue
    const counterpartId = isOut ? r.requestedTo : r.requestedBy
    const counterpart = getMember(counterpartId)
    if (!counterpart) continue
    reviews.push({
      request: r,
      campaign,
      direction: isOut ? 'outgoing' : 'incoming',
      counterpart,
    })
  }

  // 최신순 정렬 — 캠페인의 startDate / 검토는 requestedAt
  created.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
  launched.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
  reviews.sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt))

  return { created, launched, reviews }
}
