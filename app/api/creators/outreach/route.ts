import { NextRequest, NextResponse } from 'next/server'
import { creatorOutreach, type GenerateOutreachParams } from '@/lib/prompts/creator-outreach'
import { withRouteHandler, ValidationError } from '@/lib/route-handler'

export async function POST(req: NextRequest) {
  return withRouteHandler(
    creatorOutreach.isConfigured,
    'GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.',
    async () => {
      const body = (await req.json()) as Partial<GenerateOutreachParams>
      const { brand, creator, campaign } = body
      if (!brand?.name || !creator?.handle || !campaign?.name || !campaign?.goal) {
        throw new ValidationError('필수 필드가 누락됐어요.')
      }
      const result = await creatorOutreach.generate({ brand, creator, campaign })
      return NextResponse.json(result)
    },
  )
}
