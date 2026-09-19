import assert from 'node:assert/strict'
import test from 'node:test'
import { destinationForSignedInUser } from './student-destination.ts'

test('sends a new student to onboarding before the dashboard', () => {
  assert.equal(destinationForSignedInUser({ actorKind: 'student', profileComplete: false }), '/auth/onboarding')
})

test('sends a completed student to their learning dashboard', () => {
  assert.equal(destinationForSignedInUser({ actorKind: 'student', profileComplete: true }), '/dashboard/today')
})

test('keeps admins out of student onboarding', () => {
  assert.equal(destinationForSignedInUser({ actorKind: 'organization_admin', profileComplete: false }), '/admin/organization')
  assert.equal(destinationForSignedInUser({ actorKind: 'master_admin', profileComplete: false }), '/admin/master')
})
