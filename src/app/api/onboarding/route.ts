import { auth } from '@/lib/auth'
import { updateUserTrack } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { year, track } = await request.json()
  
  if (!year || !track) {
    return NextResponse.json({ error: 'Year and track are required' }, { status: 400 })
  }

  if (year < 1 || year > 4) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  // Update user with track
  await updateUserTrack(session.user.id, track)

  return NextResponse.json({ success: true })
}