import { markAskSavedToReview, createReview, getAskById, trackEvent } from '@/lib/db'
import { resolveApiUser } from '@/lib/auth-utils'
import { reviewInput } from '@/shared/review-input'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const user = await resolveApiUser(body)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { askId } = body

    if (!askId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Spatial questions can come from any public page, so their stored ask
    // intentionally has no curriculum topic. The question and answer remain
    // mandatory; the topic is optional for a review card.
    const input = reviewInput(body, await getAskById(user.userId, askId))

    if (!input) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await markAskSavedToReview(input.askId, user.userId)

    // Create review item (due immediately for demo)
    const reviewId = crypto.randomUUID()
    const now = new Date().toISOString()

    await createReview({
      id: reviewId,
      userId: user.userId,
      topicId: input.topicId,
      askId: input.askId,
      question: input.question,
      answer: input.answer.slice(0, 500), // Truncate for review card
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
      userId: user.userId,
      sessionId: 'web',
      topicId: input.topicId,
      domain: null,
      properties: { askId: input.askId, reviewId }
    })

    return NextResponse.json({ success: true, reviewId })

  } catch (error) {
    console.error('Save review error:', error)
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
  }
}
