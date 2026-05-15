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
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  })
}
