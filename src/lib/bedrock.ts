/**
 * lib/bedrock.ts — shared Amazon Bedrock invoke helper.
 * Wraps InvokeModelCommand with a Claude-style conversation payload and
 * returns the assistant text. Model id is configurable via BEDROCK_MODEL_ID.
 * Used by /api/ask, /api/coverage, and (optionally) the spatial ask route.
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

export const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0'

export class BedrockUnavailableError extends Error {
  constructor(message = 'Bedrock is not available (check credentials/model access).') {
    super(message)
    this.name = 'BedrockUnavailableError'
  }
}

/** True when Bedrock is likely configured (has credentials). */
export function bedrockConfigured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
}

/**
 * Invoke a Bedrock model with a conversation (Claude-style payload).
 * Returns the assistant's text. Throws on any error so callers can fall back.
 */
export async function invokeModel(opts: {
  system: string
  user: string
  maxTokens?: number
  temperature?: number
}): Promise<string> {
  const { system, user, maxTokens = 1200, temperature = 0.3 } = opts
  const response = await client.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    }),
  )
  const body = JSON.parse(new TextDecoder().decode(response.body))
  const text = body?.content?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Unexpected Bedrock response shape')
  }
  return text
}

/** Parse a JSON object out of a model response (tolerates markdown fences). */
export function extractJson<T>(text: string): T | null {
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