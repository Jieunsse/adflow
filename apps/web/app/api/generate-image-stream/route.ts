import { NextRequest } from 'next/server'
import { geminiImage, normalizeVariants, type GenerateImageParams } from '@/lib/gemini-image'

const encoder = new TextEncoder()
function sseEvent(data: string) {
  return encoder.encode(`data: ${data}\n\n`)
}

function sseStream(run: (emit: (index: number, image: string) => void) => Promise<void>) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await run((index, image) => controller.enqueue(sseEvent(JSON.stringify({ index, image }))))
        controller.enqueue(sseEvent('[DONE]'))
      } catch (err) {
        const message = err instanceof Error ? err.message : '이미지 생성에 실패했어요.'
        controller.enqueue(sseEvent(JSON.stringify({ error: message })))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function POST(req: NextRequest) {
  let body: Partial<GenerateImageParams>
  try {
    body = (await req.json()) as Partial<GenerateImageParams>
  } catch {
    return new Response(JSON.stringify({ error: '요청 본문을 파싱할 수 없어요.' }), { status: 400 })
  }

  const params: GenerateImageParams = {
    variants: Array.isArray(body.variants) ? body.variants : [],
    referenceImages: body.referenceImages,
    preserveReference: body.preserveReference,
  }

  // variants 비었거나 모든 variant 가 prompt·ref 둘 다 없으면 400.
  try {
    normalizeVariants(params)
  } catch {
    return new Response(JSON.stringify({ error: '프롬프트 또는 레퍼런스 이미지를 입력해주세요.' }), { status: 400 })
  }

  // 이미지 생성은 둘러보기(browse)에서도 실제 Gemini 를 탄다 — mock 단락 없음. (GOOGLE_AI_API_KEY 필요)
  if (!geminiImage.isConfigured) {
    return new Response(JSON.stringify({ error: 'GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.' }), { status: 503 })
  }

  return sseStream((emit) => geminiImage.generateStream(params, emit))
}
