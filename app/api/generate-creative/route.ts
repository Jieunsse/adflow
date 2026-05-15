import { NextRequest, NextResponse } from 'next/server'
import { geminiCreative, type GenerateCreativeParams } from '@/lib/gemini-creative'
import { OBJECTIVES_ALL } from '@entities/creative/options'
import { withRouteHandler, ValidationError } from '@/lib/route-handler'

const VALID_OUTCOMES = new Set(OBJECTIVES_ALL.map((o) => o.id))

export async function POST(req: NextRequest) {
  return withRouteHandler(
    geminiCreative.isConfigured,
    'GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.',
    async () => {
      const body = (await req.json()) as Partial<GenerateCreativeParams>
      const { brand, target, goal, tone, outcome, hint } = body
      if (!brand || !target || !goal || !tone) {
        throw new ValidationError('필수 필드가 누락됐어요.')
      }
      if (!outcome || !VALID_OUTCOMES.has(outcome)) {
        throw new ValidationError('원하는 결과(outcome)를 선택해주세요.')
      }
      const result = await geminiCreative.generate({ brand, target, goal, tone, outcome, hint })
      return NextResponse.json(result)
    }
  )
}
