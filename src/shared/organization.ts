export type OrganizationActor =
  | { kind: 'master_admin' }
  | { kind: 'organization_admin'; organizationId: string }
  | { kind: 'student'; organizationId: string }

export type AssignedTopicStatus = 'not_started' | 'in_progress' | 'done'

export type OrganizationAssignment = {
  id: string
  title: string
  estimatedMinutes: number
  status: AssignedTopicStatus
}

export function isMasterAdminEmail(email: string | null | undefined, configuredEmails = process.env.MASTER_ADMIN_EMAILS || ''): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return configuredEmails.split(',').some((configured) => configured.trim().toLowerCase() === normalized)
}

export function canAccessOrganization(actor: OrganizationActor, organizationId: string): boolean {
  return actor.kind === 'master_admin' || (actor.kind === 'organization_admin' && actor.organizationId === organizationId)
}

export function organizationTodayPick(reviewsDue: number, assignments: readonly OrganizationAssignment[]):
  | { kind: 'review' }
  | { kind: 'assigned_topic'; topicId: string; continued: boolean }
  | { kind: 'personal_curriculum' } {
  if (reviewsDue > 0) return { kind: 'review' }
  const inProgress = assignments.find((assignment) => assignment.status === 'in_progress')
  if (inProgress) return { kind: 'assigned_topic', topicId: inProgress.id, continued: true }
  const next = assignments.find((assignment) => assignment.status === 'not_started')
  if (next) return { kind: 'assigned_topic', topicId: next.id, continued: false }
  return { kind: 'personal_curriculum' }
}
