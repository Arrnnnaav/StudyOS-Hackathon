const MAX_QUESTION_CHARS = 1_500
const MAX_SELECTED_CHARS = 800
const MAX_NEARBY_CHARS = 600
const MAX_SOURCES = 10

export type ResearchSource = { id: string; title: string; url: string; cited: true }
export type ResearchResult = {
  answer: string
  sources: ResearchSource[]
  cited: string[]
  provider: 'bedrock-web-search' | 'groq-compound'
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
  groqApiKey: string
  groqModel: string
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
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_RESEARCH_MODEL || 'groq/compound',
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

function groqMessage(body: Record<string, unknown>): { answer: string; citations: unknown } {
  const choice = Array.isArray(body.choices) ? body.choices[0] : undefined
  const message = choice && typeof choice === 'object' ? (choice as { message?: unknown }).message : undefined
  if (!message || typeof message !== 'object') return { answer: '', citations: [] }
  const record = message as { content?: unknown; citations?: unknown }
  return { answer: typeof record.content === 'string' ? record.content.trim() : '', citations: record.citations ?? [] }
}

async function requestJson(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if (response.ok) {
        const body = await response.json()
        if (body && typeof body === 'object') return body as Record<string, unknown>
        throw new ProviderError(false)
      }
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      if (!retryable || attempt === 1) throw new ProviderError(retryable)
    } catch (error) {
      if (error instanceof ProviderError) {
        if (!error.retryable || attempt === 1) throw error
      } else if (attempt === 1) {
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
  }, config.timeoutMs)
  const answer = responseText(body)
  const sources = normalizeSources(bedrockAnnotations(body))
  if (!answer || sources.length === 0) throw new ResearchUnavailableError()
  return { answer, sources, cited: sources.map((source) => source.url) }
}

async function callGroq(prompt: string, config: ResearchConfig, fetchImpl: typeof fetch): Promise<Omit<ResearchResult, 'provider'>> {
  const body = await requestJson(fetchImpl, 'https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.groqApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.groqModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1_200,
      citation_options: { enabled: true },
      search_settings: { enabled: true },
    }),
  }, config.timeoutMs)
  const { answer, citations } = groqMessage(body)
  const sources = normalizeSources(citations)
  if (!answer || sources.length === 0) throw new ResearchUnavailableError()
  return { answer, sources, cited: sources.map((source) => source.url) }
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
    } catch {
      circuit.failures += 1
      if (circuit.failures >= config.failureThreshold) circuit.openedAt = now()
    }
  }

  if (config.groqApiKey) {
    try {
      const result = await callGroq(prompt, config, fetchImpl)
      return { ...result, provider: 'groq-compound' }
    } catch {
      // An unsourced Groq answer must never become a research result.
    }
  }
  throw new ResearchUnavailableError()
}
