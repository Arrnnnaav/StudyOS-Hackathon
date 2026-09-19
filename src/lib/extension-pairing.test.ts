import assert from 'node:assert/strict'
import test from 'node:test'
import { generatePairingCode } from './extension-pairing.ts'
import { consumePairingCode, createPairingCode } from './db.ts'

test('generates a six-character code from a cryptographically secure source', () => {
  const code = generatePairingCode()
  assert.match(code, /^[A-Z0-9]{6}$/)
})

test('allows exactly one concurrent consumer of a pairing code', async () => {
  const code = generatePairingCode()
  await createPairingCode(code, 'student-pairing-test', new Date(Date.now() + 60_000).toISOString())
  const [first, second] = await Promise.all([consumePairingCode(code), consumePairingCode(code)])
  assert.equal([first, second].filter(Boolean).length, 1)
})
