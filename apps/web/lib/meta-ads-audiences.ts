// Server-side only — Custom Audience CRUD. Do not import from client components.
// ADR-062 — 프리셋 3종 고정, 자유 규칙 빌더 없음. 생성은 멱등(list-before-create, 결정적 이름).

import { presetAudienceName, presetOf } from '@entities/custom-audience/presets'
import type { AudiencePreset } from '@entities/custom-audience/presets'
import type { AudiencePresetId, CustomAudienceSummary } from '@entities/custom-audience/types'
import { graphFetch } from './meta-ads-graph'

interface RawCustomAudience {
  id: string
  name: string
  approximate_count_lower_bound?: number
  approximate_count_upper_bound?: number
  delivery_status?: { code?: number; description?: string } | string
}

function toSummary(raw: RawCustomAudience): CustomAudienceSummary {
  const deliveryStatus = typeof raw.delivery_status === 'string'
    ? raw.delivery_status
    : raw.delivery_status?.description
  return {
    id: raw.id,
    name: raw.name,
    approximateCountLowerBound: raw.approximate_count_lower_bound,
    approximateCountUpperBound: raw.approximate_count_upper_bound,
    deliveryStatus,
  }
}

export async function listCustomAudiences(token: string, accountId: string): Promise<CustomAudienceSummary[]> {
  const data = await graphFetch<{ data: RawCustomAudience[] }>(
    `/${accountId}/customaudiences?fields=id,name,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status&access_token=${token}`,
  )
  return (data.data ?? []).map(toSummary)
}

// IG 참여자 — Meta 는 IG business account 참여를 subtype ENGAGEMENT + rule 로 표현.
// retention_days = preset 상수(365) — 유저 노출 없음.
function buildIgEngagementRule(retentionDays: number): Record<string, unknown> {
  return {
    subtype: 'ENGAGEMENT',
    rule: {
      inclusions: {
        operator: 'or',
        rules: [
          {
            event_sources: [{ type: 'ig_business' }],
            retention_seconds: retentionDays * 86400,
            filter: {
              operator: 'and',
              filters: [{ field: 'event', operator: 'eq', value: 'ig_business_profile_all' }],
            },
          },
        ],
      },
    },
  }
}

// 픽셀 WCA(웹사이트 방문·구매) — subtype WEBSITE + pixel rule.
function buildPixelRule(pixelId: string, retentionDays: number, event?: string): Record<string, unknown> {
  return {
    subtype: 'WEBSITE',
    rule: {
      inclusions: {
        operator: 'or',
        rules: [
          {
            event_sources: [{ type: 'pixel', id: pixelId }],
            retention_seconds: retentionDays * 86400,
            filter: event
              ? { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: event }] }
              : { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'PageView' }] },
          },
        ],
      },
    },
  }
}

function buildPresetBody(preset: AudiencePreset, name: string, pixelId?: string): Record<string, unknown> {
  const base = { name, subtype: 'CUSTOM' as string }
  if (preset.id === 'ig_engagers') {
    return { ...base, ...buildIgEngagementRule(preset.retentionDays) }
  }
  if (!pixelId) {
    throw new Error('픽셀 연결이 필요해요.')
  }
  if (preset.id === 'purchasers') {
    return { ...base, ...buildPixelRule(pixelId, preset.retentionDays, 'Purchase') }
  }
  // website_visitors — 전체 방문(PageView)
  return { ...base, ...buildPixelRule(pixelId, preset.retentionDays) }
}

// 멱등 생성 — list 조회 후 결정적 이름 동명 존재 시 재사용, 없으면 POST.
export async function createPresetAudience(
  token: string,
  accountId: string,
  presetId: AudiencePresetId,
  opts: { pixelId?: string } = {},
): Promise<CustomAudienceSummary> {
  const preset = presetOf(presetId)
  const name = presetAudienceName(preset)

  const existing = await listCustomAudiences(token, accountId)
  const reuse = existing.find((a) => a.name === name)
  if (reuse) return reuse

  const body = buildPresetBody(preset, name, opts.pixelId)
  const created = await graphFetch<{ id: string }>(`/${accountId}/customaudiences`, {
    method: 'POST',
    body: JSON.stringify({ ...body, access_token: token }),
  })
  return { id: created.id, name }
}

export const metaAdsAudiences = { listCustomAudiences, createPresetAudience }
