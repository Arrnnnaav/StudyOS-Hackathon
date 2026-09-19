import { currentOrganizationActor } from '@/lib/organization-auth'
import { createOrganization, listOrganizations } from '@/lib/organization-db'
import { auditOrganizationAction } from '@/lib/organization-audit'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function master() {
  const current = await currentOrganizationActor()
  if (!current) return { error: Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 }) }
  if (current.actor?.kind !== 'master_admin') return { error: Response.json(errorBody('FORBIDDEN', 'master admin required'), { status: 403 }) }
  return { current }
}

export async function GET() {
  const access = await master()
  if ('error' in access) return access.error
  return Response.json({ organizations: await listOrganizations() })
}

export async function POST(request: Request) {
  const access = await master()
  if ('error' in access) return access.error
  const body = await request.json().catch(() => null) as { name?: unknown } | null
  if (typeof body?.name !== 'string' || !body.name.trim()) return Response.json(errorBody('BAD_REQUEST', 'organization name is required'), { status: 400 })
  const organization = await createOrganization({ name: body.name, createdBy: access.current.userId })
  void auditOrganizationAction(access.current.userId, 'organization_created', organization.id, { name: organization.name })
  return Response.json({ organization }, { status: 201 })
}
