import { streamText, type AiProvider } from '@/lib/ai'
import { getAskContext } from '@/lib/db'
import { abandonAskReservation, askRequestHash, completeAskReservation, parseIdempotencyKey, reserveAsk, takeDailyAskQuota, waitForAskResult } from '@/lib/ask-safety'
import { resolveApiUser } from '@/lib/auth-utils'
import { askSystemPrompt, buildAskPrompt, parseAsk, persistAskAnswer } from '@/app/api/ask/route'
import type { AskRequest } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()
const sse = (event: string, data: unknown) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

/**
 * POST /api/ask/stream — Server-Sent Events for Point & Ask.
 * Uses the identical durable idempotency and quota policy as /api/ask.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as AskRequest
    const user = await resolveApiUser(body as unknown as Record<string, unknown>)
    if (!user) return jsonError(401, 'UNAUTHORIZED', 'authentication required')
    const parsed = parseAsk(body)
    if (!parsed.ok) return jsonError(400, 'BAD_REQUEST', parsed.message)
    const key = parseIdempotencyKey(request.headers.get('idempotency-key') ?? body.idempotency_key)
    if (!key) return jsonError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'provide an Idempotency-Key header or idempotency_key UUID')

    const hash = askRequestHash({ topicId: parsed.topicId, question: parsed.question, context: parsed.context, level: body.level })
    const reservation = await reserveAsk(user.userId, key, hash)
    if (reservation.state === 'cached') return completedStream(reservation.response, true)
    if (reservation.state === 'conflict') return jsonError(409, 'IDEMPOTENCY_CONFLICT', 'this key was already used for a different request')
    if (reservation.state === 'pending') {
      const cached = await waitForAskResult(user.userId, key)
      return cached ? completedStream(cached, true) : jsonError(409, 'REQUEST_IN_PROGRESS', 'an identical request is still running')
    }

    const quota = await takeDailyAskQuota(user.userId)
    if (!quota.allowed) {
      await abandonAskReservation(user.userId, key)
      return jsonError(429, 'RATE_LIMITED', `daily Ask limit (${quota.limit}) reached`, { 'Retry-After': String(quota.retryAfterSeconds) })
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const started = Date.now()
        let answer = ''
        let model = ''
        let provider: AiProvider | undefined
        try {
          controller.enqueue(sse('ready', { replayed: false }))
          const history = await getAskContext(user.userId, parsed.topicId, parsed.context.domain, 2)
          const prompt = buildAskPrompt(parsed.context, parsed.question, history)
          for await (const delta of streamText({ system: askSystemPrompt(body.level), user: prompt, maxTokens: 1_000, temperature: 0.3 }, {
            onProvider: (selectedProvider, selectedModel) => { provider = selectedProvider; model = selectedModel },
          })) {
            answer += delta
            controller.enqueue(sse('token', { delta }))
          }
          if (!provider || !model) throw new Error('answer provider did not report a model')
          const response = await persistAskAnswer(user.userId, parsed, answer, started, history.length, model, provider)
          await completeAskReservation(user.userId, key, response)
          controller.enqueue(sse('complete', response))
        } catch (error) {
          await abandonAskReservation(user.userId, key).catch(() => undefined)
          controller.enqueue(sse('error', { code: 'ASK_FAILED', message: error instanceof Error ? error.message : 'stream failed' }))
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-RateLimit-Limit': String(quota.limit), 'X-RateLimit-Remaining': String(Math.max(0, quota.limit - quota.count)) } })
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'body must be valid JSON')
  }
}

function completedStream(response: unknown, replayed: boolean) {
  return new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(sse('complete', { ...(response as object), replayed })); controller.close() } }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Idempotency-Replayed': 'true' } })
}

function jsonError(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers })
}
