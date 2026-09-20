export const PUBLIC_DEMO_ACCESS = 'public-demo'

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
