import { NextRequest, NextResponse } from 'next/server'
import { geminiCreative, type SuggestImagePromptParams } from '@/lib/gemini-creative'
import { withRouteHandler, ValidationError } from '@/lib/route-handler'

export async function POST(req: NextRequest) {
  return withRouteHandler(
    geminiCreative.isConfigured,
    'GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.',
    async () => {
      const body = (await req.json()) as Partial<SuggestImagePromptParams>
      const { headline, primaryText, tone } = body
      if (!headline || !primaryText || !tone) {
        throw new ValidationError('headline, primaryText, tone 이 필요해요.')
      }
      const result = await geminiCreative.suggestImagePrompt({ headline, primaryText, tone })
      return NextResponse.json(result)
    },
  )
}
