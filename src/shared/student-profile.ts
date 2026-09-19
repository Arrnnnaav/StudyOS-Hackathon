export type StudentProfileInput = {
  name: string
  phone: string
  college: string
  branch: string
  year: number
  activeTrack: string
  github?: string
  linkedin?: string
  leetcode?: string
}

export type StudentProfileCompletion = Partial<StudentProfileInput> & {
  profileCompletedAt?: string
}

export type StudentProfileValidation =
  | { ok: true; value: StudentProfileInput }
  | { ok: false; error: string }

const requiredTextFields = [
  ['name', 'Full name'],
  ['college', 'College or university'],
  ['branch', 'Course or branch'],
  ['activeTrack', 'Learning track'],
] as const

function optionalUrl(input: Record<string, unknown>, key: 'github' | 'linkedin' | 'leetcode', label: string): string | undefined | null {
  const value = input[key]
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function validateStudentProfileInput(input: unknown): StudentProfileValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Profile details are required' }
  }

  const values = input as Record<string, unknown>
  const profile: Partial<StudentProfileInput> = {}

  for (const [key, label] of requiredTextFields) {
    const value = values[key]
    if (typeof value !== 'string' || !value.trim()) return { ok: false, error: `${label} is required` }
    profile[key] = value.trim()
  }

  if (typeof values.phone !== 'string' || !/^\d{10}$/.test(values.phone)) {
    return { ok: false, error: 'Phone number must contain exactly 10 digits' }
  }
  profile.phone = values.phone

  if (!Number.isInteger(values.year) || (values.year as number) < 1 || (values.year as number) > 4) {
    return { ok: false, error: 'Current year must be between 1 and 4' }
  }
  profile.year = values.year as number

  for (const [key, label] of [['github', 'GitHub URL'], ['linkedin', 'LinkedIn URL'], ['leetcode', 'LeetCode URL']] as const) {
    const url = optionalUrl(values, key, label)
    if (url === null) return { ok: false, error: `${label} must be a valid http or https URL` }
    if (url) profile[key] = url
  }

  return { ok: true, value: profile as StudentProfileInput }
}

export function isProfileComplete(profile: StudentProfileCompletion | undefined): boolean {
  return Boolean(
    profile?.profileCompletedAt &&
    profile.name &&
    profile.phone && /^\d{10}$/.test(profile.phone) &&
    profile.college &&
    profile.branch &&
    Number.isInteger(profile.year) && profile.year! >= 1 && profile.year! <= 4 &&
    profile.activeTrack,
  )
}
