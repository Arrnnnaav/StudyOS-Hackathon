import { auth } from '@/lib/auth'
import { getStudentProfile } from '@/lib/db'
import { currentOrganizationActor } from '@/lib/organization-auth'
import { destinationForSignedInUser } from '@/shared/student-destination'
import { isProfileComplete } from '@/shared/student-profile'
import { redirect } from 'next/navigation'

export default async function ContinueAfterSignInPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const [actorContext, profile] = await Promise.all([
    currentOrganizationActor(),
    getStudentProfile(session.user.id),
  ])
  redirect(destinationForSignedInUser({
    actorKind: actorContext?.actor?.kind || 'student',
    profileComplete: isProfileComplete(profile),
  }))
}
