import { parseIdempotencyKey } from '../../../../lib/ask-safety.ts'
import { ResearchUnavailableError } from '../../../../lib/research.ts'

export const MAX_RESEARCH_QUESTION = 1_500

export type ResearchValidation =
  | { ok: true; idempotencyKey: string }
  | { ok: false; code: 'IDEMPOTENCY_KEY_REQUIRED' | 'TOO_LONG'; message: string }

export function validateResearchRequest(question: string, idempotencyKey: unknown): ResearchValidation {
  if (question.length > MAX_RESEARCH_QUESTION) return { ok: false, code: 'TOO_LONG', message: 'research question too long' }
  const key = parseIdempotencyKey(idempotencyKey)
  if (!key) return { ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'a valid idempotency key is required for Research Mode' }
  return { ok: true, idempotencyKey: key }
}

export function researchErrorCode(error: unknown): 'INSUFFICIENT_EVIDENCE' | 'PROVIDER_UNAVAILABLE' {
  return error instanceof ResearchUnavailableError ? 'INSUFFICIENT_EVIDENCE' : 'PROVIDER_UNAVAILABLE'
}
