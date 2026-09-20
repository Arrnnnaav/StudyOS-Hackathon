import { auth } from './auth'
import { getOrganizationMembership } from './organization-db'
import { actorFromIdentity, type OrganizationActor } from '@/shared/organization'

export async function currentOrganizationActor(): Promise<{ userId: string; actor: OrganizationActor | null } | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const membership = await getOrganizationMembership(session.user.id)
  return {
    userId: session.user.id,
    actor: actorFromIdentity(session.user.email, process.env.MASTER_ADMIN_EMAILS || process.env.MASTER_ADMIN_EMAIL || '', membership),
  }
}

export function canManageOrganization(actor: OrganizationActor | null, organizationId: string): boolean {
  return actor?.kind === 'master_admin' || (actor?.kind === 'organization_admin' && actor.organizationId === organizationId)
}
