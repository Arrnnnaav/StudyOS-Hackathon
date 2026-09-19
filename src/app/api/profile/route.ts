import { auth } from '@/lib/auth'
import { getStudentLearningSummary, getStudentProfile, saveStudentProfile } from '@/lib/db'
import { validateStudentProfileInput } from '@/shared/student-profile'
import { NextResponse } from 'next/server'

async function currentIdentity() {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) return null
  return { userId: session.user.id, email: session.user.email, image: session.user.image || null }
}

export async function GET() {
  const identity = await currentIdentity()
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getStudentProfile(identity.userId)
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json({ profile, learningSummary: await getStudentLearningSummary(identity.userId) })
}

export async function PUT(request: Request) {
  const identity = await currentIdentity()
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = validateStudentProfileInput(await request.json())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const profile = await saveStudentProfile(identity.userId, parsed.value, identity)
  return NextResponse.json({ profile })
}
