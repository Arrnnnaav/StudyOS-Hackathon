const MAX_QUESTION_CHARS = 1_500
const MAX_SELECTED_CHARS = 800
const MAX_NEARBY_CHARS = 600
const MAX_SOURCES = 10

export type ResearchSource = { id: string; title: string; url: string; cited: true }
export type ResearchResult = {
  answer: string
  sources: ResearchSource[]
  cited: string[]
  provider: 'bedrock-web-search' | 'gemini-google-search' | 'gemini-web-fallback'
}

export type ResearchInput = {
  question: string
  pageTitle: string
  domain: string
  selectedText: string
  nearby: string
}

export type ResearchConfig = {
  bedrockEnabled: boolean
  bedrockRegion: string
  bedrockApiKey: string
  bedrockModel: string
  geminiApiKey: string
  geminiModel: string
  timeoutMs: number
  failureThreshold: number
  cooldownMs: number
}

export type ResearchCircuit = { failures: number; openedAt: number }

export type ResearchDependencies = {
  fetch?: typeof globalThis.fetch
  now?: () => number
  config?: Partial<ResearchConfig>
  circuit?: ResearchCircuit
}

export class ResearchUnavailableError extends Error {
  constructor(message = 'I could not find enough reliable sourced evidence to answer this.') {
    super(message)
    this.name = 'ResearchUnavailableError'
  }
}

export class ResearchProviderUnavailableError extends Error {
  constructor() {
    super('Research provider is unavailable.')
    this.name = 'ResearchProviderUnavailableError'
  }
}

class ProviderError extends Error {
  readonly retryable: boolean

  constructor(retryable: boolean) {
    super('Research provider request failed.')
    this.name = 'ProviderError'
    this.retryable = retryable
  }
}

const sharedCircuit: ResearchCircuit = { failures: 0, openedAt: 0 }

function configuredResearch(): ResearchConfig {
  return {
    bedrockEnabled: process.env.BEDROCK_WEB_SEARCH_ENABLED === 'true',
    bedrockRegion: process.env.BEDROCK_WEB_SEARCH_REGION || process.env.AWS_REGION || 'us-east-1',
    bedrockApiKey: process.env.BEDROCK_MANTLE_API_KEY || '',
    bedrockModel: process.env.BEDROCK_WEB_SEARCH_MODEL || 'openai.gpt-5.6-terra',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_RESEARCH_MODEL || 'gemini-3.6-flash',
    timeoutMs: Number(process.env.RESEARCH_PROVIDER_TIMEOUT_MS || 30_000),
    failureThreshold: Number(process.env.RESEARCH_BEDROCK_FAILURE_THRESHOLD || 3),
    cooldownMs: Number(process.env.RESEARCH_BEDROCK_COOLDOWN_MS || 30_000),
  }
}

function bounded(value: string, maximum: number): string {
  return value.slice(0, maximum)
}

/** Builds the only context that can leave the application for web research. */
export function buildResearchPrompt(input: ResearchInput): string {
  return [
    'Answer the student using current public-web evidence.',
    'Distinguish sourced facts from inference, state uncertainty when sources conflict, and do not invent citations or URLs.',
    `Question: ${bounded(input.question, MAX_QUESTION_CHARS)}`,
    `Page title: ${input.pageTitle.slice(0, 300)}`,
    `Page domain: ${input.domain.slice(0, 300)}`,
    `Selected lesson text: ${bounded(input.selectedText, MAX_SELECTED_CHARS)}`,
    `Nearby lesson context: ${bounded(input.nearby, MAX_NEARBY_CHARS)}`,
  ].join('\n')
}

type SourceCandidate = { url: string; title?: string }

function sourceCandidates(input: unknown): SourceCandidate[] {
  if (typeof input === 'string') return [{ url: input }]
  if (!Array.isArray(input)) return []
  return input.flatMap((item): SourceCandidate[] => {
    if (typeof item === 'string') return [{ url: item }]
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const web = record.web && typeof record.web === 'object' ? record.web as Record<string, unknown> : undefined
    if (web && typeof web.uri === 'string') {
      return [{ url: web.uri, title: typeof web.title === 'string' ? web.title : undefined }]
    }
    const url = record.url ?? record.source_url
    const title = record.title ?? record.source_title
    return typeof url === 'string' ? [{ url, title: typeof title === 'string' ? title : undefined }] : []
  })
}

/** Retains only safe, provider-originated source records passed by the adapters. */
export function normalizeSources(input: unknown): ResearchSource[] {
  const seen = new Set<string>()
  const sources: ResearchSource[] = []
  for (const candidate of sourceCandidates(input)) {
    try {
      const parsed = new URL(candidate.url)
      if (parsed.protocol !== 'https:') continue
      const url = parsed.toString()
      if (seen.has(url)) continue
      seen.add(url)
      sources.push({
        id: `source-${sources.length + 1}`,
        title: candidate.title?.trim() || parsed.hostname,
        url,
        cited: true,
      })
      if (sources.length === MAX_SOURCES) break
    } catch {
      // Malformed provider metadata is not a source.
    }
  }
  return sources
}

function responseText(body: Record<string, unknown>): string {
  if (typeof body.output_text === 'string') return body.output_text.trim()
  const output = Array.isArray(body.output) ? body.output : []
  const text = output.flatMap((message) => {
    if (!message || typeof message !== 'object') return []
    const content = (message as { content?: unknown }).content
    if (!Array.isArray(content)) return []
    return content.flatMap((part) => (
      part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
        ? [(part as { text: string }).text]
        : []
    ))
  }).join('\n').trim()
  return text
}

function bedrockAnnotations(body: Record<string, unknown>): unknown[] {
  const output = Array.isArray(body.output) ? body.output : []
  return output.flatMap((message) => {
    if (!message || typeof message !== 'object') return []
    const content = (message as { content?: unknown }).content
    if (!Array.isArray(content)) return []
    return content.flatMap((part) => {
      if (!part || typeof part !== 'object') return []
      const annotations = (part as { annotations?: unknown }).annotations
      return Array.isArray(annotations) ? annotations : []
    })
  })
}

function geminiMessage(body: Record<string, unknown>): { answer: string; citations: unknown } {
  const candidate = Array.isArray(body.candidates) ? body.candidates[0] : undefined
  if (!candidate || typeof candidate !== 'object') return { answer: '', citations: [] }
  const record = candidate as { content?: unknown; groundingMetadata?: unknown }
  const content = record.content && typeof record.content === 'object' ? record.content as { parts?: unknown } : undefined
  const parts = Array.isArray(content?.parts) ? content.parts : []
  const answer = parts.flatMap((part) => (
    part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
      ? [(part as { text: string }).text]
      : []
  )).join('\n').trim()
  const metadata = record.groundingMetadata && typeof record.groundingMetadata === 'object'
    ? record.groundingMetadata as { groundingChunks?: unknown }
    : undefined
  return { answer, citations: metadata?.groundingChunks ?? [] }
}

function cleanHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function duckDuckGoUrl(href: string): string | null {
  try {
    const parsed = new URL(href, 'https://html.duckduckgo.com')
    const redirected = parsed.searchParams.get('uddg')
    return redirected ? decodeURIComponent(redirected) : parsed.toString()
  } catch {
    return null
  }
}

async function duckDuckGoSources(query: string, config: ResearchConfig, fetchImpl: typeof fetch): Promise<ResearchSource[]> {
  const response = await fetchImpl('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'LearningHQ Research/1.0' },
    body: new URLSearchParams({ q: query.slice(0, MAX_QUESTION_CHARS), kl: 'us-en' }).toString(),
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  if (!response.ok) throw new ResearchProviderUnavailableError()
  const html = await response.text()
  const matches = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  const candidates = matches.slice(0, MAX_SOURCES).map((match) => ({
    url: duckDuckGoUrl(match[1]),
    title: cleanHtml(match[2]),
  })).filter((source): source is { url: string; title: string } => Boolean(source.url))
  return normalizeSources(candidates)
}

function citedSources(answer: string, sources: ResearchSource[]): { answer: string; sources: ResearchSource[] } {
  const cited = [...new Set([...answer.matchAll(/\[(\d{1,2})\]/g)].map((match) => Number(match[1])))]
    .filter((index) => Boolean(sources[index - 1]))
    .sort((left, right) => left - right)
  const selected = cited.flatMap((index) => sources[index - 1] ? [sources[index - 1]] : [])
  const renumber = new Map(cited.map((index, position) => [index, position + 1]))
  return {
    answer: answer.replace(/\[(\d{1,2})\]/g, (_match, value) => {
      const replacement = renumber.get(Number(value))
      return replacement ? `[${replacement}]` : ''
    }).replace(/\s{2,}/g, ' ').trim(),
    sources: selected.map((source, index) => ({ ...source, id: `source-${index + 1}` })),
  }
}

async function requestJson(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number, retryTransient: boolean): Promise<Record<string, unknown>> {
  const attempts = retryTransient ? 2 : 1
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if (response.ok) {
        const body = await response.json()
        if (body && typeof body === 'object') return body as Record<string, unknown>
        throw new ProviderError(false)
      }
      const retryable = response.status >= 500
      if (!retryable || attempt === attempts - 1) throw new ProviderError(retryable)
    } catch (error) {
      if (error instanceof ProviderError) {
        if (!error.retryable || attempt === attempts - 1) throw error
      } else if (attempt === attempts - 1) {
        throw new ProviderError(true)
      }
    }
  }
  throw new ProviderError(true)
}

async function callBedrock(prompt: string, config: ResearchConfig, fetchImpl: typeof fetch): Promise<Omit<ResearchResult, 'provider'>> {
  const url = `https://bedrock-mantle.${config.bedrockRegion}.api.aws/openai/v1/responses`
  const body = await requestJson(fetchImpl, url, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.bedrockApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.bedrockModel,
      input: prompt,
      max_output_tokens: 1_200,
      store: false,
      tools: [{ type: 'web_search', external_web_access: true }],
    }),
  }, config.timeoutMs, true)
  const answer = responseText(body)
  const sources = normalizeSources(bedrockAnnotations(body))
  if (!answer || sources.length === 0) throw new ResearchUnavailableError()
  return { answer, sources, cited: sources.map((source) => source.url) }
}

async function callGemini(prompt: string, config: ResearchConfig, fetchImpl: typeof fetch): Promise<Omit<ResearchResult, 'provider'>> {
  const body = await requestJson(fetchImpl, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': config.geminiApiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 1_200, temperature: 0.2 },
    }),
  }, config.timeoutMs, true)
  const { answer, citations } = geminiMessage(body)
  const sources = normalizeSources(citations)
  if (!answer || sources.length === 0) throw new ResearchUnavailableError()
  return { answer, sources, cited: sources.map((source) => source.url) }
}

async function callGeminiWebFallback(prompt: string, query: string, config: ResearchConfig, fetchImpl: typeof fetch): Promise<Omit<ResearchResult, 'provider'>> {
  const sources = await duckDuckGoSources(query, config, fetchImpl)
  if (sources.length === 0) throw new ResearchUnavailableError()
  const sourceBlock = sources.map((source, index) => `[${index + 1}] ${source.title} — ${source.url}`).join('\n')
  const body = await requestJson(fetchImpl, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': config.geminiApiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nPublic-web search results:\n${sourceBlock}\n\nAnswer only from the supplied results. Put [1], [2], etc. after every factual claim. If the results are insufficient, say so.` }] }],
      generationConfig: { maxOutputTokens: 1_200, temperature: 0.2 },
    }),
  }, config.timeoutMs, true)
  const { answer } = geminiMessage(body)
  const cited = citedSources(answer, sources)
  if (!answer || cited.sources.length === 0) throw new ResearchUnavailableError()
  return { answer: cited.answer, sources: cited.sources, cited: cited.sources.map((source) => source.url) }
}

function circuitOpen(circuit: ResearchCircuit, now: number, cooldownMs: number): boolean {
  if (!circuit.openedAt) return false
  if (now - circuit.openedAt < cooldownMs) return true
  circuit.failures = 0
  circuit.openedAt = 0
  return false
}

/** Runs current-information research only when the caller has already opted in. */
export async function research(input: ResearchInput, deps: ResearchDependencies = {}): Promise<ResearchResult> {
  const config = { ...configuredResearch(), ...deps.config }
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const now = deps.now ?? Date.now
  const circuit = deps.circuit ?? sharedCircuit
  const prompt = buildResearchPrompt(input)

  if (config.bedrockEnabled && config.bedrockApiKey && !circuitOpen(circuit, now(), config.cooldownMs)) {
    try {
      const result = await callBedrock(prompt, config, fetchImpl)
      circuit.failures = 0
      circuit.openedAt = 0
      return { ...result, provider: 'bedrock-web-search' }
    } catch (error) {
      if (error instanceof ResearchUnavailableError) throw error
      circuit.failures += 1
      if (circuit.failures >= config.failureThreshold) circuit.openedAt = now()
    }
  }

  if (config.geminiApiKey) {
    try {
      const result = await callGemini(prompt, config, fetchImpl)
      return { ...result, provider: 'gemini-google-search' }
    } catch (error) {
      if (error instanceof ResearchUnavailableError) throw error
      try {
        const result = await callGeminiWebFallback(prompt, input.question, config, fetchImpl)
        return { ...result, provider: 'gemini-web-fallback' }
      } catch (fallbackError) {
        if (fallbackError instanceof ResearchUnavailableError) throw fallbackError
        throw new ResearchProviderUnavailableError()
      }
    }
  }
  throw new ResearchProviderUnavailableError()
}
