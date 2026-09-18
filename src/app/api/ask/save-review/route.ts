import { markAskSavedToReview, createReview, getAskById, trackEvent } from '@/lib/db'
import { resolveApiUser } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const user = await resolveApiUser(body)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let { askId, topicId, question, answer } = body

    if (!askId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // If topic/question/answer weren't provided (extension sends only askId),
    // fall back to the stored ask record.
    if (!topicId || !question || !answer) {
      const ask = await getAskById(user.userId, askId)
      if (ask) {
        topicId = topicId || ask.topicId || null
        question = question || ask.question
        answer = answer || ask.answer
      }
    }

    if (!topicId || !question || !answer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await markAskSavedToReview(askId, user.userId)

    // Create review item (due immediately for demo)
    const reviewId = crypto.randomUUID()
    const now = new Date().toISOString()

    await createReview({
      id: reviewId,
      userId: user.userId,
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
      userId: user.userId,
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