export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
export const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || 'openai/gpt-oss-20b'

export type AiRequest = {
  system: string
  user: string
  maxTokens?: number
  temperature?: number
}

export type AiProvider = 'gemini' | 'nvidia-nim'
export type AiResponse = { text: string; model: string; provider: AiProvider }

export type AiConfig = {
  apiKey: string
  model: string
  nimApiKey: string
  nimModel: string
  timeoutMs: number
  failureThreshold: number
  cooldownMs: number
}

export type AiCircuit = { failures: number; openedAt: number }

export type AiDependencies = {
  fetch?: typeof globalThis.fetch
  now?: () => number
  config?: Partial<AiConfig>
  circuit?: AiCircuit
  nimCircuit?: AiCircuit
  onProvider?: (provider: AiProvider, model: string) => void
}

export class AIProviderUnavailableError extends Error {
  constructor(message = 'The AI service is temporarily unavailable. Please retry.') {
    super(message)
    this.name = 'AIProviderUnavailableError'
  }
}

class TransientProviderError extends Error {}

const sharedCircuit: AiCircuit = { failures: 0, openedAt: 0 }
const sharedNimCircuit: AiCircuit = { failures: 0, openedAt: 0 }

function configured(): AiConfig {
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: GEMINI_MODEL,
    nimApiKey: process.env.NVIDIA_NIM_API_KEY || '',
    nimModel: NVIDIA_NIM_MODEL,
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 30_000),
    failureThreshold: Number(process.env.GEMINI_FAILURE_THRESHOLD || 3),
    cooldownMs: Number(process.env.GEMINI_COOLDOWN_MS || 30_000),
  }
}

function circuitIsOpen(circuit: AiCircuit, now: number, cooldownMs: number): boolean {
  if (!circuit.openedAt) return false
  if (now - circuit.openedAt < cooldownMs) return true
  circuit.failures = 0
  circuit.openedAt = 0
  return false
}

function responseText(body: unknown, trim = true): string {
  if (!body || typeof body !== 'object') return ''
  const candidate = Array.isArray((body as { candidates?: unknown }).candidates)
    ? (body as { candidates: unknown[] }).candidates[0]
    : undefined
  if (!candidate || typeof candidate !== 'object') return ''
  const content = (candidate as { content?: unknown }).content
  if (!content || typeof content !== 'object') return ''
  const parts = (content as { parts?: unknown }).parts
  if (!Array.isArray(parts)) return ''
  const text = parts.flatMap((part) => (
    part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
      ? [(part as { text: string }).text]
      : []
  )).join('')
  return trim ? text.trim() : text
}

function providerEventStatus(body: unknown): 'continue' | 'complete' | 'reject' {
  if (!body || typeof body !== 'object') return 'reject'
  if ((body as { error?: unknown }).error || (body as { promptFeedback?: unknown }).promptFeedback) return 'reject'
  const candidate = Array.isArray((body as { candidates?: unknown }).candidates)
    ? (body as { candidates: unknown[] }).candidates[0]
    : undefined
  if (!candidate || typeof candidate !== 'object') return 'continue'
  const finishReason = (candidate as { finishReason?: unknown }).finishReason
  if (typeof finishReason !== 'string') return 'continue'
  return finishReason === 'STOP' ? 'complete' : 'reject'
}

function requestBody(request: AiRequest) {
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts: [{ text: request.user }] }],
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? 1_000,
      temperature: request.temperature ?? 0.3,
    },
  }
}

function nimRequestBody(request: AiRequest, model: string, stream: boolean) {
  return {
    model,
    messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }],
    max_tokens: request.maxTokens ?? 1_000,
    temperature: request.temperature ?? 0.3,
    stream,
  }
}

function nimResponseText(body: unknown, trim = true): string {
  if (!body || typeof body !== 'object') return ''
  const choice = Array.isArray((body as { choices?: unknown }).choices)
    ? (body as { choices: unknown[] }).choices[0]
    : undefined
  if (!choice || typeof choice !== 'object') return ''
  const message = (choice as { message?: unknown; delta?: unknown }).message ?? (choice as { delta?: unknown }).delta
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  if (typeof content !== 'string') return ''
  return trim ? content.trim() : content
}

function nimEventStatus(body: unknown): 'continue' | 'complete' | 'reject' {
  if (!body || typeof body !== 'object' || (body as { error?: unknown }).error) return 'reject'
  const choice = Array.isArray((body as { choices?: unknown }).choices)
    ? (body as { choices: unknown[] }).choices[0]
    : undefined
  if (!choice || typeof choice !== 'object') return 'continue'
  const finishReason = (choice as { finish_reason?: unknown }).finish_reason
  if (finishReason === undefined || finishReason === null) return 'continue'
  return finishReason === 'stop' ? 'complete' : 'reject'
}

async function callGemini(request: AiRequest, config: AiConfig, fetchImpl: typeof globalThis.fetch): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'x-goog-api-key': config.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify(requestBody(request)),
        signal: AbortSignal.timeout(config.timeoutMs),
      })
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt === 0) continue
        throw new AIProviderUnavailableError()
      }
      const text = responseText(await response.json())
      if (!text) throw new AIProviderUnavailableError()
      return text
    } catch (error) {
      if (error instanceof AIProviderUnavailableError) throw error
      if (attempt === 0) continue
      throw new TransientProviderError()
    }
  }
  throw new AIProviderUnavailableError()
}

async function callNim(request: AiRequest, config: AiConfig, fetchImpl: typeof globalThis.fetch): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${config.nimApiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(nimRequestBody(request, config.nimModel, false)),
        signal: AbortSignal.timeout(config.timeoutMs),
      })
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt === 0) continue
        throw new AIProviderUnavailableError()
      }
      const text = nimResponseText(await response.json())
      if (!text) throw new AIProviderUnavailableError()
      return text
    } catch (error) {
      if (error instanceof AIProviderUnavailableError) throw error
      if (attempt === 0) continue
      throw new TransientProviderError()
    }
  }
  throw new AIProviderUnavailableError()
}

function recordFailure(circuit: AiCircuit, now: number, failureThreshold: number): void {
  circuit.failures += 1
  if (circuit.failures >= failureThreshold) circuit.openedAt = now
}

function recordSuccess(circuit: AiCircuit): void {
  circuit.failures = 0
  circuit.openedAt = 0
}

/** Generate a bounded answer through the configured server-only provider chain. */
export async function generateText(request: AiRequest, deps: AiDependencies = {}): Promise<AiResponse> {
  const config = { ...configured(), ...deps.config }
  const now = deps.now ?? Date.now
  const circuit = deps.circuit ?? sharedCircuit
  const nimCircuit = deps.nimCircuit ?? sharedNimCircuit
  const fetchImpl = deps.fetch ?? globalThis.fetch
  if (config.apiKey && !circuitIsOpen(circuit, now(), config.cooldownMs)) {
    try {
      const text = await callGemini(request, config, fetchImpl)
      recordSuccess(circuit)
      deps.onProvider?.('gemini', config.model)
      return { text, model: config.model, provider: 'gemini' }
    } catch {
      recordFailure(circuit, now(), config.failureThreshold)
    }
  }
  if (config.nimApiKey && !circuitIsOpen(nimCircuit, now(), config.cooldownMs)) {
    try {
      const text = await callNim(request, config, fetchImpl)
      recordSuccess(nimCircuit)
      deps.onProvider?.('nvidia-nim', config.nimModel)
      return { text, model: config.nimModel, provider: 'nvidia-nim' }
    } catch {
      recordFailure(nimCircuit, now(), config.failureThreshold)
    }
  }
  throw new AIProviderUnavailableError()
}

async function* readSse(response: Response, eventText: (body: unknown, trim?: boolean) => string, eventStatus: (body: unknown) => 'continue' | 'complete' | 'reject'): AsyncGenerator<string> {
  if (!response.ok || !response.body) throw new AIProviderUnavailableError()
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let yielded = false
    let completed = false
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const payload = event.split('\n').find((line) => line.startsWith('data: '))?.slice(6)
        if (!payload) continue
        if (payload === '[DONE]') {
          if (!completed) throw new AIProviderUnavailableError()
          continue
        }
        let parsed: unknown
        try { parsed = JSON.parse(payload) } catch { throw new AIProviderUnavailableError() }
        const status = eventStatus(parsed)
        if (status === 'reject') throw new AIProviderUnavailableError()
        if (status === 'complete') completed = true
        const text = eventText(parsed, false)
        if (text) {
          yielded = true
          yield text
        }
      }
      if (done) break
    }
    if (!yielded || !completed) throw new AIProviderUnavailableError()
}

async function* streamGemini(request: AiRequest, config: AiConfig, fetchImpl: typeof globalThis.fetch): AsyncGenerator<string> {
  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': config.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(requestBody(request)),
      signal: AbortSignal.timeout(config.timeoutMs),
    },
  )
  yield* readSse(response, responseText, providerEventStatus)
}

async function* streamNim(request: AiRequest, config: AiConfig, fetchImpl: typeof globalThis.fetch): AsyncGenerator<string> {
  const response = await fetchImpl('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.nimApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(nimRequestBody(request, config.nimModel, true)),
    signal: AbortSignal.timeout(config.timeoutMs),
  })
  yield* readSse(response, nimResponseText, nimEventStatus)
}

/** Stream answer deltas from Gemini, then server-side NVIDIA NIM before any text is emitted. */
export async function* streamText(request: AiRequest, deps: AiDependencies = {}): AsyncGenerator<string> {
  const config = { ...configured(), ...deps.config }
  const now = deps.now ?? Date.now
  const circuit = deps.circuit ?? sharedCircuit
  const nimCircuit = deps.nimCircuit ?? sharedNimCircuit
  const fetchImpl = deps.fetch ?? globalThis.fetch
  let emitted = false
  if (config.apiKey && !circuitIsOpen(circuit, now(), config.cooldownMs)) {
    try {
      deps.onProvider?.('gemini', config.model)
      for await (const chunk of streamGemini(request, config, fetchImpl)) {
        emitted = true
        yield chunk
      }
      recordSuccess(circuit)
      return
    } catch {
      recordFailure(circuit, now(), config.failureThreshold)
      if (emitted) throw new AIProviderUnavailableError()
    }
  }
  if (config.nimApiKey && !circuitIsOpen(nimCircuit, now(), config.cooldownMs)) {
    try {
      deps.onProvider?.('nvidia-nim', config.nimModel)
      for await (const chunk of streamNim(request, config, fetchImpl)) yield chunk
      recordSuccess(nimCircuit)
      return
    } catch {
      recordFailure(nimCircuit, now(), config.failureThreshold)
    }
  }
  throw new AIProviderUnavailableError()
}

export function parseJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T
  } catch {
    return null
  }
}
