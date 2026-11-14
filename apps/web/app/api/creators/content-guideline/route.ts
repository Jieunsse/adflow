import { NextRequest, NextResponse } from 'next/server'
import { creatorContentGuideline, type GenerateContentGuidelineParams } from '@/lib/prompts/creator-content-guideline'
import { withRouteHandler, ValidationError } from '@/lib/route-handler'

export async function POST(req: NextRequest) {
  return withRouteHandler(
    creatorContentGuideline.isConfigured,
    'Gemini API 키가 설정되지 않았어요.',
    async () => {
      const body = (await req.json()) as Partial<GenerateContentGuidelineParams>
      const { brand, campaign, platform } = body
      if (!brand?.name || !campaign?.name || !campaign?.goal || !platform) {
        throw new ValidationError('필수 필드가 누락됐어요.')
      }
      const result = await creatorContentGuideline.generate({ brand, campaign, platform })
      return NextResponse.json(result)
    },
  )
}
