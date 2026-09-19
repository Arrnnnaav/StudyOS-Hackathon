import { auth } from '@/lib/auth'
import { createPairingCode } from '@/lib/db'
import { generatePairingCode } from '@/lib/extension-pairing'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const code = generatePairingCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    await createPairingCode(code, session.user.id, expiresAt)

    return NextResponse.json({ code, expiresAt })

  } catch (error) {
    console.error('Pair code error:', error)
    return NextResponse.json({ error: 'Failed to generate pairing code' }, { status: 500 })
  }
}
