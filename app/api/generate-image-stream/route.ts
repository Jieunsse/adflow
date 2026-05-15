import { NextRequest } from 'next/server'
import { geminiImage, sanitizeRefs, type GenerateImageParams } from '@/lib/gemini-image'

const encoder = new TextEncoder()
function sseEvent(data: string) {
  return encoder.encode(`data: ${data}\n\n`)
}

export async function POST(req: NextRequest) {
  if (!geminiImage.isConfigured) {
    return new Response(JSON.stringify({ error: 'GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않았어요.' }), { status: 503 })
  }

  let body: Partial<GenerateImageParams>
  try {
    body = (await req.json()) as Partial<GenerateImageParams>
  } catch {
    return new Response(JSON.stringify({ error: '요청 본문을 파싱할 수 없어요.' }), { status: 400 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const refs = sanitizeRefs(body.referenceImages)
  if (!prompt && !refs?.length) {
    return new Response(JSON.stringify({ error: '프롬프트 또는 레퍼런스 이미지를 입력해주세요.' }), { status: 400 })
  }

  const params: GenerateImageParams = {
    prompt,
    referenceImages: refs,
    count: typeof body.count === 'number' ? body.count : undefined,
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await geminiImage.generateStream(params, (index, image) => {
          controller.enqueue(sseEvent(JSON.stringify({ index, image })))
        })
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
