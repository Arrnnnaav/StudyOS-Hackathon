import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb'
import type { StudentProfileInput } from '@/shared/student-profile'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT // for local development
})

export const db = DynamoDBDocumentClient.from(client)

export const TABLES = {
  USERS: 'StudyOSUsers',
  PROGRESS: 'StudyOSProgress',
  ASKS: 'StudyOSAsks',
  REVIEWS: 'StudyOSReviews',
  EVENTS: 'StudyOSEvents',
  EXTENSION_TOKENS: 'StudyOSExtensionTokens',
  PAIRING_CODES: 'StudyOSPairingCodes',
  ASK_SAFETY: 'StudyOSAskSafety',
  ORGANIZATIONS: 'StudyOSOrganizations',
} as const

// User operations
export async function createUser(user: {
  id: string
  email: string
  name: string | null
  image: string | null
  year: number
  activeTrack: string
}) {
  const now = new Date().toISOString()
  await db.send(new PutCommand({
    TableName: TABLES.USERS,
    Item: {
      PK: `USER#${user.id}`,
      SK: 'PROFILE',
      ...user,
      createdAt: now,
      lastActiveAt: now,
      GSI1PK: `EMAIL#${user.email}`,
      GSI1SK: 'PROFILE'
    }
  }))
  return user
}

export async function getUserById(userId: string) {
  const result = await db.send(new GetCommand({
    TableName: TABLES.USERS,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
  }))
  return result.Item as any
}

export type StoredStudentProfile = StudentProfileInput & {
  PK: string
  SK: 'PROFILE'
  email: string
  image: string | null
  createdAt: string
  updatedAt: string
  profileCompletedAt: string
}

export async function getStudentProfile(userId: string): Promise<StoredStudentProfile | undefined> {
  return await getUserById(userId) as StoredStudentProfile | undefined
}

export async function saveStudentProfile(
  userId: string,
  profile: StudentProfileInput,
  identity: { email: string; image: string | null },
): Promise<StoredStudentProfile> {
  const now = new Date().toISOString()
  const existing = await getStudentProfile(userId)
  const record: StoredStudentProfile = {
    PK: `USER#${userId}`,
    SK: 'PROFILE',
    ...profile,
    email: identity.email,
    image: identity.image,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    profileCompletedAt: existing?.profileCompletedAt || now,
  }
  await db.send(new PutCommand({ TableName: TABLES.USERS, Item: record }))
  return record
}

export type StudentLearningSummary = {
  points: number
  streakDays: number
  recentActivity: Array<{ kind: 'topic_completed' | 'review_completed'; topicId: string; occurredAt: string }>
}

export async function getStudentLearningSummary(userId: string): Promise<StudentLearningSummary> {
  const progress = await getUserProgress(userId)
  const activities: StudentLearningSummary['recentActivity'] = []
  let points = 0

  for (const item of progress) {
    if (item.status === 'done' && item.completedAt) {
      points += 100
      activities.push({ kind: 'topic_completed', topicId: item.topicId, occurredAt: item.completedAt })
    }
    const reviewsCompleted = Number(item.reviewsCompleted || 0)
    if (reviewsCompleted > 0 && item.updatedAt) {
      points += reviewsCompleted * 15
      activities.push({ kind: 'review_completed', topicId: item.topicId, occurredAt: item.updatedAt })
    }
  }

  activities.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  const activityDays = new Set(activities.map((activity) => activity.occurredAt.slice(0, 10)))
  let streakDays = 0
  const cursor = new Date()
  while (activityDays.has(cursor.toISOString().slice(0, 10))) {
    streakDays++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return { points, streakDays, recentActivity: activities.slice(0, 10) }
}

export async function getUserByEmail(email: string) {
  const result = await db.send(new QueryCommand({
    TableName: TABLES.USERS,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `EMAIL#${email}`,
      ':sk': 'PROFILE'
    }
  }))
  return result.Items?.[0] as any
}

export async function updateUserLastActive(userId: string) {
  await db.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    UpdateExpression: 'SET lastActiveAt = :now',
    ExpressionAttributeValues: { ':now': new Date().toISOString() }
  }))
}

export async function updateUserTrack(userId: string, track: string) {
  await db.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    UpdateExpression: 'SET activeTrack = :track',
    ExpressionAttributeValues: { ':track': track }
  }))
}

// Progress operations
export async function getUserProgress(userId: string) {
  const result = await db.send(new QueryCommand({
    TableName: TABLES.PROGRESS,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${userId}` }
  }))
  return result.Items as any[]
}

export async function getTopicProgress(userId: string, topicId: string) {
  const result = await db.send(new GetCommand({
    TableName: TABLES.PROGRESS,
    Key: { PK: `USER#${userId}`, SK: `TOPIC#${topicId}` }
  }))
  return result.Item as any
}

export async function startTopic(userId: string, topicId: string) {
  const now = new Date().toISOString()
  const existing = await getTopicProgress(userId, topicId)
  if (existing?.status === 'done') return

  await db.send(new PutCommand({
    TableName: TABLES.PROGRESS,
    Item: {
      PK: `USER#${userId}`,
      SK: `TOPIC#${topicId}`,
      topicId,
      status: 'in_progress',
      startedAt: now,
      completedAt: null,
      timeSpentMin: 0,
      resourceCompleted: false,
      questionsAsked: 0,
      helpfulAnswers: 0,
      reviewsCompleted: 0,
      updatedAt: now
    },
  }))
}

export async function completeTopic(userId: string, topicId: string) {
  const now = new Date().toISOString()
  await db.send(new UpdateCommand({
    TableName: TABLES.PROGRESS,
    Key: { PK: `USER#${userId}`, SK: `TOPIC#${topicId}` },
    UpdateExpression: 'SET #status = :done, completedAt = :now, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':done': 'done', ':now': now }
  }))
}

export async function incrementProgressTime(userId: string, topicId: string, minutes: number) {
  await db.send(new UpdateCommand({
    TableName: TABLES.PROGRESS,
    Key: { PK: `USER#${userId}`, SK: `TOPIC#${topicId}` },
    UpdateExpression: 'ADD timeSpentMin :inc SET updatedAt = :now',
    ExpressionAttributeValues: { ':inc': minutes, ':now': new Date().toISOString() }
  }))
}

export async function recordQuestionAsked(userId: string, topicId: string, helpful: boolean) {
  await db.send(new UpdateCommand({
    TableName: TABLES.PROGRESS,
    Key: { PK: `USER#${userId}`, SK: `TOPIC#${topicId}` },
    UpdateExpression: 'ADD questionsAsked :inc SET #status = if_not_exists(#status, :started), startedAt = if_not_exists(startedAt, :now), completedAt = if_not_exists(completedAt, :null), timeSpentMin = if_not_exists(timeSpentMin, :zero), resourceCompleted = if_not_exists(resourceCompleted, :false), helpfulAnswers = if_not_exists(helpfulAnswers, :zero) + :helpful, reviewsCompleted = if_not_exists(reviewsCompleted, :zero), updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':inc': 1,
      ':helpful': helpful ? 1 : 0,
      ':zero': 0,
      ':started': 'in_progress',
      ':null': null,
      ':false': false,
      ':now': new Date().toISOString()
    }
  }))
}

export async function recordReviewCompleted(userId: string, topicId: string) {
  await db.send(new UpdateCommand({
    TableName: TABLES.PROGRESS,
    Key: { PK: `USER#${userId}`, SK: `TOPIC#${topicId}` },
    UpdateExpression: 'ADD reviewsCompleted :inc SET updatedAt = :now',
    ExpressionAttributeValues: { ':inc': 1, ':now': new Date().toISOString() }
  }))
}

// Ask operations
export async function createAsk(ask: {
  id: string
  userId: string
  topicId: string | null
  domain: string
  pageTitle: string
  selectedText: string
  nearbyBefore: string
  nearbyAfter: string
  question: string
  answer: string
  model: string
  latencyMs: number
  helpful: boolean | null
  feedbackReason: string | null
  savedToReview: boolean
  createdAt: string
}) {
  await db.send(new PutCommand({
    TableName: TABLES.ASKS,
    Item: {
      PK: `USER#${ask.userId}`,
      SK: `ASK#${ask.createdAt}#${ask.id}`,
      ...ask,
      GSI1PK: `TOPIC#${ask.topicId || 'none'}`,
      GSI1SK: ask.createdAt
    }
  }))
}

export async function updateAskFeedback(askId: string, userId: string, helpful: boolean, reason?: string) {
  const now = new Date().toISOString()
  const ask = await getAskById(userId, askId)
  const sk = ask ? `ASK#${ask.createdAt}#${ask.id}` : undefined
  if (!ask || !sk) throw new Error('Ask not found')
  await db.send(new UpdateCommand({
    TableName: TABLES.ASKS,
    Key: { PK: `USER#${userId}`, SK: sk },
    UpdateExpression: 'SET helpful = :h, feedbackReason = :r, updatedAt = :now',
    ExpressionAttributeValues: { ':h': helpful, ':r': reason || null, ':now': now }
  }))
}

export async function markAskSavedToReview(askId: string, userId: string) {
  const ask = await getAskById(userId, askId)
  const sk = ask ? `ASK#${ask.createdAt}#${ask.id}` : undefined
  if (!ask || !sk) throw new Error('Ask not found')
  await db.send(new UpdateCommand({
    TableName: TABLES.ASKS,
    Key: { PK: `USER#${userId}`, SK: sk },
    UpdateExpression: 'SET savedToReview = :true',
    ExpressionAttributeValues: { ':true': true }
  }))
}

export async function getUserAsks(userId: string, limit = 50) {
  const result = await db.send(new QueryCommand({
    TableName: TABLES.ASKS,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${userId}` },
    ScanIndexForward: false,
    Limit: limit
  }))
  return result.Items as any[]
}

export async function getAskById(userId: string, askId: string) {
  const asks = await getUserAsks(userId, 100)
  return asks.find(a => a.id === askId) as any
}

/** Recent same-topic/page turns used as bounded conversational context. */
export async function getAskContext(userId: string, topicId: string | null, domain: string, limit = 2) {
  const asks = await getUserAsks(userId, 50)
  return asks
    .filter((ask) => ask.topicId === topicId && ask.domain === domain)
    .slice(0, limit)
    .reverse() as Array<{ question?: string; answer?: string }>
}

// Review operations
export async function createReview(review: {
  id: string
  userId: string
  topicId: string
  askId: string
  question: string
  answer: string
  nextReviewAt: string
  reviewCount: number
  lastRating: 'again' | 'good' | null
  status: 'pending' | 'completed' | 'dismissed'
  createdAt: string
}) {
  await db.send(new PutCommand({
    TableName: TABLES.REVIEWS,
    Item: {
      PK: `USER#${review.userId}`,
      SK: `REVIEW#${review.id}`,
      ...review,
      GSI1PK: `USER#${review.userId}`,
      GSI1SK: review.nextReviewAt
    }
  }))
}

export async function getDueReviews(userId: string, now: string) {
  const result = await db.send(new QueryCommand({
    TableName: TABLES.REVIEWS,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :now',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':now': now
    }
  }))
  return result.Items as any[]
}

/** All review cards for a learner, ordered by their next scheduled review. */
export async function getUserReviews(userId: string) {
  const result = await db.send(new QueryCommand({
    TableName: TABLES.REVIEWS,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${userId}` },
  }))
  return (result.Items ?? []).sort((a, b) =>
    String(a.nextReviewAt ?? '').localeCompare(String(b.nextReviewAt ?? '')),
  ) as any[]
}

export async function getReviewById(userId: string, reviewId: string) {
  const result = await db.send(new GetCommand({
    TableName: TABLES.REVIEWS,
    Key: { PK: `USER#${userId}`, SK: `REVIEW#${reviewId}` },
  }))
  return result.Item as any
}

export async function updateReviewRating(reviewId: string, userId: string, rating: 'again' | 'good') {
  const now = new Date().toISOString()
  const intervalDays = rating === 'again' ? 1 : 3
  const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString()

  const result = await db.send(new UpdateCommand({
    TableName: TABLES.REVIEWS,
    Key: { PK: `USER#${userId}`, SK: `REVIEW#${reviewId}` },
    // A rated card remains pending for its next interval; it is not a terminal
    // record. Marking it completed hid it from the learner's future queue.
    UpdateExpression: 'SET reviewCount = reviewCount + :inc, lastRating = :rating, nextReviewAt = :next, updatedAt = :now, GSI1SK = :next',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':rating': rating,
      ':next': nextReviewAt,
      ':now': now
    },
    ReturnValues: 'ALL_NEW',
  }))
  return result.Attributes as { nextReviewAt?: string; reviewCount?: number; lastRating?: 'again' | 'good' } | undefined
}

// Extension token operations
export async function createExtensionToken(token: string, userId: string, expiresAt: string) {
  await db.send(new PutCommand({
    TableName: TABLES.EXTENSION_TOKENS,
    Item: {
      PK: `TOKEN#${token}`,
      SK: 'META',
      userId,
      expiresAt,
      createdAt: new Date().toISOString()
    }
  }))
}

export async function getExtensionToken(token: string) {
  const result = await db.send(new GetCommand({
    TableName: TABLES.EXTENSION_TOKENS,
    Key: { PK: `TOKEN#${token}`, SK: 'META' }
  }))
  return result.Item as any
}

export async function deleteExtensionToken(token: string) {
  await db.send(new DeleteCommand({
    TableName: TABLES.EXTENSION_TOKENS,
    Key: { PK: `TOKEN#${token}`, SK: 'META' }
  }))
}

// Pairing code operations
export async function createPairingCode(code: string, userId: string, expiresAt: string) {
  await db.send(new PutCommand({
    TableName: TABLES.PAIRING_CODES,
    Item: {
      PK: `PAIR#${code}`,
      SK: 'META',
      userId,
      expiresAt,
      createdAt: new Date().toISOString()
    }
  }))
}

export async function consumePairingCode(code: string) {
  try {
    const result = await db.send(new DeleteCommand({
      TableName: TABLES.PAIRING_CODES,
      Key: { PK: `PAIR#${code}`, SK: 'META' },
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_OLD',
    }))
    return result.Attributes as any
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') return undefined
    throw error
  }
}

// Event tracking
export async function trackEvent(event: {
  eventId: string
  eventName: string
  timestamp: string
  userId: string
  sessionId: string
  topicId: string | null
  domain: string | null
  properties: Record<string, unknown>
}) {
  const dateBucket = event.timestamp.split('T')[0]
  await db.send(new PutCommand({
    TableName: TABLES.EVENTS,
    Item: {
      PK: `DAY#${dateBucket}`,
      SK: `${event.timestamp}#${event.eventId}`,
      ...event
    }
  }))
}

export async function getEventsByDateRange(startDate: string, endDate: string) {
  const items: any[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const bucket = d.toISOString().split('T')[0]
    const result = await db.send(new QueryCommand({
      TableName: TABLES.EVENTS,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `DAY#${bucket}` }
    }))
    items.push(...(result.Items || []))
  }
  return items
}

export async function getEventsByUser(userId: string, limit = 100) {
  // Scan events for user (inefficient at scale, OK for hackathon)
  const result = await db.send(new ScanCommand({
    TableName: TABLES.EVENTS,
    FilterExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    Limit: limit
  }))
  return result.Items as any[]
}

// ---------- Custom topics (Tier-2) ----------
// Stored in the users table under PK=USER#<id>, SK=CUSTOMTOPIC#<id>.
export async function createCustomTopic(topic: Record<string, unknown>) {
  const now = new Date().toISOString()
  await db.send(new PutCommand({
    TableName: TABLES.USERS,
    Item: {
      PK: `USER#${topic.userId}`,
      SK: `CUSTOMTOPIC#${topic.id}`,
      ...topic,
      createdAt: now,
      GSI1PK: `USER#${topic.userId}`,
      GSI1SK: now
    }
  }))
  return topic
}

export async function getCustomTopics(userId: string) {
  const result = await db.send(new QueryCommand({
    TableName: TABLES.USERS,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':prefix': 'CUSTOMTOPIC#'
    }
  }))
  return result.Items as any[]
}

export async function deleteCustomTopic(userId: string, topicId: string) {
  await db.send(new DeleteCommand({
    TableName: TABLES.USERS,
    Key: { PK: `USER#${userId}`, SK: `CUSTOMTOPIC#${topicId}` }
  }))
}

// ---------- Anonymous device → user adoption (Tier-1) ----------
// Stored in users table under PK=DEVICE#<id>, SK=META, storing userId + created.
export async function recordDeviceUser(deviceId: string, userId: string) {
  await db.send(new PutCommand({
    TableName: TABLES.USERS,
    Item: {
      PK: `DEVICE#${deviceId}`,
      SK: 'META',
      userId,
      createdAt: new Date().toISOString()
    }
  }))
}

export async function getDeviceUser(deviceId: string) {
  const result = await db.send(new GetCommand({
    TableName: TABLES.USERS,
    Key: { PK: `DEVICE#${deviceId}`, SK: 'META' }
  }))
  return result.Item as any
}

/** Move anonymous event/ask rows under anon-<deviceId> onto the real account. */
export async function adoptAnonymousData(deviceId: string, userId: string) {
  const anonId = `anon-${deviceId}`
  // Reassociate asks
  const asks = await db.send(new QueryCommand({
    TableName: TABLES.ASKS,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${anonId}` }
  }))
  for (const ask of asks.Items || []) {
    await db.send(new PutCommand({
      TableName: TABLES.ASKS,
      Item: {
        ...ask,
        PK: `USER#${userId}`,
        SK: ask.SK,
        GSI1PK: `TOPIC#${ask.topicId || 'none'}`,
        GSI1SK: ask.createdAt || new Date().toISOString()
      }
    }))
    await db.send(new DeleteCommand({
      TableName: TABLES.ASKS,
      Key: { PK: `USER#${anonId}`, SK: ask.SK }
    }))
  }
  // Reassociate progress
  const progress = await db.send(new QueryCommand({
    TableName: TABLES.PROGRESS,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${anonId}` }
  }))
  for (const row of progress.Items || []) {
    await db.send(new PutCommand({
      TableName: TABLES.PROGRESS,
      Item: { ...row, PK: `USER#${userId}` }
    }))
    await db.send(new DeleteCommand({
      TableName: TABLES.PROGRESS,
      Key: { PK: `USER#${anonId}`, SK: row.SK }
    }))
  }
}
