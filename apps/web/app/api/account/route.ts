import { NextResponse } from 'next/server'
import { metaAds } from '@/lib/meta-ads'
import { withMetaSession } from '@/lib/meta-session'

export const GET = withMetaSession(['adAccount'], async (_req, s) =>
  NextResponse.json(await metaAds.checkAccount(s.accessToken, s.adAccountId)),
)
