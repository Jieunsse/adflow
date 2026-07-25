import { NextRequest, NextResponse } from 'next/server'
import { isClaudeConfigured } from '@/lib/claude-client'
import { creatorReportInsight } from '@/lib/prompts/creator-report-insight'
import type { GenerateReportInsightParams } from '@/lib/prompts/creator-report-insight'
import { withRouteHandler, ValidationError } from '@/lib/route-handler'

export async function POST(req: NextRequest) {
  return withRouteHandler(
    isClaudeConfigured(),
    'ANTHROPIC_API_KEY 가 .env.local 에 설정되지 않았어요.',
    async () => {
      const body = (await req.json()) as Partial<GenerateReportInsightParams>
      const { campaign, aggregated, perCreator } = body
      if (!campaign?.name || !campaign?.goal || !aggregated) {
        throw new ValidationError('필수 필드가 누락됐어요.')
      }
      const result = await creatorReportInsight.generate({ campaign, aggregated, perCreator: perCreator ?? [] })
      return NextResponse.json(result)
    },
  )
}
