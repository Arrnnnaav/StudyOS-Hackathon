import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewInput } from './review-input.ts'

test('builds a review from a stored spatial ask that has no curriculum topic', () => {
  const input = reviewInput(
    { askId: 'ask-1' },
    { topicId: null, question: 'What is an array?', answer: 'An indexed collection.' },
  )

  assert.deepEqual(input, {
    askId: 'ask-1',
    topicId: null,
    question: 'What is an array?',
    answer: 'An indexed collection.',
  })
})

test('rejects a save when no stored answer is available', () => {
  assert.equal(reviewInput({ askId: 'ask-1' }, null), null)
})
