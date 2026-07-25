// PRD-objective-aware-launch §5.1 — 검증 트리거 양면화.
// inline      = 실시간 helper (URL/phone 형식) — 노브 자체에서 표시.
// pre_launch  = 게재 직전 모달 (메신저 연결·page phone·시간대·페이지 활성도) — 본 패키지가 담당.

import type { ValidationRule } from '@entities/launch-objective/profile'

export type ValidationSeverity = 'block' | 'warn'

export type ValidationIssue = {
  rule: ValidationRule
  severity: ValidationSeverity
  title: string
  message: string
  // 사용자가 fix 하러 갈 곳. external (Meta 페이지 설정 등) 또는 internal (#anchor) 양쪽 지원.
  action?: {
    label: string
    href?: string         // 외부 URL — target=_blank
    scrollTo?: string     // 내부 anchor — DOM id
  }
}

export type PageContext = {
  pageId: string | null
  pageName: string | null
  phone: string | null
}
