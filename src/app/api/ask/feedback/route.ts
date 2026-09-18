import { auth } from '@/lib/auth'
import { updateAskFeedback, markAskSavedToReview, trackEvent } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { askId, helpful, reason } = await request.json()
    
    if (!askId || helpful === undefined) {
      return NextResponse.json({ error: 'askId and helpful required' }, { status: 400 })
    }

    await updateAskFeedback(askId, session.user.id, helpful, reason || null)

    // Track event
    await trackEvent({
      eventId: crypto.randomUUID(),
      eventName: helpful ? 'answer_helpful' : 'answer_not_helpful',
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      sessionId: 'web',
      topicId: null,
      domain: null,
      properties: {
        askId,
        reason: reason || null
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}