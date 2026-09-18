import { updateAskFeedback, markAskSavedToReview, trackEvent } from '@/lib/db'
import { resolveApiUser } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const user = await resolveApiUser(body)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { askId, helpful, reason } = body

    if (!askId || helpful === undefined) {
      return NextResponse.json({ error: 'askId and helpful required' }, { status: 400 })
    }

    await updateAskFeedback(askId, user.userId, helpful, reason || null)

    // Track event
    await trackEvent({
      eventId: crypto.randomUUID(),
      eventName: helpful ? 'answer_helpful' : 'answer_not_helpful',
      timestamp: new Date().toISOString(),
      userId: user.userId,
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