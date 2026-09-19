import { auth } from '@/lib/auth'
import { getReviewById, getUserReviews, updateReviewRating, trackEvent, recordReviewCompleted } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reviews = await getUserReviews(session.user.id)

    return NextResponse.json({ reviews, now: new Date().toISOString() })

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

    const review = await getReviewById(session.user.id, reviewId)
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const updated = await updateReviewRating(reviewId, session.user.id, rating)

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

    if (review.topicId) {
      await recordReviewCompleted(session.user.id, review.topicId)
    }

    return NextResponse.json({ success: true, review: updated })

  } catch (error) {
    console.error('Rate review error:', error)
    return NextResponse.json({ error: 'Failed to rate review' }, { status: 500 })
  }
}
