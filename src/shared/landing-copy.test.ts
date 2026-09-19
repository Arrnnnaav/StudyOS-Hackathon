import test from 'node:test'
import assert from 'node:assert/strict'
import { landingDescription } from './landing-copy.ts'

test('landing description preserves the word boundary around the emphasized phrase', () => {
  assert.equal(
    `${landingDescription.before} ${landingDescription.emphasis}${landingDescription.after}`,
    'You have YouTube, LeetCode, GitHub, and AI. But none of them tells you what to learn today — and when you get stuck, that question disappears.',
  )
})
