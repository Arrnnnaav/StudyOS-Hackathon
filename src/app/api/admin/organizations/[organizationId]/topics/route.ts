import { canManageOrganization, currentOrganizationActor } from '@/lib/organization-auth'
import { createOrganizationTopic, getOrganizationMembership, getOrganizationTopics } from '@/lib/organization-db'
import { auditOrganizationAction } from '@/lib/organization-audit'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TopicInput = {
  title?: unknown
  description?: unknown
  objectives?: unknown
  estimatedMinutes?: unknown
  resources?: unknown
  deliveryMode?: unknown
  status?: unknown
}

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const current = await currentOrganizationActor()
  if (!current) return Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
  const membership = await getOrganizationMembership(current.userId)
  const canRead = current.actor?.kind === 'master_admin' || membership?.organizationId === organizationId
  if (!canRead) return Response.json(errorBody('FORBIDDEN', 'organization membership required'), { status: 403 })
  const status = current.actor?.kind === 'student' ? 'published' : undefined
  return Response.json({ topics: await getOrganizationTopics(organizationId, status) })
}

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const current = await currentOrganizationActor()
  if (!current) return Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
  if (!canManageOrganization(current.actor, organizationId)) return Response.json(errorBody('FORBIDDEN', 'organization admin required'), { status: 403 })
  const body = await request.json().catch(() => null) as TopicInput | null
  const objectives = Array.isArray(body?.objectives) ? body.objectives.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()).slice(0, 12) : []
  const resources = Array.isArray(body?.resources) ? body.resources.filter((item): item is { title: string; url: string; kind: 'watch' | 'read' | 'practice' } => !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).title === 'string' && typeof (item as Record<string, unknown>).url === 'string' && ['watch', 'read', 'practice'].includes(String((item as Record<string, unknown>).kind))).slice(0, 12) : []
  if (typeof body?.title !== 'string' || typeof body?.description !== 'string' || objectives.length === 0) return Response.json(errorBody('BAD_REQUEST', 'title, description, and an objective are required'), { status: 400 })
  const topic = await createOrganizationTopic({
    id: crypto.randomUUID(), organizationId, title: body.title.slice(0, 160), description: body.description.slice(0, 2_000), objectives,
    estimatedMinutes: typeof body.estimatedMinutes === 'number' && body.estimatedMinutes > 0 ? Math.min(600, Math.round(body.estimatedMinutes)) : 30,
    resources, deliveryMode: body.deliveryMode === 'assigned' ? 'assigned' : 'library', status: body.status === 'published' ? 'published' : 'draft', createdBy: current.userId,
  })
  void auditOrganizationAction(current.userId, 'organization_topic_created', organizationId, { topicId: topic.id, status: topic.status, deliveryMode: topic.deliveryMode })
  return Response.json({ topic }, { status: 201 })
}
