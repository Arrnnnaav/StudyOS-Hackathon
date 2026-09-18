import { NextResponse } from 'next/server'
import { resolveApiUser } from '@/lib/auth-utils'
import { createAsk, trackEvent } from '@/lib/db'
import { invokeModel, MODEL_ID } from '@/lib/bedrock'
import { rankAnchors, anchorsToContext, buildSpatialPrompt } from '@/shared/spatial'
import type { SpatialAskRequest, SpatialAskResponse } from '@/shared/contracts'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_QUESTION = 2000
const MAX_ANCHORS = 40

/**
 * POST /api/spatial/ask — rectangle/circle/freehand Point & Ask.
 * Body: { extension_session_token?, question, marks, anchors, canvas, page, research?, level? }
 * Groups on the DOM/PDF text under the mark (never the whole page). If Bedrock
 * is unavailable, returns a clear error — the client shows the failure state.
 */
export async function POST(request: Request) {
  const started = Date.now()
  try {
    const body = (await request.json()) as SpatialAskRequest

    // Auth: web session OR extension token (resolveApiUser handles both).
    const user = await resolveApiUser(body as unknown as Record<string, unknown>)

    if (!user) {
      return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    }

    const question = String(body.question ?? '').trim()
    const marks = Array.isArray(body.marks) ? body.marks : []
    const anchors = Array.isArray(body.anchors) ? body.anchors.slice(0, MAX_ANCHORS) : []
    const page = body.page ?? { url: '', title: '', surface: 'web' as const }

    if (!question) {
      return NextResponse.json(errorBody('BAD_REQUEST', 'question is required'), { status: 400 })
    }
    if (question.length > MAX_QUESTION) {
      return NextResponse.json(errorBody('TOO_LONG', 'question too long'), { status: 400 })
    }
    if (!marks.length) {
      return NextResponse.json(errorBody('BAD_REQUEST', 'at least one mark is required'), { status: 400 })
    }

    const selected = rankAnchors(anchors, marks, 8)
    const markedText = anchorsToContext(selected)

    // Track start (privacy-safe: never question/answer text).
    void trackEvent({
      eventId: crypto.randomUUID(),
      eventName: 'point_ask_started',
      timestamp: new Date().toISOString(),
      userId: user.userId,
      sessionId: 'spatial',
      topicId: null,
      domain: page.url ? new URL(page.url, 'http://localhost').hostname : null,
      properties: { request_kind: 'spatial', surface: page.surface },
    }).catch(() => {})

    const prompt = buildSpatialPrompt({
      question,
      markedText,
      pageTitle: page.title || '',
      pageUrl: page.url || '',
      surface: page.surface === 'pdf' ? 'pdf' : 'web',
    })

    let answer: string
    let provider = 'none'
    try {
      answer = await invokeModel({ system: contextSystem(body.research), user: prompt, maxTokens: 900, temperature: 0.3 })
      provider = 'bedrock'
    } catch (err) {
      // Bedrock unavailable — surface it clearly so the client shows failure.
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
    // Persist the ask for history + the operator stream.
    const askId = crypto.randomUUID()
    await createAsk({
      id: askId,
      userId: user.userId,
      topicId: null,
      domain: page.url ? new URL(page.url, 'http://localhost').hostname : '',
      pageTitle: page.title || '',
      selectedText: markedText.slice(0, 800),
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
      properties: { latencyMs, provider },
    }).catch(() => {})

    const response: SpatialAskResponse = {
      id: askId,
      answer,
      anchors_used: selected,
      confidence: Math.min(1, markedText.length > 40 ? 0.9 : 0.55),
      provider,
      model: MODEL_ID,
      vision: false,
      ocr: false,
      sources: body.research ? [] : undefined,
      cited: body.research ? [] : undefined,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Spatial ask error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to process Point & Ask'), { status: 500 })
  }
}

function contextSystem(research?: boolean): string {
  const base = [
    'You are a concise, honest tutor for engineering students.',
    'Use ONLY the marked/selected text and its immediate context for claims about the student\'s selection.',
    'If the provided text is not enough to answer reliably, say so plainly.',
    'Explain: (1) what the selected part does, (2) why it matters, (3) the direct answer.',
    'Prefer a short example when it helps. Do not invent files, lines, APIs, or surrounding code.',
    'Do not fabricate citations or sources.',
  ]
  if (research) {
    base.push('You may reason about the general topic to help, but keep claims about the student\'s selection grounded in the marked text.')
  }
  return base.join('\n')
}