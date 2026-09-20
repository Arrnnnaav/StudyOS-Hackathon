export const PUBLIC_DEMO_ACCESS = 'public-demo'
export const PUBLIC_STUDENT_DEMO_ACCESS = 'public-demo-student'
export const PUBLIC_DEMO_STUDENT_ID = 'public-demo-student'

const publicDemoStudent = {
  id: PUBLIC_DEMO_STUDENT_ID,
  name: 'StudyOS live demo learner',
  email: 'demo.student@studyos.local',
}

export function resolvePublicDemoMaster(credentials: unknown, masterEmail: string | undefined) {
  const access = typeof credentials === 'object' && credentials !== null
    ? (credentials as Record<string, unknown>).access
    : undefined
  const email = masterEmail?.trim()

  if (access !== PUBLIC_DEMO_ACCESS || !email) return null

  return {
    id: 'public-demo-master',
    name: 'StudyOS live demo administrator',
    email,
  }
}

export function resolvePublicDemoIdentity(credentials: unknown, masterEmail: string | undefined) {
  const access = typeof credentials === 'object' && credentials !== null
    ? (credentials as Record<string, unknown>).access
    : undefined

  if (access === PUBLIC_STUDENT_DEMO_ACCESS) return publicDemoStudent
  return resolvePublicDemoMaster(credentials, masterEmail)
}
