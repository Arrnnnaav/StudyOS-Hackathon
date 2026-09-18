'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowRight, RotateCcw, CheckCircle, XCircle, Clock, Brain } from 'lucide-react'
import Link from 'next/link'

interface ReviewItem {
  id: string
  topicId: string
  question: string
  answer: string
  nextReviewAt: string
  reviewCount: number
  lastRating: 'again' | 'good' | null
}

export default function ReviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [showAnswer, setShowAnswer] = useState<string | null>(null)
  const [rating, setRating] = useState<Record<string, 'again' | 'good'>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    // Fetch reviews (would call API in production)
    // For demo, show empty state
    setReviews([])
  }, [])

  if (status === 'loading') {
    return <div className="flex h-64 items-center justify-center">Loading...</div>
  }

  if (status === 'unauthenticated') {
    return null
  }

  const dueReviews = reviews.filter(r => new Date(r.nextReviewAt) <= new Date())
  const upcomingReviews = reviews.filter(r => new Date(r.nextReviewAt) > new Date())

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">📚</span>
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-neutral-50">
            Review Queue
          </h1>
        </div>
        <p className="text-neutral-600 dark:text-neutral-400">
          {dueReviews.length} due today • {upcomingReviews.length} upcoming
        </p>
      </div>

      {/* Due Reviews */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-950 dark:text-neutral-500">
            Due Today ({dueReviews.length})
          </h2>
          {dueReviews.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {dueReviews.length} card{ dueReviews.length !== 1 ? 's' : '' }
            </Badge>
          )}
        </div>

        {dueReviews.length === 0 ? (
          <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
                All caught up!
              </h3>
              <p className="text-emerald-700 dark:text-emerald-300 text-sm">
                No reviews due today. Complete topics and save answers to build your review queue.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {dueReviews.map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                showAnswer={showAnswer === review.id}
                onToggle={() => setShowAnswer(showAnswer === review.id ? null : review.id)}
                onRate={(r) => setRating(prev => ({ ...prev, [review.id]: r }))}
                currentRating={rating[review.id]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Reviews */}
      {upcomingReviews.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-neutral-950 dark:text-neutral-500 mb-4">
            Upcoming ({upcomingReviews.length})
          </h2>
          <div className="space-y-3">
            {upcomingReviews.slice(0, 5).map(review => (
              <Card key={review.id} className="bg-neutral-50 dark:bg-neutral-800/50">
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {review.question}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Due {formatDate(review.nextReviewAt)}
                    </p>
                  </div>
                  <Badge variant="outline">{formatRelative(review.nextReviewAt)}</Badge>
                </CardContent>
              </Card>
            ))}
            {upcomingReviews.length > 5 && (
              <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                +{upcomingReviews.length - 5} more upcoming
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ReviewCard({ 
  review, 
  showAnswer, 
  onToggle, 
  onRate, 
  currentRating 
}: { 
  review: ReviewItem
  showAnswer: boolean
  onToggle: () => void
  onRate: (r: 'again' | 'good') => void
  currentRating: 'again' | 'good' | undefined
}) {
  return (
    <Card className="border-emerald-200 dark:border-emerald-800 bg-white dark:bg-neutral-900">
      <CardContent className="space-y-4">
        {/* Question */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">❓</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Question</span>
          </div>
          <p className="text-neutral-700 dark:text-neutral-300">{review.question}</p>
        </div>

        {/* Answer */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💡</span>
            <span className="font-semibold text-emerald-900 dark:text-emerald-100">Answer</span>
            {showAnswer && (
              <Button variant="ghost" size="sm" onClick={onToggle} className="ml-auto">
                Hide
              </Button>
            )}
          </div>
          {showAnswer ? (
            <p className="text-emerald-800 dark:text-emerald-200 whitespace-pre-wrap">{review.answer}</p>
          ) : (
            <Button variant="outline" size="sm" onClick={onToggle} className="w-full">
              Show Answer
            </Button>
          )}
        </div>

        {/* Rating */}
        {showAnswer && (
          <div className="flex items-center gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">How did that feel?</span>
            <Button
              variant={currentRating === 'again' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => onRate('again')}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Again
            </Button>
            <Button
              variant={currentRating === 'good' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onRate('good')}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Good
            </Button>
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 pt-2 border-t border-neutral-200 dark:border-neutral-700">
          <span>Review #{review.reviewCount + 1}</span>
          <span>Last: {review.lastRating || 'never'}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatRelative(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}