import { createPairingCode } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Generate 6-character pairing code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    // In production, we'd look up user by email and store code
    // For hackathon, we'll store code with a placeholder user lookup
    await createPairingCode(code, 'pending-email-lookup', expiresAt)

    // TODO: Send email with code (use SES or similar)
    // For hackathon demo, return code directly
    return NextResponse.json({ 
      code, 
      expiresAt,
      message: 'Check your email for the pairing code' 
    })

  } catch (error) {
    console.error('Pair code error:', error)
    return NextResponse.json({ error: 'Failed to generate pairing code' }, { status: 500 })
  }
}