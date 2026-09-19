import { canManageOrganization, currentOrganizationActor } from '@/lib/organization-auth'
import { setOrganizationTopicStatus } from '@/lib/organization-db'
import { auditOrganizationAction } from '@/lib/organization-audit'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ organizationId: string; topicId: string }> }) {
  const { organizationId, topicId } = await params
  const current = await currentOrganizationActor()
  if (!current) return Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
  if (!canManageOrganization(current.actor, organizationId)) return Response.json(errorBody('FORBIDDEN', 'organization admin required'), { status: 403 })
  const body = await request.json().catch(() => null) as { status?: unknown } | null
  if (!body || !['draft', 'published', 'unpublished'].includes(String(body.status))) return Response.json(errorBody('BAD_REQUEST', 'valid status is required'), { status: 400 })
  await setOrganizationTopicStatus(organizationId, topicId, body.status as 'draft' | 'published' | 'unpublished')
  void auditOrganizationAction(current.userId, 'organization_topic_status_changed', organizationId, { topicId, status: body.status })
  return Response.json({ ok: true })
}
