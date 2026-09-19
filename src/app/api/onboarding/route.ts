import { auth } from '@/lib/auth'
import { saveStudentProfile } from '@/lib/db'
import { validateStudentProfileInput } from '@/shared/student-profile'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await auth()
  
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = validateStudentProfileInput(await request.json())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const profile = await saveStudentProfile(session.user.id, parsed.value, {
    email: session.user.email,
    image: session.user.image || null,
  })

  return NextResponse.json({ success: true, profile })
}
