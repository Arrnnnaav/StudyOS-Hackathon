import assert from 'node:assert/strict'
import test from 'node:test'
import { ResearchUnavailableError } from '../../../../lib/research.ts'
import { researchErrorCode, validateResearchRequest } from './research-helpers.ts'

test('Research Mode requires a stable idempotency key before provider work', () => {
  assert.deepEqual(validateResearchRequest('What is this?', undefined), {
    ok: false,
    code: 'IDEMPOTENCY_KEY_REQUIRED',
    message: 'a valid idempotency key is required for Research Mode',
  })
  assert.deepEqual(validateResearchRequest('What is this?', 'request-1234'), { ok: true, idempotencyKey: 'request-1234' })
})

test('oversized Research Mode input is rejected before provider work', () => {
  assert.equal(validateResearchRequest('q'.repeat(1_501), 'request-1234').ok, false)
})

test('an unsourced provider result maps to INSUFFICIENT_EVIDENCE', () => {
  assert.equal(researchErrorCode(new ResearchUnavailableError()), 'INSUFFICIENT_EVIDENCE')
})
