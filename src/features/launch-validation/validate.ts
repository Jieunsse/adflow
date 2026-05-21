// PRD-objective-aware-launch §3·§5.1 — pre_launch 검증.
// profile.validations 의 룰을 launchState + 외부 context (page phone, page 연결 등) 와 결합해 issues 산출.
//
// V1 룰:
//   - messenger_connected     (engagement_messages)  : session.pageId 있어야 — block
//   - page_phone_required     (leads_call)           : activePage.phone 있어야 — block
//   - call_schedule_required  (leads_call)           : callSchedule.length >= 1 — block
//   - page_activity_recent    (engagement_page_likes): V1 = 자동 체크 X, 사용자 확인 — warn
//   - page_connected          (traffic_page_visit)   : session.pageId 있어야 — block
//   - url_https               (traffic 외)           : inline 에서 처리, 본 모듈은 skip
//
// 결과 = 빈 배열이면 모달 없이 바로 launch.

import type { ObjectivePhase1Id } from '@entities/creative/options'
import { LAUNCH_PROFILES } from '@entities/launch-objective/profile'
import type { CallScheduleSlot } from '@entities/campaign/model'
import type { PageContext, ValidationIssue } from './types'

export type ValidateLaunchInput = {
  objective: ObjectivePhase1Id | null
  callSchedule: CallScheduleSlot[]
  page: PageContext
}

const META_BUSINESS_PAGE_SETTINGS = 'https://business.facebook.com/latest/settings/page_info'

export function validateLaunch(input: ValidateLaunchInput): ValidationIssue[] {
  const { objective, callSchedule, page } = input
  if (!objective) return []
  const profile = LAUNCH_PROFILES[objective]
  if (!profile) return []

  const issues: ValidationIssue[] = []

  for (const rule of profile.validations) {
    switch (rule) {
      case 'page_connected':
      case 'messenger_connected':
        if (!page.pageId) {
          issues.push({
            rule,
            severity: 'block',
            title: rule === 'messenger_connected' ? '메신저 연결이 안 됐어요' : '페이지 연결이 안 됐어요',
            message: rule === 'messenger_connected'
              ? '메시지 받기 광고는 활성 Facebook 페이지가 필요해요. 페이지를 연결한 뒤 다시 시도해주세요.'
              : '페이지 방문 광고는 활성 Facebook 페이지가 필요해요. 페이지를 연결한 뒤 다시 시도해주세요.',
            action: { label: '계정 연결로 가기', href: '/connect' },
          })
        }
        break

      case 'page_phone_required':
        if (page.pageId && !page.phone) {
          issues.push({
            rule,
            severity: 'block',
            title: '페이지에 전화번호가 없어요',
            message: page.pageName
              ? `활성 페이지 "${page.pageName}" 에 전화번호가 등록돼있지 않아요. 전화 받기 광고는 페이지 전화번호가 필수예요.`
              : '활성 페이지에 전화번호가 등록돼있지 않아요. 전화 받기 광고는 페이지 전화번호가 필수예요.',
            action: { label: 'Meta 페이지 설정으로 가기', href: META_BUSINESS_PAGE_SETTINGS },
          })
        }
        break

      case 'call_schedule_required':
        if (callSchedule.length === 0) {
          issues.push({
            rule,
            severity: 'block',
            title: '통화 가능 시간대를 골라주세요',
            message: '광고를 본 사람이 전화했을 때 응대할 요일을 최소 1개 골라야 게재할 수 있어요. 휴일에 광고비가 새는 걸 막아요.',
            action: { label: '시간대 섹션으로', scrollTo: '#call-schedule' },
          })
        }
        break

      case 'page_activity_recent':
        issues.push({
          rule,
          severity: 'warn',
          title: '페이지 활성도를 확인했나요?',
          message: page.pageName
            ? `"${page.pageName}" 에 최근 게시물이 없으면 광고 클릭 후 사용자가 빠르게 이탈해요. 좋아요 광고 집행 전에 최근 콘텐츠를 1개 이상 올렸는지 확인해주세요.`
            : '활성 페이지에 최근 게시물이 없으면 광고 클릭 후 사용자가 빠르게 이탈해요. 좋아요 광고 집행 전에 최근 콘텐츠를 1개 이상 올렸는지 확인해주세요.',
        })
        break

      case 'url_https':
        // inline 처리. 게재 직전 모달에서 다시 띄우지 않음.
        break
    }
  }

  return issues
}

export function hasBlockingIssue(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'block')
}
