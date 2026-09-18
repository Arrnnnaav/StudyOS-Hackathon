import { auth } from '@/lib/auth'
import { markAskSavedToReview, createReview, trackEvent } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { askId, topicId, question, answer } = await request.json()
    
    if (!askId || !topicId || !question || !answer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await markAskSavedToReview(askId, session.user.id)

    // Create review item (due immediately for demo)
    const reviewId = crypto.randomUUID()
    const now = new Date().toISOString()
    
    await createReview({
      id: reviewId,
      userId: session.user.id,
      topicId,
      askId,
      question,
      answer: answer.slice(0, 500), // Truncate for review card
      nextReviewAt: now, // Due immediately
      reviewCount: 0,
      lastRating: null,
      status: 'pending',
      createdAt: now
    })

    // Track event
    await trackEvent({
      eventId: crypto.randomUUID(),
      eventName: 'review_saved',
      timestamp: now,
      userId: session.user.id,
      sessionId: 'web',
      topicId,
      domain: null,
      properties: { askId, reviewId }
    })

    return NextResponse.json({ success: true, reviewId })

  } catch (error) {
    console.error('Save review error:', error)
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
  }
}