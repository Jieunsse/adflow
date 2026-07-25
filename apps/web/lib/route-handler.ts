import { NextResponse } from 'next/server'

export class ValidationError extends Error {}
export class QuotaExceededError extends Error {}
// Thrown when the Meta token is expired/invalid and the user must re-authenticate.
export class AuthError extends Error {}

export function withRouteHandler(
  isConfigured: boolean,
  unconfiguredMsg: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  if (!isConfigured) {
    return Promise.resolve(NextResponse.json({ error: unconfiguredMsg }, { status: 503 }))
  }
  return handler().catch((err) => {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    // Supabase 등 일부 라이브러리는 Error 인스턴스가 아닌 plain object({ message, code })를 throw 한다.
    // instanceof 만 보면 메시지가 "알 수 없는 오류"로 뭉개지므로 객체의 message 도 surface 한다.
    const message =
      err instanceof Error
        ? err.message
        : err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  })
}
