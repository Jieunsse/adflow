import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiImage, sanitizeRefs } from '@/lib/gemini-image'
import { withRouteHandler, ValidationError } from '@/lib/route-handler'
import { DEMO_IMAGES } from '@/lib/demo/content'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.browseMode) {
    return NextResponse.json({ images: DEMO_IMAGES })
  }
  return withRouteHandler(
    geminiImage.isConfigured,
    'GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.',
    async () => {
      // 비스트림 경로(인스타 포스트 이미지)는 단일 prompt × count — variants 통일 계약으로 흡수.
      const body = (await req.json()) as { prompt?: unknown; count?: unknown; referenceImages?: unknown }
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
      const refs = sanitizeRefs(body.referenceImages)
      if (!prompt && !refs?.length) throw new ValidationError('프롬프트 또는 레퍼런스 이미지를 입력해주세요.')
      const count = typeof body.count === 'number' && body.count > 0 ? Math.floor(body.count) : 3
      const result = await geminiImage.generate({
        variants: Array.from({ length: count }, () => ({ prompt })),
        referenceImages: refs,
      })
      return NextResponse.json(result)
    },
  )
}
