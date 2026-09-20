import { auth } from '@/lib/auth'
import { getStudentProfile, saveStudentProfile } from '@/lib/db'
import { currentOrganizationActor } from '@/lib/organization-auth'
import { PUBLIC_DEMO_STUDENT_ID } from '@/shared/demo-auth'
import { destinationForSignedInUser } from '@/shared/student-destination'
import { isProfileComplete } from '@/shared/student-profile'
import { redirect } from 'next/navigation'

export default async function ContinueAfterSignInPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const actorContext = await currentOrganizationActor()
  if (actorContext?.actor?.kind === 'master_admin') redirect('/admin/master')

  let profile = await getStudentProfile(session.user.id)
  if (session.user.id === PUBLIC_DEMO_STUDENT_ID && !isProfileComplete(profile)) {
    profile = await saveStudentProfile(session.user.id, {
      name: session.user.name || 'StudyOS demo learner',
      phone: '9999999999',
      college: 'StudyOS Demo Campus',
      branch: 'Computer Science',
      year: 2,
      activeTrack: 'dsa-foundations',
    }, {
      email: session.user.email || 'demo.student@studyos.local',
      image: session.user.image || null,
    })
  }

  redirect(destinationForSignedInUser({
    actorKind: actorContext?.actor?.kind || 'student',
    profileComplete: isProfileComplete(profile),
  }))
}
