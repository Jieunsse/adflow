// PRD-objective-aware-launch §3 spec matrix — 7 Phase 1 objectives × 5 dimensions.
// 단일 데이터 source. STEP 02 launch-step 의 노브/섹션/검증이 이 profile 을 읽어 분기.
// CTA 라벨/Meta enum 값은 entities/creative/options.ts 의 defaultCta 가 source of truth.
// 본 profile 은 *policy* (잠금 여부·노출 여부) 만 담는다.

import type { ObjectivePhase1Id } from '@entities/creative/options'

export type UrlPolicy =
  | { mode: 'hidden' }
  | { mode: 'user_input' }
  | { mode: 'prefilled_locked' }

export type CtaPolicy =
  | { mode: 'locked' }
  | { mode: 'user_choice' }

export type PlacementPosition =
  | 'facebook_feed'
  | 'instagram_feed'
  | 'instagram_stories'
  | 'audience_network'
  | 'messenger'

export interface PlacementSpec {
  default: 'auto' | 'manual'
  recommendedPositions?: PlacementPosition[]
  allowedPositions?: PlacementPosition[]
  recommendation?: string
}

export type UniqueSection =
  | 'frequency_cap'
  | 'page_activity'
  | 'messages_auto_reply'
  | 'call_schedule'

export type ValidationRule =
  | 'url_https'
  | 'page_connected'
  | 'page_activity_recent'
  | 'messenger_connected'
  | 'page_phone_required'
  | 'call_schedule_required'

export interface LaunchObjectiveProfile {
  url: UrlPolicy
  cta: CtaPolicy
  placement: PlacementSpec
  uniqueSections: UniqueSection[]
  validations: ValidationRule[]
}

export const LAUNCH_PROFILES: Record<ObjectivePhase1Id, LaunchObjectiveProfile> = {
  awareness: {
    url: { mode: 'hidden' },
    cta: { mode: 'locked' },
    placement: {
      default: 'manual',
      recommendedPositions: ['instagram_stories', 'facebook_feed', 'instagram_feed'],
      recommendation: 'Stories + Feed 권장',
    },
    uniqueSections: ['frequency_cap'],
    validations: [],
  },
  traffic: {
    url: { mode: 'user_input' },
    cta: { mode: 'user_choice' },
    placement: { default: 'auto' },
    uniqueSections: [],
    validations: ['url_https'],
  },
  traffic_page_visit: {
    url: { mode: 'prefilled_locked' },
    cta: { mode: 'locked' },
    placement: {
      default: 'manual',
      recommendedPositions: ['facebook_feed'],
      recommendation: 'Feed 권장',
    },
    uniqueSections: [],
    validations: ['page_connected'],
  },
  engagement: {
    url: { mode: 'user_input' },
    cta: { mode: 'user_choice' },
    placement: {
      default: 'manual',
      recommendedPositions: ['facebook_feed', 'instagram_feed', 'instagram_stories'],
      recommendation: 'Feed + Stories 권장',
    },
    uniqueSections: [],
    validations: [],
  },
  engagement_page_likes: {
    url: { mode: 'prefilled_locked' },
    cta: { mode: 'locked' },
    placement: {
      default: 'manual',
      recommendedPositions: ['facebook_feed'],
      recommendation: 'Feed 권장',
    },
    uniqueSections: ['page_activity'],
    validations: ['page_activity_recent'],
  },
  engagement_messages: {
    url: { mode: 'prefilled_locked' },
    cta: { mode: 'locked' },
    placement: {
      default: 'manual',
      recommendedPositions: ['instagram_stories', 'facebook_feed', 'instagram_feed'],
      recommendation: 'Stories + Feed 권장',
    },
    uniqueSections: ['messages_auto_reply'],
    validations: ['messenger_connected'],
  },
  leads_call: {
    url: { mode: 'hidden' },
    cta: { mode: 'locked' },
    placement: {
      default: 'manual',
      recommendedPositions: ['facebook_feed', 'instagram_feed'],
      allowedPositions: ['facebook_feed', 'instagram_feed'],
      recommendation: 'Call 지원 placement만 (Stories는 통화 미지원)',
    },
    uniqueSections: ['call_schedule'],
    validations: ['page_phone_required', 'call_schedule_required'],
  },
}

export function getLaunchProfile(id: ObjectivePhase1Id): LaunchObjectiveProfile {
  return LAUNCH_PROFILES[id]
}
