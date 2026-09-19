import { canManageOrganization, currentOrganizationActor } from '@/lib/organization-auth'
import { createJoinCode } from '@/lib/organization-db'
import { auditOrganizationAction } from '@/lib/organization-audit'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const current = await currentOrganizationActor()
  if (!current) return Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
  if (!canManageOrganization(current.actor, organizationId)) return Response.json(errorBody('FORBIDDEN', 'organization admin required'), { status: 403 })
  const code = await createJoinCode(organizationId, current.userId)
  void auditOrganizationAction(current.userId, 'organization_join_code_rotated', organizationId)
  return Response.json({ code: code.code, expiresAt: code.expiresAt })
}
