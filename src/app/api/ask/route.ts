import { NextResponse } from 'next/server'
import { GEMINI_MODEL, generateText, type AiProvider } from '@/lib/ai'
import { getAskContext, createAsk, trackEvent } from '@/lib/db'
import { resolveApiUser } from '@/lib/auth-utils'
import { abandonAskReservation, askRequestHash, completeAskReservation, parseIdempotencyKey, reserveAsk, takeDailyAskQuota, waitForAskResult, type StoredAskResponse } from '@/lib/ask-safety'
import type { AskContext, AskRequest, GroundingExcerpt } from '@/shared/contracts'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_QUESTION = 2_000

export async function POST(request: Request) {
  let reservation: { userId: string; key: string } | null = null
  try {
    const body = await request.json() as AskRequest
    const user = await resolveApiUser(body as unknown as Record<string, unknown>)
    if (!user) return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })

    const parsed = parseAsk(body)
    if (!parsed.ok) return NextResponse.json(errorBody('BAD_REQUEST', parsed.message), { status: 400 })
    const key = parseIdempotencyKey(request.headers.get('idempotency-key') ?? body.idempotency_key)
    if (!key) return NextResponse.json(errorBody('IDEMPOTENCY_KEY_REQUIRED', 'provide an Idempotency-Key header or idempotency_key UUID'), { status: 400 })

    const hash = askRequestHash({ topicId: parsed.topicId, question: parsed.question, context: parsed.context, level: body.level })
    const reserved = await reserveAsk(user.userId, key, hash)
    if (reserved.state === 'cached') return NextResponse.json(reserved.response, { headers: { 'Idempotency-Replayed': 'true' } })
    if (reserved.state === 'conflict') return NextResponse.json(errorBody('IDEMPOTENCY_CONFLICT', 'this key was already used for a different request'), { status: 409 })
    if (reserved.state === 'pending') {
      const cached = await waitForAskResult(user.userId, key)
      if (cached) return NextResponse.json(cached, { headers: { 'Idempotency-Replayed': 'true' } })
      return NextResponse.json(errorBody('REQUEST_IN_PROGRESS', 'an identical request is still running'), { status: 409, headers: { 'Retry-After': '2' } })
    }
    reservation = { userId: user.userId, key }

    const quota = await takeDailyAskQuota(user.userId)
    if (!quota.allowed) {
      await abandonAskReservation(user.userId, key)
      reservation = null
      return NextResponse.json(errorBody('RATE_LIMITED', `daily Ask limit (${quota.limit}) reached`), { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds), 'X-RateLimit-Limit': String(quota.limit), 'X-RateLimit-Remaining': '0' } })
    }

    const answer = await answerAndPersist(user.userId, parsed, body.level)
    await completeAskReservation(user.userId, key, answer)
    reservation = null
    return NextResponse.json(answer, { headers: { 'X-RateLimit-Limit': String(quota.limit), 'X-RateLimit-Remaining': String(Math.max(0, quota.limit - quota.count)) } })
  } catch (error) {
    if (reservation) await abandonAskReservation(reservation.userId, reservation.key).catch(() => undefined)
    console.error('Ask error:', error)
    return NextResponse.json(errorBody('ASK_FAILED', 'failed to process Ask'), { status: 500 })
  }
}

export type ParsedAsk = { topicId: string | null; question: string; context: AskContext }

export function parseAsk(body: AskRequest): { ok: true } & ParsedAsk | { ok: false; message: string } {
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const context = body.context
  if (!question) return { ok: false, message: 'question is required' }
  if (question.length > MAX_QUESTION) return { ok: false, message: 'question is too long' }
  if (!context || typeof context.selected_text !== 'string' || !context.selected_text.trim()) return { ok: false, message: 'selected context is required' }
  return {
    ok: true,
    topicId: typeof body.topic_id === 'string' ? body.topic_id : null,
    question,
    context: {
      selected_text: context.selected_text.slice(0, 12_000),
      nearby_before: String(context.nearby_before ?? '').slice(0, 4_000),
      nearby_after: String(context.nearby_after ?? '').slice(0, 4_000),
      domain: String(context.domain ?? '').slice(0, 255),
      page_title: String(context.page_title ?? '').slice(0, 500),
    },
  }
}

export async function answerAndPersist(userId: string, input: ParsedAsk, level?: string): Promise<StoredAskResponse> {
  const started = Date.now()
  const history = await getAskContext(userId, input.topicId, input.context.domain, 2)
  const prompt = buildAskPrompt(input.context, input.question, history)
  const generated = await generateText({ system: askSystemPrompt(level), user: prompt, maxTokens: 1_000, temperature: 0.3 })
  return persistAskAnswer(userId, input, generated.text, started, history.length, generated.model, generated.provider)
}

export async function persistAskAnswer(userId: string, input: ParsedAsk, answer: string, started: number, contextUsed: number, model = GEMINI_MODEL, provider: AiProvider = 'gemini'): Promise<StoredAskResponse> {
  const response: StoredAskResponse = {
    askId: crypto.randomUUID(), answer, grounding: extractGrounding(input.context, answer),
    insufficientContext: /insufficient|cannot answer|not enough information/i.test(answer),
    latencyMs: Date.now() - started, model, contextUsed,
  }
  const now = new Date().toISOString()
  await createAsk({
    id: response.askId, userId, topicId: input.topicId, domain: input.context.domain, pageTitle: input.context.page_title,
    selectedText: input.context.selected_text, nearbyBefore: input.context.nearby_before, nearbyAfter: input.context.nearby_after,
    question: input.question, answer, model, provider, latencyMs: response.latencyMs, helpful: null, feedbackReason: null, savedToReview: false, createdAt: now,
  })
  void trackEvent({ eventId: crypto.randomUUID(), eventName: 'point_ask_submitted', timestamp: now, userId, sessionId: 'web', topicId: input.topicId, domain: input.context.domain, properties: { model, provider, latencyMs: response.latencyMs, context_turns: contextUsed } }).catch(() => undefined)
  return response
}

export function askSystemPrompt(level?: string) {
  return `You are a concise ${level || 'student'} tutor. Use only the supplied selected and nearby context for claims. If context is insufficient, say so clearly. Explain what it does, why it matters, and directly answer the question. Do not invent files, line numbers, citations, APIs, or surrounding code.`
}

export function buildAskPrompt(context: AskContext, question: string, history: Array<{ question?: string; answer?: string }>) {
  const previous = history.length ? history.map((turn, index) => `Turn ${index + 1} question: ${turn.question}\nTurn ${index + 1} answer: ${turn.answer?.slice(0, 1_200)}`).join('\n\n') : '(none)'
  return `Selected text:\n\`\`\`\n${context.selected_text}\n\`\`\`\n\nNearby before:\n\`\`\`\n${context.nearby_before || '(none)'}\n\`\`\`\n\nNearby after:\n\`\`\`\n${context.nearby_after || '(none)'}\n\`\`\`\n\nPrior turns (context only; do not repeat them unless relevant):\n${previous}\n\nPage: ${context.page_title} (${context.domain})\n\nQuestion: ${question}`
}

function extractGrounding(context: AskContext, answer: string): GroundingExcerpt[] {
  const values: Array<[GroundingExcerpt['type'], string]> = [['selected_text', context.selected_text], ['nearby_before', context.nearby_before], ['nearby_after', context.nearby_after]]
  return values.filter(([, value]) => value && answer.toLowerCase().includes(value.toLowerCase().slice(0, 50))).map(([type, value]) => ({ type, excerpt: value.slice(0, 200) }))
}
