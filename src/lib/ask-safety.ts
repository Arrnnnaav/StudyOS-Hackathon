import { createHash } from 'node:crypto'
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, TABLES } from './db.ts'

const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60

export type StoredAskResponse = {
  askId: string
  answer: string
  grounding: Array<{ type: string; excerpt: string }>
  insufficientContext: boolean
  latencyMs: number
  model: string
  contextUsed: number
}

type IdempotencyItem = {
  requestHash?: string
  status?: 'processing' | 'completed'
  response?: object
  expiresAt?: number
}

export type IdempotencyResult<T extends object = StoredAskResponse> =
  | { state: 'reserved' }
  | { state: 'cached'; response: T }
  | { state: 'pending' }
  | { state: 'conflict' }

export function parseIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const key = value.trim()
  return /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? key : null
}

/** Stable request identity excluding auth tokens and other ephemeral metadata. */
export function askRequestHash(input: {
  topicId: string | null
  question: string
  context: { selected_text: string; nearby_before?: string; nearby_after?: string; domain?: string; page_title?: string }
  level?: string
  research?: boolean
}): string {
  const canonical = JSON.stringify({
    topicId: input.topicId,
    question: input.question,
    selected: input.context.selected_text,
    before: input.context.nearby_before ?? '',
    after: input.context.nearby_after ?? '',
    domain: input.context.domain ?? '',
    page: input.context.page_title ?? '',
    level: input.level ?? 'student',
    research: input.research === true,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

function idempotencyKey(userId: string, key: string) {
  return { PK: `USER#${userId}`, SK: `IDEMPOTENCY#${key}` }
}

export async function reserveAsk<T extends object = StoredAskResponse>(userId: string, key: string, requestHash: string): Promise<IdempotencyResult<T>> {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + Number(process.env.ASK_IDEMPOTENCY_TTL_SECONDS || DEFAULT_IDEMPOTENCY_TTL_SECONDS)
  const itemKey = idempotencyKey(userId, key)
  try {
    await db.send(new PutCommand({
      TableName: TABLES.ASK_SAFETY,
      Item: { ...itemKey, requestHash, status: 'processing', createdAt: new Date().toISOString(), expiresAt },
      ConditionExpression: 'attribute_not_exists(PK)',
    }))
    return { state: 'reserved' }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'ConditionalCheckFailedException') throw error
    const existing = await getReservedAsk(userId, key)
    if (!existing || (existing.expiresAt && existing.expiresAt <= now)) {
      await db.send(new DeleteCommand({ TableName: TABLES.ASK_SAFETY, Key: itemKey }))
      return reserveAsk(userId, key, requestHash)
    }
    if (existing.requestHash !== requestHash) return { state: 'conflict' }
    if (existing.status === 'completed' && existing.response) return { state: 'cached', response: existing.response as T }
    return { state: 'pending' }
  }
}

export async function getReservedAsk(userId: string, key: string): Promise<IdempotencyItem | undefined> {
  const result = await db.send(new GetCommand({ TableName: TABLES.ASK_SAFETY, Key: idempotencyKey(userId, key) }))
  return result.Item as IdempotencyItem | undefined
}

/** Wait briefly for a concurrent matching request instead of issuing another model call. */
export async function waitForAskResult<T extends object = StoredAskResponse>(userId: string, key: string, maxWaitMs = 12_000): Promise<T | null> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const item = await getReservedAsk(userId, key)
    if (item?.status === 'completed' && item.response) return item.response as T
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return null
}

export async function completeAskReservation<T extends object = StoredAskResponse>(userId: string, key: string, response: T) {
  await db.send(new UpdateCommand({
    TableName: TABLES.ASK_SAFETY,
    Key: idempotencyKey(userId, key),
    UpdateExpression: 'SET #status = :completed, #response = :response, completedAt = :now',
    ExpressionAttributeNames: { '#status': 'status', '#response': 'response' },
    ExpressionAttributeValues: { ':completed': 'completed', ':response': response, ':now': new Date().toISOString() },
  }))
}

export async function abandonAskReservation(userId: string, key: string) {
  await db.send(new DeleteCommand({ TableName: TABLES.ASK_SAFETY, Key: idempotencyKey(userId, key) }))
}

export async function takeDailyAskQuota(userId: string, limit = Number(process.env.ASK_DAILY_LIMIT || 20)) {
  const day = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(`${day}T00:00:00.000Z`).getTime() + 86_400_000
  const result = await db.send(new UpdateCommand({
    TableName: TABLES.ASK_SAFETY,
    Key: { PK: `RATE#${userId}#${day}`, SK: 'ASK' },
    UpdateExpression: 'ADD #count :one SET expiresAt = :expiresAt, updatedAt = :now',
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':one': 1, ':expiresAt': Math.floor(tomorrow / 1000), ':now': new Date().toISOString() },
    ReturnValues: 'UPDATED_NEW',
  }))
  const count = Number(result.Attributes?.count ?? 0)
  return { allowed: count <= limit, count, limit, retryAfterSeconds: Math.max(1, Math.ceil((tomorrow - Date.now()) / 1000)) }
}

export function takeDailySpatialQuota(userId: string, limit = Number(process.env.SPATIAL_DAILY_LIMIT || 20)) {
  return takeDailyAskQuota(`spatial:${userId}`, limit)
}

export function takeDailyCoverageQuota(userId: string, limit = Number(process.env.COVERAGE_DAILY_LIMIT || 10)) {
  return takeDailyAskQuota(`coverage:${userId}`, limit)
}

export function takeDailyResearchQuota(userId: string, limit = Number(process.env.RESEARCH_DAILY_LIMIT || 5)) {
  return takeDailyAskQuota(`research:${userId}`, limit)
}
