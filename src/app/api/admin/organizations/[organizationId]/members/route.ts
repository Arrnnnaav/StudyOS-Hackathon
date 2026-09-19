import { canManageOrganization, currentOrganizationActor } from '@/lib/organization-auth'
import { createOrganizationInvite, getOrganizationMembership, listOrganizationMembers, removeOrganizationMember } from '@/lib/organization-db'
import { auditOrganizationAction } from '@/lib/organization-audit'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function manager(organizationId: string) {
  const current = await currentOrganizationActor()
  if (!current) return { error: Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 }) }
  if (!canManageOrganization(current.actor, organizationId)) return { error: Response.json(errorBody('FORBIDDEN', 'organization admin required'), { status: 403 }) }
  return { current }
}

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const access = await manager(organizationId)
  if ('error' in access) return access.error
  return Response.json({ members: await listOrganizationMembers(organizationId) })
}

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const access = await manager(organizationId)
  if ('error' in access) return access.error
  const body = await request.json().catch(() => null) as { role?: unknown } | null
  const requestedRole = body?.role === 'organization_admin' ? 'organization_admin' : 'student'
  if (requestedRole === 'organization_admin' && access.current.actor?.kind !== 'master_admin') return Response.json(errorBody('FORBIDDEN', 'only master admins can invite organization admins'), { status: 403 })
  const invite = await createOrganizationInvite({ organizationId, role: requestedRole, createdBy: access.current.userId })
  void auditOrganizationAction(access.current.userId, 'organization_invite_created', organizationId, { role: requestedRole })
  return Response.json({ invite: { token: invite.token, expiresAt: invite.expiresAt, role: invite.role } }, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const access = await manager(organizationId)
  if ('error' in access) return access.error
  const body = await request.json().catch(() => null) as { userId?: unknown } | null
  if (typeof body?.userId !== 'string') return Response.json(errorBody('BAD_REQUEST', 'userId is required'), { status: 400 })
  const membership = await getOrganizationMembership(body.userId)
  if (!membership || membership.organizationId !== organizationId) return Response.json(errorBody('NOT_FOUND', 'member not found'), { status: 404 })
  if (membership.role === 'organization_admin' && access.current.actor?.kind !== 'master_admin') return Response.json(errorBody('FORBIDDEN', 'only master admins can remove organization admins'), { status: 403 })
  await removeOrganizationMember(organizationId, body.userId)
  void auditOrganizationAction(access.current.userId, 'organization_member_removed', organizationId, { removedUserId: body.userId, role: membership.role })
  return Response.json({ ok: true })
}
