'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ShieldCheck } from 'lucide-react'
import type { CoverageCheckResponse, CoverageStatus } from '@/shared/contracts'

const STATUS_BADGE: Record<CoverageStatus, { label: string; cls: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  strong: { label: '✓ Strong', cls: 'default' },
  moderate: { label: '△ Moderate', cls: 'secondary' },
  weak: { label: '! Weak', cls: 'outline' },
  missing: { label: '✕ Missing', cls: 'destructive' },
}

/**
 * Pasted-resource coverage checker (plan §17). POSTs to /api/coverage/check.
 * Used on the topic page to show whether a resource actually covers the objectives.
 */
export function CoverageChecker({ topicId }: { topicId: string }) {
  const [content, setContent] = useState('')
  const [result, setResult] = useState<CoverageCheckResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = async () => {
    if (!content.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/coverage/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message || 'Coverage check failed')
        return
      }
      setResult(data as CoverageCheckResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Coverage check failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Resource Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Paste a resource excerpt (docs, an article, your notes) and StudyOS checks it against this
          topic&apos;s objectives.
        </p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={'Paste resource text here… e.g.\n"Binary search works by repeatedly halving the search space…"'}
          rows={5}
        />
        <Button onClick={check} disabled={loading || !content.trim()} className="gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Check Coverage
        </Button>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Overall:</span>
              <Badge variant={STATUS_BADGE[result.overall].cls}>{STATUS_BADGE[result.overall].label}</Badge>
            </div>
            {result.coverage.map((c, i) => (
              <div key={i} className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{c.objective}</p>
                  <Badge variant={STATUS_BADGE[c.status].cls} className="shrink-0">{STATUS_BADGE[c.status].label}</Badge>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{c.reason}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}