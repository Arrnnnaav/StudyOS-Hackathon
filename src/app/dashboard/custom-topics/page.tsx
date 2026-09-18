'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, FolderPlus } from 'lucide-react'
import Link from 'next/link'
import type { CustomTopic } from '@/shared/contracts'

/** Custom topics (Tier-2): students add their own topic to their roadmap. */
export default function CustomTopicsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [topics, setTopics] = useState<CustomTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [why, setWhy] = useState('')
  const [objectivesText, setObjectivesText] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/topics/custom')
      const data = await res.json()
      if (res.ok && Array.isArray(data?.topics)) setTopics(data.topics)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated') load()
  }, [status, router, load])

  if (status === 'loading') return <div className="flex h-64 items-center justify-center">Loading...</div>
  if (status === 'unauthenticated') return null

  const create = async () => {
    const objectives = objectivesText.split('\n').map((s) => s.trim()).filter(Boolean)
    const res = await fetch('/api/topics/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, why, objectives }),
    })
    if (!res.ok) return
    setTitle(''); setDescription(''); setWhy(''); setObjectivesText(''); setShowForm(false)
    load()
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-neutral-50">Custom Topics</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Have your own learning goal? Add it to your roadmap.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
          <Plus className="h-4 w-4" /> New topic
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><FolderPlus className="h-5 w-5" /> Create a topic</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Title (e.g. Machine Learning Basics)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <Textarea placeholder="Why it matters to you" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} />
            <div>
              <p className="text-sm text-neutral-500 mb-1">Objectives (one per line)</p>
              <Textarea placeholder={'Understand neural networks\nImplement a simple classifier\nEvaluate model accuracy'} value={objectivesText} onChange={(e) => setObjectivesText(e.target.value)} rows={3} />
            </div>
            <Button onClick={create} disabled={!title.trim()}>Create topic</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-24 items-center justify-center text-neutral-400">Loading…</div>
      ) : topics.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-neutral-500 dark:text-neutral-400">No custom topics yet. Add your first one!</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{t.title}</span>
                    <Badge variant="secondary" className="text-xs">~{t.estimatedMinutes} min</Badge>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">{t.description}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.objectives.length} objectives</p>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600" aria-label="Delete"
                  onClick={() => fetch(`/api/topics/custom/${t.id}`, { method: 'DELETE' }).then(() => load())}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}