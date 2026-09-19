export type StudentActorKind = 'student' | 'organization_admin' | 'master_admin'

export function destinationForSignedInUser(input: { actorKind: StudentActorKind; profileComplete: boolean }): string {
  if (input.actorKind === 'master_admin') return '/admin/master'
  if (input.actorKind === 'organization_admin') return '/admin/organization'
  return input.profileComplete ? '/dashboard/today' : '/auth/onboarding'
}
