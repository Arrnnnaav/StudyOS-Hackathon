import { canManageOrganization, currentOrganizationActor } from '@/lib/organization-auth'
import { getOrganization, getOrganizationTopics, listOrganizationMembers } from '@/lib/organization-db'
import { getUserProgress } from '@/lib/db'
import { organizationCohortProgress } from '@/shared/organization'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const current = await currentOrganizationActor()
  if (!current) return Response.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
  if (!canManageOrganization(current.actor, organizationId)) return Response.json(errorBody('FORBIDDEN', 'organization admin required'), { status: 403 })
  const [organization, members, topics] = await Promise.all([getOrganization(organizationId), listOrganizationMembers(organizationId), getOrganizationTopics(organizationId)])
  if (!organization) return Response.json(errorBody('NOT_FOUND', 'organization not found'), { status: 404 })
  const studentProgress = await Promise.all(members.filter((member) => member.role === 'student').map(async (member) => [member.userId, await getUserProgress(member.userId)] as const))
  const learners = organizationCohortProgress(members, Object.fromEntries(studentProgress), organizationId)
  return Response.json({ organization, members, learners, metrics: { members: members.length, students: learners.length, admins: members.filter((member) => member.role === 'organization_admin').length, publishedTopics: topics.filter((topic) => topic.status === 'published').length, assignedTopics: topics.filter((topic) => topic.status === 'published' && topic.deliveryMode === 'assigned').length } })
}
