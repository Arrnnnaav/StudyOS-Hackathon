import { consumePairingCode, createExtensionToken } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { code } = await request.json()
    
    if (!code) {
      return NextResponse.json({ error: 'Pairing code required' }, { status: 400 })
    }

    const pairing = await consumePairingCode(code.toUpperCase())
    
    if (!pairing) {
      return NextResponse.json({ error: 'Invalid or expired pairing code' }, { status: 401 })
    }

    if (new Date(pairing.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Pairing code expired' }, { status: 401 })
    }

    // Generate opaque extension session token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

    await createExtensionToken(token, pairing.userId, expiresAt)

    return NextResponse.json({
      token,
      expiresAt
    })

  } catch (error) {
    console.error('Extension pair error:', error)
    return NextResponse.json({ error: 'Failed to pair extension' }, { status: 500 })
  }
}