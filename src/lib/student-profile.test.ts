process.env.DYNAMODB_ENDPOINT ||= 'http://localhost:8001'
process.env.AWS_REGION ||= 'us-east-1'
process.env.AWS_ACCESS_KEY_ID ||= 'dummy'
process.env.AWS_SECRET_ACCESS_KEY ||= 'dummy'

import assert from 'node:assert/strict'
import test from 'node:test'
import { completeTopic, getStudentLearningSummary, getStudentProfile, recordReviewCompleted, saveStudentProfile } from './db.ts'

test('saves a canonical PROFILE row separately from an Auth.js user record', async () => {
  const userId = `student-profile-${Date.now()}`
  await saveStudentProfile(userId, {
    name: 'Student One',
    phone: '9876543210',
    college: 'Example Institute of Technology',
    branch: 'Computer Science',
    year: 2,
    activeTrack: 'dsa-foundations',
    github: 'https://github.com/student-one',
  }, {
    email: 'student-one@example.com',
    image: null,
  })

  const profile = await getStudentProfile(userId)
  assert.equal(profile?.PK, `USER#${userId}`)
  assert.equal(profile?.SK, 'PROFILE')
  assert.equal(profile?.email, 'student-one@example.com')
  assert.equal(profile?.phone, '9876543210')
  assert.equal(profile?.profileCompletedAt !== undefined, true)
})

test('derives points from completed topics and completed reviews only', async () => {
  const userId = `student-summary-${Date.now()}`
  await completeTopic(userId, 'arrays')
  await recordReviewCompleted(userId, 'arrays')

  const summary = await getStudentLearningSummary(userId)
  assert.equal(summary.points, 115)
  assert.equal(summary.streakDays, 1)
  assert.equal(summary.recentActivity[0]?.kind, 'review_completed')
})
