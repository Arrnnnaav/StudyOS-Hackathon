import assert from 'node:assert/strict'
import test from 'node:test'
import { isProfileComplete, validateStudentProfileInput } from './student-profile.ts'

const validInput = {
  name: 'Arnav Khande',
  phone: '9876543210',
  college: 'Example Institute of Technology',
  branch: 'Computer Science',
  year: 2,
  activeTrack: 'dsa-foundations',
}

test('accepts a complete student profile without optional links', () => {
  const result = validateStudentProfileInput(validInput)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.value, validInput)
    assert.equal(isProfileComplete({ ...result.value, profileCompletedAt: '2026-09-19T00:00:00.000Z' }), true)
  }
})

test('rejects a phone value that is not exactly ten digits', () => {
  const result = validateStudentProfileInput({ ...validInput, phone: '98765 43210' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /10 digits/)
})

test('rejects a malformed optional public link', () => {
  const result = validateStudentProfileInput({ ...validInput, github: 'github.com/arnav' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /GitHub URL/)
})

test('treats an Auth.js-only user row as an incomplete student profile', () => {
  assert.equal(isProfileComplete(undefined), false)
  assert.equal(isProfileComplete({ ...validInput }), false)
})
