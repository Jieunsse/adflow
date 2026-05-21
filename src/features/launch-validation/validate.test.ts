import { describe, expect, it } from 'vitest'
import { validateLaunch, hasBlockingIssue } from './validate'

const noPage = { pageId: null, pageName: null, phone: null }
const pageNoPhone = { pageId: 'p1', pageName: '내 페이지', phone: null }
const pageWithPhone = { pageId: 'p1', pageName: '내 페이지', phone: '02-123-4567' }

describe('validateLaunch', () => {
  it('objective null → 빈 배열', () => {
    expect(validateLaunch({ objective: null, callSchedule: [], page: noPage })).toEqual([])
  })

  it('awareness: 검증 룰 없음', () => {
    const issues = validateLaunch({ objective: 'awareness', callSchedule: [], page: noPage })
    expect(issues).toEqual([])
  })

  it('traffic: url_https 룰은 inline 처리라 모달에 나오지 않음', () => {
    const issues = validateLaunch({ objective: 'traffic', callSchedule: [], page: pageWithPhone })
    expect(issues).toEqual([])
  })

  it('traffic_page_visit: 페이지 없으면 block', () => {
    const issues = validateLaunch({ objective: 'traffic_page_visit', callSchedule: [], page: noPage })
    expect(issues).toHaveLength(1)
    expect(issues[0].rule).toBe('page_connected')
    expect(issues[0].severity).toBe('block')
  })

  it('traffic_page_visit: 페이지 있으면 issues 없음', () => {
    const issues = validateLaunch({ objective: 'traffic_page_visit', callSchedule: [], page: pageWithPhone })
    expect(issues).toEqual([])
  })

  it('engagement_messages: 페이지 없으면 block', () => {
    const issues = validateLaunch({ objective: 'engagement_messages', callSchedule: [], page: noPage })
    expect(issues).toHaveLength(1)
    expect(issues[0].rule).toBe('messenger_connected')
    expect(issues[0].severity).toBe('block')
  })

  it('engagement_messages: 페이지 있으면 issues 없음', () => {
    const issues = validateLaunch({ objective: 'engagement_messages', callSchedule: [], page: pageWithPhone })
    expect(issues).toEqual([])
  })

  it('engagement_page_likes: 항상 warn (사용자 확인 필요)', () => {
    const issues = validateLaunch({ objective: 'engagement_page_likes', callSchedule: [], page: pageWithPhone })
    expect(issues).toHaveLength(1)
    expect(issues[0].rule).toBe('page_activity_recent')
    expect(issues[0].severity).toBe('warn')
    expect(hasBlockingIssue(issues)).toBe(false)
  })

  it('leads_call: phone 없으면 block + callSchedule 없으면 block (둘 다)', () => {
    const issues = validateLaunch({ objective: 'leads_call', callSchedule: [], page: pageNoPhone })
    expect(issues).toHaveLength(2)
    expect(issues.map((i) => i.rule).sort()).toEqual(['call_schedule_required', 'page_phone_required'])
    expect(hasBlockingIssue(issues)).toBe(true)
  })

  it('leads_call: phone 있고 callSchedule 비어있으면 call_schedule_required 만', () => {
    const issues = validateLaunch({ objective: 'leads_call', callSchedule: [], page: pageWithPhone })
    expect(issues).toHaveLength(1)
    expect(issues[0].rule).toBe('call_schedule_required')
  })

  it('leads_call: phone 있고 callSchedule 1개 이상이면 issues 없음', () => {
    const issues = validateLaunch({
      objective: 'leads_call',
      callSchedule: [{ day: 1, start: '09:00', end: '18:00' }],
      page: pageWithPhone,
    })
    expect(issues).toEqual([])
  })

  it('block 액션 href: 페이지 미연결은 /connect 로 가는 내부 경로', () => {
    const issues = validateLaunch({ objective: 'traffic_page_visit', callSchedule: [], page: noPage })
    expect(issues[0].action?.href).toBe('/connect')
  })

  it('block 액션 href: leads_call phone 없으면 Meta 비즈니스 외부 URL', () => {
    const issues = validateLaunch({ objective: 'leads_call', callSchedule: [], page: pageNoPhone })
    const phoneIssue = issues.find((i) => i.rule === 'page_phone_required')
    expect(phoneIssue?.action?.href).toMatch(/^https:\/\/business\.facebook\.com/)
  })
})
