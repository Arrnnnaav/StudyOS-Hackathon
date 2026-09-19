process.env.DYNAMODB_ENDPOINT ||= 'http://localhost:8001'
process.env.AWS_REGION ||= 'us-east-1'
process.env.AWS_ACCESS_KEY_ID ||= 'dummy'
process.env.AWS_SECRET_ACCESS_KEY ||= 'dummy'

import assert from 'node:assert/strict'
import test from 'node:test'
import { takeDailyCoverageQuota, takeDailySpatialQuota } from './ask-safety.ts'

test('spatial requests reject after their own daily quota', async () => {
  const userId = `spatial-quota-${Date.now()}`
  assert.equal((await takeDailySpatialQuota(userId, 1)).allowed, true)
  assert.equal((await takeDailySpatialQuota(userId, 1)).allowed, false)
})

test('coverage quota is independent from the spatial quota', async () => {
  const userId = `coverage-quota-${Date.now()}`
  await takeDailySpatialQuota(userId, 1)
  assert.equal((await takeDailyCoverageQuota(userId, 1)).allowed, true)
})
