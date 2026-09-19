'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CheckCircle2, Clock3, RotateCcw, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ReviewItem, ReviewRating } from '@/shared/contracts'

export default function ReviewPage() {
  const { status } = useSession()
  const router = useRouter()
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [queueNow, setQueueNow] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    let active = true
    if (status !== 'authenticated') return () => { active = false }
    fetch('/api/reviews')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load reviews')))
      .then((payload: { reviews?: ReviewItem[]; now?: string }) => {
        if (!active) return
        setReviews(Array.isArray(payload.reviews) ? payload.reviews : [])
        setQueueNow(payload.now ? new Date(payload.now).getTime() : 0)
        setLoading(false)
      })
      .catch(() => { if (active) { setError('Could not load your review queue.'); setLoading(false) } })
    return () => { active = false }
  }, [status])

  if (status === 'loading' || (status === 'authenticated' && loading)) return <QueueSkeleton />
  if (status === 'unauthenticated') return null

  const due = reviews.filter((review) => new Date(review.nextReviewAt).getTime() <= queueNow)
  const upcoming = reviews.filter((review) => new Date(review.nextReviewAt).getTime() > queueNow)

  const rate = async (review: ReviewItem, rating: ReviewRating) => {
    setSavingId(review.id)
    setError(null)
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, rating }),
      })
      const payload = await response.json() as { review?: { nextReviewAt?: string; reviewCount?: number; lastRating?: ReviewRating } }
      const updatedReview = payload.review
      const nextReviewAt = updatedReview?.nextReviewAt
      if (!response.ok || !updatedReview || !nextReviewAt) throw new Error('Could not save review')
      setReviews((current) => current.map((item) => item.id === review.id ? {
        ...item, reviewCount: updatedReview.reviewCount ?? item.reviewCount + 1, lastRating: updatedReview.lastRating ?? rating, nextReviewAt,
      } : item))
      setOpenId(null)
    } catch {
      setError('Your rating was not saved. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><RotateCcw className="h-4 w-4" /> Spaced repetition</p><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Review queue</h2><p className="mt-2 text-slate-500 dark:text-neutral-400">Answer first, then reveal the explanation.</p></div>
        <Badge variant="outline" className="w-fit rounded-full px-3 py-1.5"><Clock3 className="mr-1 h-3.5 w-3.5" /> {due.length} due today</Badge>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      <section className="space-y-4">
        <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Due now</h3><span className="text-sm text-slate-500">{due.length} card{due.length === 1 ? '' : 's'}</span></div>
        {due.length === 0 ? <EmptyQueue /> : due.map((review) => <ReviewCard key={review.id} review={review} open={openId === review.id} saving={savingId === review.id} onToggle={() => setOpenId(openId === review.id ? null : review.id)} onRate={(rating) => rate(review, rating)} />)}
      </section>

      {upcoming.length > 0 && <section className="space-y-3"><h3 className="text-lg font-semibold">Coming up</h3>{upcoming.slice(0, 5).map((review) => <Card key={review.id} className="border-slate-200 bg-white/75 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"><CardContent className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate font-medium">{review.question}</p><p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Next review {formatDate(review.nextReviewAt)}</p></div><Badge variant="outline" className="shrink-0">{formatRelative(review.nextReviewAt)}</Badge></CardContent></Card>)}</section>}
    </div>
  )
}

function ReviewCard({ review, open, saving, onToggle, onRate }: { review: ReviewItem; open: boolean; saving: boolean; onToggle: () => void; onRate: (rating: ReviewRating) => void }) {
  return <Card className="overflow-hidden border-emerald-200 shadow-sm dark:border-emerald-900"><CardContent className="space-y-5 p-5 sm:p-6"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Question</p><p className="text-lg font-medium leading-relaxed">{review.question}</p></div><div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-200">Explanation</p>{open && <Button variant="ghost" size="sm" onClick={onToggle}>Hide</Button>}</div>{open ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-emerald-950 dark:text-emerald-100">{review.answer}</p> : <Button variant="outline" className="w-full bg-white dark:bg-neutral-900" onClick={onToggle}>Reveal answer</Button>}</div>{open && <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-neutral-800"><Button variant="outline" disabled={saving} onClick={() => onRate('again')} className="border-orange-200 text-orange-800 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-300"><XCircle /> Again · tomorrow</Button><Button disabled={saving} onClick={() => onRate('good')} className="bg-emerald-700 hover:bg-emerald-800"><CheckCircle2 /> {saving ? 'Saving…' : 'Good · in 3 days'}</Button></div>}<p className="text-xs text-slate-400">Review {review.reviewCount + 1} · Last rating: {review.lastRating ?? 'none'}</p></CardContent></Card>
}

function EmptyQueue() { return <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"><CardContent className="py-10 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" /><h3 className="font-semibold text-emerald-950 dark:text-emerald-100">You&apos;re all caught up.</h3><p className="mx-auto mt-1 max-w-md text-sm text-emerald-800/80 dark:text-emerald-200/80">Save a helpful Point &amp; Ask answer to make your first review card.</p></CardContent></Card> }
function QueueSkeleton() { return <div className="mx-auto max-w-3xl animate-pulse space-y-5"><div className="h-10 w-56 rounded-lg bg-slate-200 dark:bg-neutral-800" /><div className="h-64 rounded-2xl bg-slate-100 dark:bg-neutral-900" /></div> }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function formatRelative(value: string) { const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000); return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days` }
