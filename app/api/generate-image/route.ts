import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiImage, sanitizeRefs, type GenerateImageParams } from '@/lib/gemini-image'
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
      const body = (await req.json()) as Partial<GenerateImageParams>
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
      const refs = sanitizeRefs(body.referenceImages)
      if (!prompt && !refs?.length) throw new ValidationError('프롬프트 또는 레퍼런스 이미지를 입력해주세요.')
      const result = await geminiImage.generate({
        prompt,
        referenceImages: refs,
        count: typeof body.count === 'number' ? body.count : undefined,
      })
      return NextResponse.json(result)
    },
  )
}
