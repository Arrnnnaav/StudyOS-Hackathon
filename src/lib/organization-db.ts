import { randomBytes, randomUUID } from 'node:crypto'
import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { db, TABLES } from './db.ts'

export type OrganizationMemberRole = 'organization_admin' | 'student'
export type OrganizationTopicStatus = 'draft' | 'published' | 'unpublished'
export type OrganizationTopicDeliveryMode = 'library' | 'assigned'

export type Organization = { id: string; name: string; createdBy: string; createdAt: string }
export type OrganizationMembership = { organizationId: string; userId: string; role: OrganizationMemberRole; joinedAt: string }
export type OrganizationTopic = {
  id: string
  organizationId: string
  title: string
  description: string
  objectives: string[]
  estimatedMinutes: number
  resources: Array<{ title: string; url: string; kind: 'watch' | 'read' | 'practice' }>
  deliveryMode: OrganizationTopicDeliveryMode
  status: OrganizationTopicStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

const nowIso = () => new Date().toISOString()
const nowSeconds = () => Math.floor(Date.now() / 1000)
const expiresAt = (minutes: number) => nowSeconds() + minutes * 60
const token = () => randomBytes(24).toString('base64url')
const joinCode = () => randomBytes(4).toString('hex').toUpperCase()

export async function createOrganization(input: { id?: string; name: string; createdBy: string }): Promise<Organization> {
  const organization: Organization = { id: input.id || randomUUID(), name: input.name.trim(), createdBy: input.createdBy, createdAt: nowIso() }
  if (!organization.name) throw new Error('Organization name is required')
  await db.send(new TransactWriteCommand({
    TransactItems: [
      { Put: { TableName: TABLES.ORGANIZATIONS, Item: { PK: `ORG#${organization.id}`, SK: 'META', ...organization }, ConditionExpression: 'attribute_not_exists(PK)' } },
      { Put: { TableName: TABLES.ORGANIZATIONS, Item: { PK: 'PLATFORM', SK: `ORG#${organization.id}`, ...organization }, ConditionExpression: 'attribute_not_exists(SK)' } },
    ],
  }))
  return organization
}

export async function listOrganizations(): Promise<Organization[]> {
  const result = await db.send(new QueryCommand({ TableName: TABLES.ORGANIZATIONS, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': 'PLATFORM', ':prefix': 'ORG#' } }))
  return (result.Items ?? []) as Organization[]
}

export async function getOrganization(organizationId: string): Promise<Organization | undefined> {
  const result = await db.send(new GetCommand({ TableName: TABLES.ORGANIZATIONS, Key: { PK: `ORG#${organizationId}`, SK: 'META' } }))
  return result.Item as Organization | undefined
}

export async function getOrganizationMembership(userId: string): Promise<OrganizationMembership | undefined> {
  const result = await db.send(new GetCommand({ TableName: TABLES.ORGANIZATIONS, Key: { PK: `USER#${userId}`, SK: 'MEMBERSHIP' } }))
  return result.Item as OrganizationMembership | undefined
}

async function addMembership(organizationId: string, userId: string, role: OrganizationMemberRole, extra: object = {}) {
  const joinedAt = nowIso()
  const membership: OrganizationMembership = { organizationId, userId, role, joinedAt }
  await db.send(new TransactWriteCommand({
    TransactItems: [
      { Put: { TableName: TABLES.ORGANIZATIONS, Item: { PK: `ORG#${organizationId}`, SK: `MEMBER#${userId}`, ...membership, ...extra } } },
      { Put: { TableName: TABLES.ORGANIZATIONS, Item: { PK: `USER#${userId}`, SK: 'MEMBERSHIP', ...membership, ...extra }, ConditionExpression: 'attribute_not_exists(PK)' } },
    ],
  }))
  return membership
}

export async function listOrganizationMembers(organizationId: string): Promise<OrganizationMembership[]> {
  const result = await db.send(new QueryCommand({ TableName: TABLES.ORGANIZATIONS, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': `ORG#${organizationId}`, ':prefix': 'MEMBER#' } }))
  return (result.Items ?? []) as OrganizationMembership[]
}

export async function removeOrganizationMember(organizationId: string, userId: string) {
  const membership = await getOrganizationMembership(userId)
  if (!membership || membership.organizationId !== organizationId) throw new Error('Membership not found')
  await db.send(new TransactWriteCommand({
    TransactItems: [
      { Delete: { TableName: TABLES.ORGANIZATIONS, Key: { PK: `ORG#${organizationId}`, SK: `MEMBER#${userId}` } } },
      { Delete: { TableName: TABLES.ORGANIZATIONS, Key: { PK: `USER#${userId}`, SK: 'MEMBERSHIP' } } },
    ],
  }))
}

export async function createOrganizationInvite(input: { organizationId: string; role: OrganizationMemberRole; createdBy: string; expiryMinutes?: number }) {
  const value = token()
  const item = { PK: `INVITE#${value}`, SK: 'META', token: value, organizationId: input.organizationId, role: input.role, createdBy: input.createdBy, createdAt: nowIso(), expiresAt: expiresAt(input.expiryMinutes ?? 60 * 24 * 7) }
  await db.send(new PutCommand({ TableName: TABLES.ORGANIZATIONS, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }))
  return item
}

export async function acceptOrganizationInvite(inviteToken: string, userId: string) {
  const inviteResult = await db.send(new GetCommand({ TableName: TABLES.ORGANIZATIONS, Key: { PK: `INVITE#${inviteToken}`, SK: 'META' } }))
  const invite = inviteResult.Item as { organizationId: string; role: OrganizationMemberRole; expiresAt: number; acceptedBy?: string } | undefined
  if (!invite || invite.expiresAt <= nowSeconds() || invite.acceptedBy) throw new Error('Invite is invalid or expired')
  const joinedAt = nowIso()
  const membership: OrganizationMembership = { organizationId: invite.organizationId, userId, role: invite.role, joinedAt }
  await db.send(new TransactWriteCommand({
    TransactItems: [
      { Update: { TableName: TABLES.ORGANIZATIONS, Key: { PK: `INVITE#${inviteToken}`, SK: 'META' }, UpdateExpression: 'SET acceptedBy = :userId, acceptedAt = :now', ConditionExpression: 'attribute_not_exists(acceptedBy) AND expiresAt > :nowSeconds', ExpressionAttributeValues: { ':userId': userId, ':now': joinedAt, ':nowSeconds': nowSeconds() } } },
      { Put: { TableName: TABLES.ORGANIZATIONS, Item: { PK: `ORG#${invite.organizationId}`, SK: `MEMBER#${userId}`, ...membership } } },
      { Put: { TableName: TABLES.ORGANIZATIONS, Item: { PK: `USER#${userId}`, SK: 'MEMBERSHIP', ...membership }, ConditionExpression: 'attribute_not_exists(PK)' } },
    ],
  }))
  return membership
}

export async function createJoinCode(organizationId: string, createdBy: string, expiryMinutes = 60 * 24 * 7) {
  const existing = await db.send(new GetCommand({ TableName: TABLES.ORGANIZATIONS, Key: { PK: `ORG#${organizationId}`, SK: 'JOIN_CODE' } }))
  const oldCode = existing.Item?.code as string | undefined
  const code = joinCode()
  const item = { PK: `JOIN#${code}`, SK: 'META', code, organizationId, createdBy, createdAt: nowIso(), expiresAt: expiresAt(expiryMinutes) }
  const transaction = [
    { Put: { TableName: TABLES.ORGANIZATIONS, Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
    { Put: { TableName: TABLES.ORGANIZATIONS, Item: { PK: `ORG#${organizationId}`, SK: 'JOIN_CODE', code, organizationId, createdBy, createdAt: item.createdAt, expiresAt: item.expiresAt } } },
  ] as NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']>
  if (oldCode) transaction.push({ Delete: { TableName: TABLES.ORGANIZATIONS, Key: { PK: `JOIN#${oldCode}`, SK: 'META' } } })
  await db.send(new TransactWriteCommand({ TransactItems: transaction }))
  return item
}

export async function joinOrganizationByCode(code: string, userId: string) {
  const codeResult = await db.send(new GetCommand({ TableName: TABLES.ORGANIZATIONS, Key: { PK: `JOIN#${code.trim().toUpperCase()}`, SK: 'META' } }))
  const record = codeResult.Item as { organizationId: string; expiresAt: number } | undefined
  if (!record || record.expiresAt <= nowSeconds()) throw new Error('Join code is invalid or expired')
  return addMembership(record.organizationId, userId, 'student', { joinedBy: 'join_code' })
}

export async function createOrganizationTopic(input: Omit<OrganizationTopic, 'status' | 'createdAt' | 'updatedAt'> & { status?: OrganizationTopicStatus }) {
  const now = nowIso()
  const topic: OrganizationTopic = { ...input, title: input.title.trim(), status: input.status ?? 'draft', createdAt: now, updatedAt: now }
  if (!topic.title || topic.objectives.length === 0) throw new Error('A title and at least one objective are required')
  await db.send(new PutCommand({ TableName: TABLES.ORGANIZATIONS, Item: { PK: `ORG#${topic.organizationId}`, SK: `TOPIC#${topic.id}`, ...topic }, ConditionExpression: 'attribute_not_exists(PK)' }))
  return topic
}

export async function getOrganizationTopics(organizationId: string, status?: OrganizationTopicStatus): Promise<OrganizationTopic[]> {
  const result = await db.send(new QueryCommand({ TableName: TABLES.ORGANIZATIONS, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': `ORG#${organizationId}`, ':prefix': 'TOPIC#' } }))
  const topics = (result.Items ?? []) as OrganizationTopic[]
  return status ? topics.filter((topic) => topic.status === status) : topics
}

export async function setOrganizationTopicStatus(organizationId: string, topicId: string, status: OrganizationTopicStatus) {
  const updatedAt = nowIso()
  await db.send(new UpdateCommand({ TableName: TABLES.ORGANIZATIONS, Key: { PK: `ORG#${organizationId}`, SK: `TOPIC#${topicId}` }, UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':status': status, ':updatedAt': updatedAt } }))
}
