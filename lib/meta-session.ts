// Server-side only — Meta 세션 가드. getServerSession 결과를 검증·resolve 해서
// 라우트 핸들러에 ResolvedSession 을 넘긴다. 실패 시 AuthError → withRouteHandler 가 401.
//
// 두 직교 seam:
//   1) 에러→HTTP 매핑 = withRouteHandler (기존). 2) 세션 획득·검증·resolve = 여기.
// requireMetaSession 은 session 을 인자로 받는 순수 함수(= test surface). withMetaSession 은
// getServerSession 배선 + withRouteHandler 에 위임하는 얇은 HOF sugar.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from './auth'
import { resolveAccessToken, resolveAdAccountId } from './env'
import { AuthError, withRouteHandler } from './route-handler'

// accessToken 은 baseline(모든 가드 라우트 필요). 아래는 추가 요구 tier.
export type SessionRequirement = 'adAccount' | 'page' | 'ig'

// 검증·resolve 를 통과한 세션. accessToken·adAccountId 는 resolve 적용(dev 테스트계정 치환,
// prod 빌드에선 env.ts 가 무조건 session 값 반환 → prod 동작 불변). 요구하지 않아 부재한
// 필드는 '' (요구한 필드는 비어있으면 throw 했으므로 항상 비어있지 않음).
export interface ResolvedSession {
  accessToken: string
  adAccountId: string
  pageId: string
  igUserId: string
  pixelId?: string
  igAccessToken?: string
  browseMode: boolean
}

const MSG = {
  account: '광고 계정을 먼저 연결해주세요.',
  page: '페이스북 페이지를 먼저 선택해주세요.',
  ig: '인스타그램 계정이 연결돼 있지 않아요.',
} as const

export function requireMetaSession(
  session: Session | null,
  requires: SessionRequirement[] = [],
): ResolvedSession {
  if (!session?.accessToken) throw new AuthError(MSG.account)
  if (requires.includes('adAccount') && !session.adAccountId) throw new AuthError(MSG.account)
  if (requires.includes('page') && !session.pageId) throw new AuthError(MSG.page)
  if (requires.includes('ig') && !session.igUserId) throw new AuthError(MSG.ig)

  return {
    accessToken: resolveAccessToken(session.accessToken),
    adAccountId: session.adAccountId ? resolveAdAccountId(session.adAccountId) : '',
    pageId: session.pageId ?? '',
    igUserId: session.igUserId ?? '',
    pixelId: session.pixelId,
    igAccessToken: session.igAccessToken,
    browseMode: session.browseMode ?? false,
  }
}

export interface MetaSessionOptions {
  // browse 세션일 때 route 고유 mock 페이로드를 반환(guard 는 payload 를 소유하지 않음).
  // 없으면 browse 세션은 real-only 로 간주 → requireMetaSession 이 401.
  // req = 쿼리 파라미터가 필요한 라우트용(옵셔널 — 기존 호출부 하위호환).
  onBrowse?: (session: Session, req: NextRequest) => NextResponse | Promise<NextResponse>
}

// 공통 모양 라우트용 sugar. config+session 둘 다 필요한 라우트(generate-image 등)나
// browse-필수 역전 라우트(tournaments/demo)는 requireMetaSession 을 직접 호출.
export function withMetaSession<C = unknown>(
  requires: SessionRequirement[],
  handler: (req: NextRequest, s: ResolvedSession, ctx: C) => Promise<NextResponse>,
  opts: MetaSessionOptions = {},
): (req: NextRequest, ctx: C) => Promise<NextResponse> {
  return (req, ctx) =>
    withRouteHandler(true, '', async () => {
      const session = await getServerSession(authOptions)
      if (session?.browseMode && opts.onBrowse) {
        return opts.onBrowse(session, req)
      }
      const s = requireMetaSession(session, requires)
      return handler(req, s, ctx)
    })
}
