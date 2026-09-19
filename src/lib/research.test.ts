import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildResearchPrompt,
  normalizeSources,
  research,
  ResearchProviderUnavailableError,
  ResearchUnavailableError,
  type ResearchDependencies,
} from './research.ts'
import { askRequestHash } from './ask-safety.ts'

const input = {
  question: 'What is the current status of this public technology?',
  pageTitle: 'Example lesson',
  domain: 'example.edu',
  selectedText: 'A selected passage from the lesson.',
  nearby: 'Nearby lesson context.',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function deps(fetchImpl: typeof fetch, overrides: Partial<ResearchDependencies> = {}): ResearchDependencies {
  return {
    fetch: fetchImpl,
    config: {
      bedrockEnabled: true,
      bedrockApiKey: 'test-bedrock-key',
      bedrockModel: 'openai.test-model',
      geminiApiKey: 'test-gemini-key',
      geminiModel: 'gemini-2.5-flash',
      timeoutMs: 30_000,
      failureThreshold: 3,
      cooldownMs: 30_000,
    },
    ...overrides,
  }
}

test('normalizes unique provider-supplied HTTPS sources only', () => {
  const sources = normalizeSources([
    { url: 'https://Example.com/article#section', title: 'Example article' },
    { url: 'https://example.com/article#section', title: 'Duplicate article' },
    { url: 'http://insecure.example/article', title: 'Insecure' },
    { url: 'javascript:alert(1)', title: 'Unsafe' },
  ])

  assert.deepEqual(sources, [{
    id: 'source-1',
    title: 'Example article',
    url: 'https://example.com/article#section',
    cited: true,
  }])
})

test('builds a bounded research prompt without full-page data', () => {
  const prompt = buildResearchPrompt({
    question: 'q'.repeat(1_700),
    pageTitle: 'Lesson title',
    domain: 'example.edu',
    selectedText: 's'.repeat(900),
    nearby: 'n'.repeat(700),
  })

  assert.equal(prompt.includes('q'.repeat(1_501)), false)
  assert.equal(prompt.includes('s'.repeat(801)), false)
  assert.equal(prompt.includes('n'.repeat(601)), false)
  assert.match(prompt, /Lesson title/)
  assert.match(prompt, /example\.edu/)
})

test('rejects an answer without valid provider citations', async () => {
  await assert.rejects(
    research(input, deps(async () => jsonResponse({
      choices: [{ message: { content: 'An answer with no citations.' } }],
    }), {
      config: { bedrockEnabled: false, geminiApiKey: 'test-gemini-key' },
    })),
    ResearchUnavailableError,
  )
})

test('falls back to Gemini Google Search exactly once when Bedrock is unavailable', async () => {
  const calls: string[] = []
  const result = await research(input, deps(async (url) => {
    calls.push(String(url))
    if (String(url).includes('bedrock')) return jsonResponse({ error: 'not entitled' }, 403)
    return jsonResponse({
      candidates: [{
        content: { parts: [{ text: 'Gemini cited answer.' }] },
        groundingMetadata: {
          groundingChunks: [{ web: { uri: 'https://docs.example.com/research', title: 'Research source' } }],
        },
      }],
    })
  }))

  assert.equal(result.provider, 'gemini-google-search')
  assert.equal(result.sources[0]?.url, 'https://docs.example.com/research')
  assert.equal(calls.filter((url) => url.includes('bedrock')).length, 1)
  assert.equal(calls.filter((url) => url.includes('generativelanguage.googleapis.com')).length, 1)
})

test('uses Gemini Google Search and never accepts a response without grounding sources', async () => {
  let requestBody: Record<string, unknown> | undefined
  await assert.rejects(research(input, deps(async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return jsonResponse({ candidates: [{ content: { parts: [{ text: 'Unsourced answer.' }] } }] })
  }, { config: { bedrockEnabled: false, geminiApiKey: 'test-gemini-key' } })), ResearchUnavailableError)

  assert.deepEqual(requestBody?.tools, [{ google_search: {} }])
})

test('uses Gemini grounding chunks as cited sources', async () => {
  const result = await research(input, deps(async () => jsonResponse({
    candidates: [{
      content: { parts: [{ text: 'Cited answer from Gemini grounding.' }] },
      groundingMetadata: { groundingChunks: [{ web: { title: 'Official source', uri: 'https://docs.example.com/current' } }] },
    }],
  }), { config: { bedrockEnabled: false, geminiApiKey: 'test-gemini-key' } }))
  assert.equal(result.sources[0]?.url, 'https://docs.example.com/current')
})

test('reports an unavailable provider separately from insufficient evidence', async () => {
  await assert.rejects(
    research(input, deps(async () => jsonResponse({ error: 'unavailable' }, 503), { config: { bedrockEnabled: false, geminiApiKey: 'test-gemini-key' } })),
    ResearchProviderUnavailableError,
  )
})

test('does not call Gemini when Bedrock returned an uncited answer', async () => {
  const calls: string[] = []
  await assert.rejects(research(input, deps(async (url) => {
    calls.push(String(url))
    return jsonResponse({ output_text: 'Unsourced answer', output: [] })
  })), ResearchUnavailableError)
  assert.equal(calls.filter((url) => url.includes('generativelanguage.googleapis.com')).length, 0)
})

test('opens the Bedrock circuit after three consecutive failures for thirty seconds', async () => {
  const calls: string[] = []
  let now = 1_000
  const state = { failures: 0, openedAt: 0 }
  const fetchImpl: typeof fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('bedrock')) return jsonResponse({ error: 'not entitled' }, 403)
    return jsonResponse({ candidates: [{ content: { parts: [{ text: 'Cited fallback answer.' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com/source' } }] } }] })
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await research(input, deps(fetchImpl, { now: () => now, circuit: state }))
    now += 1
  }
  await research(input, deps(fetchImpl, { now: () => now, circuit: state }))

  assert.equal(calls.filter((url) => url.includes('bedrock')).length, 3)
  assert.equal(calls.filter((url) => url.includes('generativelanguage.googleapis.com')).length, 4)
})

test('research participates in stable request identity but ephemeral extension fields do not', () => {
  const base = {
    topicId: null,
    question: 'Explain this selection',
    context: {
      selected_text: 'selected text',
      nearby_before: 'before',
      nearby_after: 'after',
      domain: 'example.edu',
      page_title: 'Example',
    },
    level: 'student',
  }
  const ordinaryRequest = { ...base, research: false, extension_session_token: 'ephemeral-a' }
  const researchRequest = { ...base, research: true, extension_session_token: 'ephemeral-b' }
  const replayRequest = { ...base, research: true, extension_session_token: 'ephemeral-c' }
  const ordinary = askRequestHash(ordinaryRequest)
  const researchHash = askRequestHash(researchRequest)

  assert.notEqual(ordinary, researchHash)
  assert.equal(researchHash, askRequestHash(replayRequest))
})
