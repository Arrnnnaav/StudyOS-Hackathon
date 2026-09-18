'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Brain } from 'lucide-react'
import type { QuizQuestion } from '@/shared/contracts'

interface QuizResult {
  correct: number
  total: number
  percent: number
  passed: boolean
}

/**
 * Per-topic "check your understanding" quiz (Tier-2). GETs the generated
 * questions and POSTs the answers to record evidence.
 */
export function QuizRunner({ topicId }: { topicId: string }) {
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState<QuizResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/topics/${encodeURIComponent(topicId)}/quiz`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setQuiz(Array.isArray(data?.quiz) ? data.quiz : [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) { setError('Could not load quiz'); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [topicId])

  const submit = async () => {
    const res = await fetch(`/api/topics/${encodeURIComponent(topicId)}/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: quiz.map((_, i) => answers[i] ?? -1) }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data?.error?.message || 'Could not submit quiz'); return }
    setSubmitted(data as QuizResult)
  }

  if (loading) {
    return <Card><CardContent className="py-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>
  }
  if (error) {
    return <Card><CardContent className="py-6 text-sm text-red-600">{error}</CardContent></Card>
  }
  if (quiz.length === 0) {
    return <Card><CardContent className="py-6 text-sm">No quiz available for this topic.</CardContent></Card>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Check Your Understanding
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {submitted ? (
          <div className="space-y-2">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {submitted.percent}%
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              You got {submitted.correct} of {submitted.total} correct.
              {submitted.passed ? ' Nice work — question asked counts toward your topic evidence.' : ' Review the objectives and try again.'}
            </p>
            <Button variant="outline" onClick={() => setSubmitted(null)}>Try again</Button>
          </div>
        ) : (
          <>
            {quiz.map((q, i) => (
              <div key={i} className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-2">
                <p className="text-sm font-medium">{i + 1}. {q.text}</p>
                <div className="space-y-1">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className={`flex items-center gap-2 p-2 rounded-md border text-sm cursor-pointer ${answers[i] === oi ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-neutral-200 dark:border-neutral-800'}`}>
                      <input type="radio" name={`q${i}`} checked={answers[i] === oi} onChange={() => setAnswers((a) => ({ ...a, [i]: oi }))} className="accent-emerald-600" />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={submit} disabled={Object.keys(answers).length < quiz.length} className="gap-2">
              Submit answers
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}