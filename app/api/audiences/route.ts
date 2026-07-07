import { NextRequest, NextResponse } from 'next/server'
import { withMetaSession } from '@/lib/meta-session'
import { ValidationError } from '@/lib/route-handler'
import { MetaApiError } from '@/lib/meta-ads-graph'
import { createPresetAudience, listCustomAudiences } from '@/lib/meta-ads-audiences'
import { AUDIENCE_PRESETS, presetAudienceName } from '@entities/custom-audience/presets'
import type { AudiencePresetId, CustomAudienceSummary } from '@entities/custom-audience/types'
import { mapAudienceError } from '@entities/custom-audience/errors'
import { MOCK_CUSTOM_AUDIENCES } from '@entities/custom-audience/mock'

export interface PresetStatus {
  id: AudiencePresetId
  label: string
  requiresPixel: boolean
  pixelGated: boolean // requiresPixel 인데 session.pixelId 없음
  existingAudienceId?: string // 동명 오디언스가 이미 있으면 그 id
}

function derivePresetStatuses(audiences: CustomAudienceSummary[], pixelId?: string): PresetStatus[] {
  return AUDIENCE_PRESETS.map((preset) => {
    const name = presetAudienceName(preset)
    const existing = audiences.find((a) => a.name === name)
    return {
      id: preset.id,
      label: preset.label,
      requiresPixel: preset.requiresPixel,
      pixelGated: preset.requiresPixel && !pixelId,
      existingAudienceId: existing?.id,
    }
  })
}

export const GET = withMetaSession(
  ['adAccount'],
  async (_req: NextRequest, s) => {
    const audiences = await listCustomAudiences(s.accessToken, s.adAccountId)
    return NextResponse.json({ audiences, presets: derivePresetStatuses(audiences, s.pixelId) })
  },
  {
    onBrowse: () =>
      NextResponse.json({
        audiences: MOCK_CUSTOM_AUDIENCES,
        presets: derivePresetStatuses([...MOCK_CUSTOM_AUDIENCES], 'mock_pixel'),
      }),
  },
)

const VALID_PRESET_IDS: ReadonlySet<AudiencePresetId> = new Set(AUDIENCE_PRESETS.map((p) => p.id))

export const POST = withMetaSession(
  ['adAccount'],
  async (req: NextRequest, s) => {
    const body = (await req.json()) as { preset?: string }
    if (!body.preset || !VALID_PRESET_IDS.has(body.preset as AudiencePresetId)) {
      throw new ValidationError('알 수 없는 맞춤 타겟 프리셋이에요.')
    }
    const presetId = body.preset as AudiencePresetId
    const preset = AUDIENCE_PRESETS.find((p) => p.id === presetId)!
    if (preset.requiresPixel && !s.pixelId) {
      throw new ValidationError('픽셀 연결이 필요해요.')
    }
    try {
      const audience = await createPresetAudience(s.accessToken, s.adAccountId, presetId, { pixelId: s.pixelId })
      return NextResponse.json({ audience })
    } catch (err) {
      if (err instanceof MetaApiError) {
        const mapped = mapAudienceError(err, s.adAccountId)
        return NextResponse.json({ error: mapped.message, tosAcceptUrl: mapped.tosAcceptUrl }, { status: 400 })
      }
      throw err
    }
  },
  {
    onBrowse: async (_session, req) => {
      const body = (await req.json()) as { preset?: string }
      const preset = AUDIENCE_PRESETS.find((p) => p.id === body.preset)
      const name = preset ? presetAudienceName(preset) : 'AdFlow 예시 맞춤 타겟'
      const existing = MOCK_CUSTOM_AUDIENCES.find((a) => a.name === name)
      return NextResponse.json({
        audience: existing ?? { id: `mock_ca_${body.preset}_${Date.now()}`, name, isExample: true },
      })
    },
  },
)
