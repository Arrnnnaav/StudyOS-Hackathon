import { auth } from '@/lib/auth'
import { getDueReviews, updateReviewRating, trackEvent, recordReviewCompleted } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date().toISOString()
    const reviews = await getDueReviews(session.user.id, now)

    return NextResponse.json({ reviews })

  } catch (error) {
    console.error('Get reviews error:', error)
    return NextResponse.json({ error: 'Failed to get reviews' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reviewId, rating } = await request.json()
    
    if (!reviewId || !rating) {
      return NextResponse.json({ error: 'reviewId and rating required' }, { status: 400 })
    }

    if (!['again', 'good'].includes(rating)) {
      return NextResponse.json({ error: 'Rating must be "again" or "good"' }, { status: 400 })
    }

    // Get review to find topicId for progress tracking
    // For hackathon, we'll assume the review has topicId in a known format
    // In production, we'd query the review first
    
    await updateReviewRating(reviewId, session.user.id, rating)

    // Track event
    await trackEvent({
      eventId: crypto.randomUUID(),
      eventName: 'review_completed',
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      sessionId: 'web',
      topicId: null,
      domain: null,
      properties: { reviewId, rating }
    })

    // Record in progress (would need topicId from review)
    // await recordReviewCompleted(session.user.id, topicId)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Rate review error:', error)
    return NextResponse.json({ error: 'Failed to rate review' }, { status: 500 })
  }
}