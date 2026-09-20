import test from 'node:test'
import assert from 'node:assert/strict'
import { PUBLIC_DEMO_ACCESS, resolvePublicDemoMaster } from './demo-auth.ts'

test('public demo access creates the configured master identity', () => {
  assert.deepEqual(
    resolvePublicDemoMaster({ access: PUBLIC_DEMO_ACCESS }, 'owner@studyos.dev'),
    { id: 'public-demo-master', name: 'StudyOS live demo administrator', email: 'owner@studyos.dev' },
  )
})

test('public demo access rejects an invalid access value or missing master email', () => {
  assert.equal(resolvePublicDemoMaster({ access: 'anything-else' }, 'owner@studyos.dev'), null)
  assert.equal(resolvePublicDemoMaster({ access: PUBLIC_DEMO_ACCESS }, ''), null)
})
