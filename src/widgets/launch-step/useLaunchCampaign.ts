import { useApiMutation } from '@shared/lib/api/useApiMutation'
import type { CtaId, MetaObjective } from '@entities/creative/options'

export type CampaignIds = { camp: string; adset: string; ad: string }

export type LaunchBidStrategy = 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP'
export type LaunchPlacements = { mode: 'auto' } | { mode: 'manual'; positions: string[] }
export type LaunchPlatforms = 'both' | 'facebook' | 'instagram'

export type LaunchParams = {
  headline: string
  primaryText: string
  dailyBudget: number // 원화(KRW) 정수 — 그대로 Meta 에 전달
  startDate: string
  endDate: string
  ageMin: number
  ageMax: number
  genders: number[] // Meta 규격 — 1=남성, 2=여성, [] = 전체
  countries: string[] // ISO 3166-1 alpha-2
  linkUrl: string
  cta: CtaId
  status: 'ACTIVE' | 'PAUSED'
  imageDataUrl?: string // 선택 — data:image/...;base64,...
  // PRD-create-modes-and-objectives §5.5 — 디테일 모드 추가 페이로드 (모두 optional)
  objective?: MetaObjective
  mode?: 'simple' | 'detailed'
  bidStrategy?: LaunchBidStrategy
  bidAmount?: number
  placements?: LaunchPlacements
  platforms?: LaunchPlatforms
  // Meta App 개발 모드 호환 — true 면 서버가 Campaign + AdSet 까지만 만들고 응답
  skipAdCreation?: boolean
}

type LaunchResponse = { campaignId: string; adSetId: string; adId?: string }

export function useLaunchCampaign() {
  const mutation = useApiMutation<LaunchParams, LaunchResponse>('/api/campaign')

  const campaignIds: CampaignIds | null = mutation.data
    ? {
        camp: mutation.data.campaignId,
        adset: mutation.data.adSetId,
        ad: mutation.data.adId || '—',
      }
    : null

  return { mutation, campaignIds }
}
