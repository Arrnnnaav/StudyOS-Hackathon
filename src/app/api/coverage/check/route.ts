import { NextResponse } from 'next/server'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { auth } from '@/lib/auth'
import { takeDailyCoverageQuota } from '@/lib/ask-safety'
import { invokeModel, extractJson, bedrockConfigured, BedrockUnavailableError, COVERAGE_MODEL_ID } from '@/lib/bedrock'
import { classifyCoverage, overallStatus } from '@/shared/coverage'
import type { CoverageCheckRequest, CoverageCheckResponse, CoverageStatus } from '@/shared/contracts'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CONTENT = 12_000

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    let body: CoverageCheckRequest
    try { body = (await request.json()) as CoverageCheckRequest } catch { return NextResponse.json(errorBody('BAD_JSON', 'body must be valid JSON'), { status: 400 }) }
    const topicId = String(body.topic_id ?? '')
    const content = String(body.content ?? '').trim()
    if (!topicId || !content) return NextResponse.json(errorBody('BAD_REQUEST', 'topic_id and content are required'), { status: 400 })
    if (content.length > MAX_CONTENT) return NextResponse.json(errorBody('TOO_LONG', `content must be under ${MAX_CONTENT} chars`), { status: 400 })
    const topic = dsaFoundations.phases.flatMap((phase) => phase.topics).find((item) => item.id === topicId)
    if (!topic) return NextResponse.json(errorBody('NOT_FOUND', 'topic not found'), { status: 404 })
    const quota = await takeDailyCoverageQuota(session.user.id)
    if (!quota.allowed) {
      return NextResponse.json(errorBody('RATE_LIMITED', `daily coverage limit (${quota.limit}) reached`), {
        status: 429,
        headers: { 'Retry-After': String(quota.retryAfterSeconds), 'X-RateLimit-Limit': String(quota.limit), 'X-RateLimit-Remaining': '0' },
      })
    }
    let coverage: { objective: string; status: CoverageStatus; reason: string }[]
    try { coverage = await bedrockCoverage(topic.objectives, content) }
    catch { coverage = topic.objectives.map((objective, index) => ({ objective, ...classifyCoverage(topic.objectives, content)[index] })) }
    const response: CoverageCheckResponse = { topic_id: topicId, topic_title: topic.title, coverage, overall: overallStatus(coverage.map((item) => item.status)) }
    return NextResponse.json(response, { headers: { 'X-RateLimit-Limit': String(quota.limit), 'X-RateLimit-Remaining': String(Math.max(0, quota.limit - quota.count)) } })
  } catch (error) {
    console.error('Coverage error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to check coverage'), { status: 500 })
  }
}

async function bedrockCoverage(objectives: string[], content: string): Promise<{ objective: string; status: CoverageStatus; reason: string }[]> {
  if (!bedrockConfigured()) throw new BedrockUnavailableError()
  const system = 'Evaluate whether a learning resource covers each objective. Return only JSON: {"coverage":[{"objective":"<exact objective>","status":"strong|moderate|weak|missing","reason":"<one short sentence>"}]}. Use exactly the supplied objectives.'
  const raw = await invokeModel({ system, user: `Topic objectives:\n${JSON.stringify(objectives)}\n\nResource content:\n${content.slice(0, MAX_CONTENT)}`, maxTokens: 1_500, temperature: 0, modelId: COVERAGE_MODEL_ID })
  const parsed = extractJson<{ coverage?: { objective?: string; status?: string; reason?: string }[] }>(raw)
  if (!Array.isArray(parsed?.coverage) || parsed.coverage.length !== objectives.length) throw new Error('Coverage JSON did not match objectives')
  const statuses = new Set<CoverageStatus>(['strong', 'moderate', 'weak', 'missing'])
  return objectives.map((objective, index) => ({ objective, status: statuses.has(parsed.coverage![index]?.status as CoverageStatus) ? parsed.coverage![index]!.status as CoverageStatus : 'missing', reason: parsed.coverage![index]?.reason || 'No explicit coverage found.' }))
}
