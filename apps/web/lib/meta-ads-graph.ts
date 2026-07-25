// Server-side only — internal transport helper. Do not import from client components.

import { AuthError } from './route-handler'

export const GRAPH = 'https://graph.facebook.com/v20.0'

export interface MetaError { error: { message: string; code: number; error_subcode?: number; error_user_msg?: string; error_data?: string } }

// graphFetch 가 던지는 Meta 그래프 에러. message 는 기존 평탄화 문자열 그대로 보존하고
// code/subcode 를 구조화해 노출 — 호출자가 문자열을 regex 로 재파싱하지 않아도 됨.
export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly subcode: number | undefined,
    readonly userMessage?: string,
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

export async function graphFetch<T extends object>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${GRAPH}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const json = (await res.json()) as T | MetaError
  if ('error' in json) {
    const e = (json as MetaError).error
    // code 190 = access token expired/invalid → user must re-login
    if (e.code === 190) {
      throw new AuthError('Meta 인증이 만료됐어요. 로그아웃 후 다시 로그인해주세요.')
    }
    const detail = [
      e.error_subcode ? `subcode=${e.error_subcode}` : '',
      e.error_user_msg ?? '',
      e.error_data ? `data=${e.error_data}` : '',
    ].filter(Boolean).join(' | ')
    throw new MetaApiError(
      `Meta API 오류 (${e.code}): ${e.message}${detail ? ` — ${detail}` : ''}`,
      e.code,
      e.error_subcode,
      e.error_user_msg,
    )
  }
  return json as T
}
