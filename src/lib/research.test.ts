import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildResearchPrompt,
  normalizeSources,
  research,
  ResearchUnavailableError,
  type ResearchDependencies,
} from './research.ts'

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
      groqApiKey: 'test-groq-key',
      groqModel: 'groq/compound',
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
      config: { bedrockEnabled: false, groqApiKey: 'test-groq-key' },
    })),
    ResearchUnavailableError,
  )
})

test('falls back to Groq Compound exactly once when Bedrock is unavailable', async () => {
  const calls: string[] = []
  const result = await research(input, deps(async (url) => {
    calls.push(String(url))
    if (String(url).includes('bedrock')) return jsonResponse({ error: 'not entitled' }, 403)
    return jsonResponse({
      choices: [{
        message: {
          content: 'Groq cited answer.',
          citations: ['https://docs.example.com/research'],
        },
      }],
    })
  }))

  assert.equal(result.provider, 'groq-compound')
  assert.equal(result.sources[0]?.url, 'https://docs.example.com/research')
  assert.equal(calls.filter((url) => url.includes('bedrock')).length, 1)
  assert.equal(calls.filter((url) => url.includes('groq')).length, 1)
})

test('opens the Bedrock circuit after three consecutive failures for thirty seconds', async () => {
  const calls: string[] = []
  let now = 1_000
  const state = { failures: 0, openedAt: 0 }
  const fetchImpl: typeof fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('bedrock')) return jsonResponse({ error: 'not entitled' }, 403)
    return jsonResponse({
      choices: [{ message: { content: 'Cited fallback answer.', citations: ['https://example.com/source'] } }],
    })
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await research(input, deps(fetchImpl, { now: () => now, circuit: state }))
    now += 1
  }
  await research(input, deps(fetchImpl, { now: () => now, circuit: state }))

  assert.equal(calls.filter((url) => url.includes('bedrock')).length, 3)
  assert.equal(calls.filter((url) => url.includes('groq')).length, 4)
})
