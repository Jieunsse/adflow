import { NextRequest, NextResponse } from 'next/server'
import { geminiCreative, type SuggestImageConceptsParams } from '@/lib/gemini-creative'
import { withRouteHandler, ValidationError } from '@/lib/route-handler'

// 둘러보기(browse)에서도 실제 Gemini 를 탄다 — 이미지 생성(generate-image-stream)과 동일.
// 유저가 올린 제품 레퍼런스·카피·톤을 반영한 Concept 를 매번 생성. (GOOGLE_AI_API_KEY 필요)
export async function POST(req: NextRequest) {
  return withRouteHandler(
    geminiCreative.isConfigured,
    'GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.',
    async () => {
      const body = (await req.json()) as Partial<SuggestImageConceptsParams>
      const { headline, primaryText, tone, productName, productDescription, outcome, stageProduct } = body
      if (!headline || !primaryText || !tone) {
        throw new ValidationError('headline, primaryText, tone 이 필요해요.')
      }
      const result = await geminiCreative.suggestImageConcepts({ headline, primaryText, tone, productName, productDescription, outcome, stageProduct })
      return NextResponse.json(result)
    },
  )
}
