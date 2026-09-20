import assert from 'node:assert/strict'
import test from 'node:test'
import { AIProviderUnavailableError, GEMINI_MODEL, generateText, streamText, type AiDependencies } from './ai.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function deps(fetch: typeof globalThis.fetch): AiDependencies {
  return { fetch, config: { apiKey: 'test-key', model: 'gemini-2.5-flash', timeoutMs: 5_000 } }
}

test('uses Gemini 3.6 Flash as the supported default model', () => {
  assert.equal(GEMINI_MODEL, 'gemini-3.6-flash')
})

test('generates a server-side Gemini answer with separate system instruction', async () => {
  let requestedUrl = ''
  let requestBody: Record<string, unknown> | undefined

  const result = await generateText({ system: 'Be concise.', user: 'Explain a stack.', maxTokens: 300, temperature: 0.2 }, deps(async (url, init) => {
    requestedUrl = String(url)
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return jsonResponse({ candidates: [{ content: { parts: [{ text: 'A stack is LIFO.' }] } }] })
  }))

  assert.equal(result.text, 'A stack is LIFO.')
  assert.equal(result.model, 'gemini-2.5-flash')
  assert.match(requestedUrl, /gemini-2\.5-flash:generateContent$/)
  assert.deepEqual(requestBody?.systemInstruction, { parts: [{ text: 'Be concise.' }] })
  assert.deepEqual(requestBody?.generationConfig, { maxOutputTokens: 300, temperature: 0.2 })
})

test('fails safely when Gemini is not configured or returns no answer', async () => {
  await assert.rejects(
    generateText({ system: 's', user: 'u' }, { config: { apiKey: '', model: 'gemini-2.5-flash', timeoutMs: 5_000 } }),
    AIProviderUnavailableError,
  )

  await assert.rejects(
    generateText({ system: 's', user: 'u' }, deps(async () => jsonResponse({ candidates: [] }))),
    AIProviderUnavailableError,
  )
})

test('streams Gemini SSE answer text in provider order', async () => {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}\n\n'))
      controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"world"}]},"finishReason":"STOP"}]}\n\n'))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  const chunks: string[] = []
  for await (const chunk of streamText({ system: 's', user: 'u' }, deps(async (url) => {
    assert.match(String(url), /:streamGenerateContent\?alt=sse$/)
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }))) chunks.push(chunk)

  assert.deepEqual(chunks, ['Hello ', 'world'])
})

test('accepts standard CRLF-delimited Gemini SSE frames', async () => {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"CRLF"}]},"finishReason":"STOP"}]}\r\n\r\n'))
      controller.close()
    },
  })
  const chunks: string[] = []
  for await (const chunk of streamText({ system: 's', user: 'u' }, deps(async () => new Response(body)))) chunks.push(chunk)
  assert.deepEqual(chunks, ['CRLF'])
})

test('rejects a partial stream when Gemini reports a non-stop finish reason', async () => {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"Partial"}]}}]}\n\n'))
      controller.enqueue(encoder.encode('data: {"candidates":[{"finishReason":"SAFETY"}]}\n\n'))
      controller.close()
    },
  })

  await assert.rejects(async () => {
    for await (const _chunk of streamText({ system: 's', user: 'u' }, deps(async () => new Response(body)))) {
      // Consume the first partial delta; the provider's terminal safety event must then reject.
    }
  }, AIProviderUnavailableError)
})

test('rejects a partial stream when Gemini emits an error event', async () => {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"Partial"}]}}]}\n\n'))
      controller.enqueue(encoder.encode('data: {"error":{"code":503,"message":"unavailable"}}\n\n'))
      controller.close()
    },
  })
  await assert.rejects(async () => {
    for await (const _chunk of streamText({ system: 's', user: 'u' }, deps(async () => new Response(body)))) {
      // The subsequent provider error must make the whole stream fail.
    }
  }, AIProviderUnavailableError)
})
