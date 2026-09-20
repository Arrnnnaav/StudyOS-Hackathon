process.env.DYNAMODB_ENDPOINT ||= 'http://localhost:8001'
process.env.AWS_REGION ||= 'us-east-1'
process.env.AWS_ACCESS_KEY_ID ||= 'dummy'
process.env.AWS_SECRET_ACCESS_KEY ||= 'dummy'

import assert from 'node:assert/strict'
import test from 'node:test'
import { takeDailyAskQuota, takeDailyCoverageQuota, takeDailyResearchQuota, takeDailySpatialQuota } from './ask-safety.ts'

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

test('research has its own five-request daily quota', async () => {
  const userId = `research-quota-${Date.now()}`
  await takeDailyAskQuota(userId, 1)
  await takeDailySpatialQuota(userId, 1)
  await takeDailyCoverageQuota(userId, 1)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await takeDailyResearchQuota(userId, 5)).allowed, true)
  }
  assert.equal((await takeDailyResearchQuota(userId, 5)).allowed, false)
})
