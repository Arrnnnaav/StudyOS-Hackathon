import { currentOrganizationActor } from '@/lib/organization-auth'
import { acceptOrganizationInvite, getOrganization, getOrganizationMembership, getOrganizationTopics, joinOrganizationByCode } from '@/lib/organization-db'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const current = await currentOrganizationActor()
  if (!current) return Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
  const membership = await getOrganizationMembership(current.userId)
  const organization = membership ? await getOrganization(membership.organizationId) : null
  const topics = membership ? await getOrganizationTopics(membership.organizationId, 'published') : []
  return Response.json({ actor: current.actor, membership, organization, topics })
}

export async function POST(request: Request) {
  const current = await currentOrganizationActor()
  if (!current) return Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
  if (await getOrganizationMembership(current.userId)) return Response.json(errorBody('MEMBERSHIP_EXISTS', 'you already belong to an organization'), { status: 409 })
  const body = await request.json().catch(() => null) as { inviteToken?: unknown; joinCode?: unknown } | null
  try {
    const membership = typeof body?.inviteToken === 'string'
      ? await acceptOrganizationInvite(body.inviteToken, current.userId)
      : typeof body?.joinCode === 'string'
        ? await joinOrganizationByCode(body.joinCode, current.userId)
        : null
    if (!membership) return Response.json(errorBody('BAD_REQUEST', 'provide inviteToken or joinCode'), { status: 400 })
    return Response.json({ membership }, { status: 201 })
  } catch (error) {
    return Response.json(errorBody('JOIN_FAILED', error instanceof Error ? error.message : 'unable to join organization'), { status: 400 })
  }
}
