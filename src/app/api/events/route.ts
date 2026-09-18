import { auth } from '@/lib/auth'
import { trackEvent } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    // Allow anonymous tracking with device ID
    const { eventName, topicId, domain, properties, deviceId } = await request.json()
    
    if (!eventName) {
      return NextResponse.json({ error: 'eventName required' }, { status: 400 })
    }

    const userId = session?.user?.id || `anon-${deviceId || crypto.randomUUID()}`
    
    await trackEvent({
      eventId: crypto.randomUUID(),
      eventName,
      timestamp: new Date().toISOString(),
      userId,
      sessionId: deviceId || 'web',
      topicId: topicId || null,
      domain: domain || null,
      properties: properties || {}
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Track event error:', error)
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 })
  }
}