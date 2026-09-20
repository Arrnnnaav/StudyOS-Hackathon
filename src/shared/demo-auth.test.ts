import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PUBLIC_DEMO_ACCESS,
  PUBLIC_STUDENT_DEMO_ACCESS,
  resolvePublicDemoIdentity,
  resolvePublicDemoMaster,
} from './demo-auth.ts'

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

test('student demo access creates a non-admin learner identity', () => {
  assert.deepEqual(
    resolvePublicDemoIdentity({ access: PUBLIC_STUDENT_DEMO_ACCESS }, 'owner@studyos.dev'),
    {
      id: 'public-demo-student',
      name: 'StudyOS live demo learner',
      email: 'demo.student@studyos.local',
    },
  )
})
