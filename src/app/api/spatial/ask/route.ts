import { NextResponse } from 'next/server'
import { resolveApiUser } from '@/lib/auth-utils'
import { takeDailySpatialQuota } from '@/lib/ask-safety'
import { createAsk, trackEvent } from '@/lib/db'
import { invokeModel, MODEL_ID } from '@/lib/bedrock'
import { anchorsToContext } from '@/shared/spatial'
import { resolve, candidateGeometry, describeTarget } from '@/shared/resolver'
import type { BBox, CandidateObject, Confidence, SpatialAnchor, SpatialAskRequest, SpatialAskResponse } from '@/shared/contracts'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_QUESTION = 2000
const MAX_ANCHORS = 60

/**
 * POST /api/spatial/ask — rectangle Point & Ask.
 * Body: { extension_session_token?, question, marks, anchors, canvas, page }
 *
 * Pipeline (plan Phase 7): anchors → deterministic resolver → resolved_target → answerer.
 * Resolution never uses the model; the model answers only about the resolved object.
 */
export async function POST(request: Request) {
  const started = Date.now()
  try {
    const body = (await request.json()) as SpatialAskRequest
    const user = await resolveApiUser(body as unknown as Record<string, unknown>)
    if (!user) {
      return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    }

    const question = String(body.question ?? '').trim()
    const marks = Array.isArray(body.marks) ? body.marks : []
    const anchors = Array.isArray(body.anchors) ? body.anchors.slice(0, MAX_ANCHORS) : []
    const page = body.page ?? { url: '', title: '', surface: 'web' as const }

    if (!question) return NextResponse.json(errorBody('BAD_REQUEST', 'question is required'), { status: 400 })
    if (question.length > MAX_QUESTION) return NextResponse.json(errorBody('TOO_LONG', 'question too long'), { status: 400 })
    if (!marks.length) return NextResponse.json(errorBody('BAD_REQUEST', 'at least one mark is required'), { status: 400 })

    const quota = await takeDailySpatialQuota(user.userId)
    if (!quota.allowed) {
      return NextResponse.json(errorBody('RATE_LIMITED', `daily Point & Ask limit (${quota.limit}) reached`), {
        status: 429,
        headers: { 'Retry-After': String(quota.retryAfterSeconds), 'X-RateLimit-Limit': String(quota.limit), 'X-RateLimit-Remaining': '0' },
      })
    }

    // Convert DOM/PDF anchors into candidate objects.
    const candidates: CandidateObject[] = anchors.map((a) => ({
      id: a.id || 'anchor',
      source: a.page ? ('pdf_text' as const) : ('dom' as const),
      type: a.type,
      text: (a.text || '').slice(0, 600),
      label: (a.label as string | undefined) || typeLabel(a.type),
      bbox: a.bbox as BBox,
      geometry: { overlap: 0, centerDistance: 0, containment: false },
    }))

    // Use the first mark as the reference rectangle.
    const mark: BBox = {
      x: marks[0].x ?? 0,
      y: marks[0].y ?? 0,
      width: marks[0].width ?? 0,
      height: marks[0].height ?? 0,
    }

    // Resolve deterministically (no AI).
    const { target, candidates: ranked } = resolve(mark, candidates)
    const chosen =
      ranked.find((c) => c.id === target.candidateId) ??
      ranked[0] ??
      null

    // Privacy: only the resolved object's text (+ nearest context) leaves the browser.
    const nearby = anchorsToContext(ranked.filter((c) => c.id !== chosen?.id), 600)
    const domain = page.url ? new URL(page.url, 'http://localhost').hostname : ''
    const desc = chosen ? describeTarget(chosen) : {}

    // Track start (privacy-safe — never question/answer/resolution text).
    void trackEvent({
      eventId: crypto.randomUUID(),
      eventName: 'point_ask_started',
      timestamp: new Date().toISOString(),
      userId: user.userId,
      sessionId: 'spatial',
      topicId: null,
      domain,
      properties: {
        request_kind: 'spatial',
        context_type: 'spatial',
        resolution_confidence: target.confidence,
        candidate_type: chosen?.type || null,
        candidate_count: candidates.length,
      },
    }).catch(() => {})

    const prompt = buildResolvedPrompt({
      type: desc.type,
      label: desc.label,
      content: (chosen?.text || ''),
      nearby,
      domain,
      pageTitle: page.title || '',
      question,
      confidence: target.confidence,
    })

    let answer: string
    let provider: 'bedrock'
    try {
      answer = await invokeModel({ system: RESOLVED_SYSTEM, user: prompt, maxTokens: 900, temperature: 0.3 })
      provider = 'bedrock'
    } catch (err) {
      void trackEvent({
        eventId: crypto.randomUUID(),
        eventName: 'point_ask_failed',
        timestamp: new Date().toISOString(),
        userId: user.userId,
        sessionId: 'spatial',
        topicId: null,
        domain: null,
        properties: { error: err instanceof Error ? err.message : 'bedrock unavailable' },
      }).catch(() => {})
      return NextResponse.json(errorBody('PROVIDER_UNAVAILABLE', 'No answer provider is configured on this deployment.'), { status: 503 })
    }

    const latencyMs = Date.now() - started
    const askId = crypto.randomUUID()
    await createAsk({
      id: askId,
      userId: user.userId,
      topicId: null,
      domain,
      pageTitle: page.title || '',
      selectedText: (chosen?.text || '').slice(0, 800),
      nearbyBefore: '',
      nearbyAfter: '',
      question,
      answer,
      model: MODEL_ID,
      latencyMs,
      helpful: null,
      feedbackReason: null,
      savedToReview: false,
      createdAt: new Date().toISOString(),
    })
    void trackEvent({
      eventId: crypto.randomUUID(),
      eventName: 'point_ask_succeeded',
      timestamp: new Date().toISOString(),
      userId: user.userId,
      sessionId: 'spatial',
      topicId: null,
      domain: null,
      properties: {
        latencyMs,
        provider,
        request_kind: 'spatial',
        resolution_confidence: target.confidence,
      },
    }).catch(() => {})

    const response: SpatialAskResponse = {
      id: askId,
      answer,
      anchors_used: (chosen ? [chosen] : []) as SpatialAnchor[],
      confidence: confidenceToNum(target.confidence),
      provider,
      model: MODEL_ID,
      vision: false,
      ocr: false,
      sources: undefined,
      cited: undefined,
    }
    // Attach the resolved target so the client can show the grounding chip.
    response.resolved_target = {
      candidateId: target.candidateId,
      confidence: target.confidence,
      type: desc.type,
      label: desc.label || typeLabel(desc.type),
      alternatives: target.alternatives,
    }
    response.nearby_context = nearby
    return NextResponse.json(response, { headers: { 'X-RateLimit-Limit': String(quota.limit), 'X-RateLimit-Remaining': String(Math.max(0, quota.limit - quota.count)) } })
  } catch (error) {
    console.error('Spatial ask error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to process Point & Ask'), { status: 500 })
  }
}

function typeLabel(type?: string): string | undefined {
  if (!type) return undefined
  const map: Record<string, string> = {
    pre: 'Code block', code: 'Code', p: 'Paragraph', h1: 'Heading', h2: 'Heading', h3: 'Heading',
    td: 'Table cell', tr: 'Table row', img: 'Image', figure: 'Figure', button: 'Button', a: 'Link',
    figcaption: 'Caption', li: 'List item', selection: 'Selection',
  }
  return map[type] ?? type
}

function confidenceToNum(c: Confidence): number {
  return c === 'high' ? 0.9 : c === 'medium' ? 0.7 : 0.4
}

function buildResolvedPrompt(o: {
  type?: string
  label?: string
  content: string
  nearby: string
  domain: string
  pageTitle: string
  question: string
  confidence: Confidence
}): string {
  const { type, label, content, nearby, domain, pageTitle, question, confidence } = o
  return [
    'The student pointed to a specific object on a page and asked about it.',
    `Page: ${pageTitle} (${domain})`,
    `Resolution confidence: ${confidence}`,
    '',
    'RESOLVED OBJECT:',
    `TYPE: ${label || type || 'unknown'}`,
    'CONTENT:',
    '```',
    content || '(no text content was available under the object)',
    '```',
    '',
    'NEARBY CONTEXT:',
    '```',
    nearby || '(none)',
    '```',
    '',
    `QUESTION: ${question}`,
    '',
    'Explain what the resolved object does, why it matters, and answer the question directly.',
    'Base claims about the object ONLY on its CONTENT above; do not invent code or text that was not shown.',
    'If the CONTENT is insufficient to answer reliably, say so clearly rather than guessing.',
    'This object was chosen by a geometric resolver, not guessed by a model.',
  ].join('\n')
}

const RESOLVED_SYSTEM = [
  'You are a concise, honest tutor for engineering students.',
  'Answer specifically about the RESOLVED OBJECT the student pointed to.',
  'Never conflate the nearby context with the object itself.',
  'Do not invent files, line numbers, citations, APIs, or surrounding code.',
].join('\n')
