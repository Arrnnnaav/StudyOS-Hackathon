import { auth } from '@/lib/auth'
import { getStudentLearningSummary, getStudentProfile } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getStudentProfile(session.user.id)
  
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ profile: user, learningSummary: await getStudentLearningSummary(session.user.id) })
}
