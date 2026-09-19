'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Flame, Layers3, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Curriculum, Topic } from '@/data/dsa-curriculum'
import type { TopicProgress } from '@/shared/contracts'
import type { TodayPick } from '@/shared/today'

type ProgressTopic = Topic & { progress: Pick<TopicProgress, 'status' | 'timeSpentMin'> }
type ProgressResponse = {
  curriculum: Omit<Curriculum, 'phases'> & { phases: Array<{ topics: ProgressTopic[] }> }
  today: TodayPick
  stats: { done: number; total: number }
}

export default function TodayPage() {
  const { status } = useSession()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    if (status !== 'authenticated') return () => { active = false }
    fetch('/api/progress')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load progress')))
      .then((payload: ProgressResponse) => { if (active) setData(payload) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [status])

  if (status === 'loading' || (status === 'authenticated' && !data && !error)) return <TodaySkeleton />
  if (status === 'unauthenticated') return null
  if (error || !data) return <div className="mx-auto max-w-2xl py-16 text-center text-sm text-slate-500">We couldn&apos;t load today&apos;s plan. Refresh to try again.</div>

  const topics = data.curriculum.phases.flatMap((phase) => phase.topics)
  const inProgress = topics.filter((topic) => topic.progress.status === 'in_progress').length
  const remaining = data.stats.total - data.stats.done - inProgress
  const percent = data.stats.total ? Math.round((data.stats.done / data.stats.total) * 100) : 0
  const pick = data.today

  if (pick.kind === 'done') return <CompletionState done={data.stats.done} total={data.stats.total} />
  if (pick.kind === 'review') return <ReviewState count={pick.reviewsDue} reason={pick.whyNow} />

  const topic = pick.topic
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><Flame className="h-4 w-4 fill-current" /> Your focused plan</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">One clear next step.</h2>
          <p className="mt-2 text-slate-500 dark:text-neutral-400">{data.curriculum.name} · Progress is saved as you learn.</p>
        </div>
        <div className="min-w-52 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-2 flex justify-between text-xs font-medium text-slate-500 dark:text-neutral-400"><span>Track progress</span><span>{percent}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} /></div>
        </div>
      </header>

      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-sm dark:border-emerald-900/70 dark:from-emerald-950/50 dark:via-neutral-900 dark:to-teal-950/30">
        <CardContent className="p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3"><Badge className="rounded-full bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-700">{pick.continued ? 'CONTINUE' : 'TODAY'}</Badge><span className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-800/70 dark:text-emerald-200/70">{pick.continued ? 'Keep momentum' : 'Prerequisite-ready'}</span></div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-emerald-200 bg-white/70 dark:bg-neutral-900/50"><Clock3 className="mr-1 h-3.5 w-3.5" /> {topic.estimatedMinutes} min</Badge><Badge variant="outline">Difficulty {topic.difficulty}/5</Badge></div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{topic.title}</h3>
              <p className="mt-2 text-slate-600 dark:text-neutral-300">{topic.description}</p>
              <p className="mt-4 border-l-2 border-emerald-400 pl-3 text-sm text-emerald-900 dark:text-emerald-100"><span className="mr-1 font-semibold">Why now:</span>{pick.whyNow}</p>
            </div>
            <Button size="lg" className="shrink-0 rounded-xl bg-emerald-700 px-5 shadow-lg shadow-emerald-700/20 hover:bg-emerald-800" asChild><Link href={`/dashboard/topics/${topic.id}`}>{pick.continued ? 'Continue topic' : 'Start topic'}<ArrowRight /></Link></Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric icon={CheckCircle2} label="Completed" value={`${data.stats.done} / ${data.stats.total}`} tone="text-emerald-600" />
        <Metric icon={Layers3} label="In progress" value={String(inProgress)} tone="text-sky-600" />
        <Metric icon={BookOpen} label="Still ahead" value={String(remaining)} tone="text-slate-500" />
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/roadmap" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"><BookOpen className="mb-3 h-5 w-5 text-emerald-600" /><h3 className="font-semibold">See the full roadmap</h3><p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Explore every dependency and resource.</p></Link>
        <Link href="/dashboard/review" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"><RotateCcw className="mb-3 h-5 w-5 text-emerald-600" /><h3 className="font-semibold">Review queue</h3><p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Bring saved questions back at the right time.</p></Link>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof BookOpen; label: string; value: string; tone: string }) {
  return <Card className="border-slate-200 shadow-sm dark:border-neutral-800"><CardContent className="flex items-center gap-3 p-4"><span className={`grid h-10 w-10 place-items-center rounded-xl bg-slate-50 dark:bg-neutral-800 ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-lg font-bold tracking-tight">{value}</p><p className="text-xs text-slate-500 dark:text-neutral-400">{label}</p></div></CardContent></Card>
}

function ReviewState({ count, reason }: { count: number; reason: string }) {
  return <div className="mx-auto max-w-3xl py-12 text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><RotateCcw /></div><h2 className="text-3xl font-bold">Clear your review queue first.</h2><p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-neutral-400">{reason}</p><Button size="lg" className="mt-7" asChild><Link href="/dashboard/review">Review {count} card{count === 1 ? '' : 's'}<ArrowRight /></Link></Button></div>
}

function CompletionState({ done, total }: { done: number; total: number }) {
  return <div className="mx-auto max-w-3xl py-12 text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 /></div><h2 className="text-3xl font-bold">You completed this track.</h2><p className="mt-3 text-slate-500 dark:text-neutral-400">{done} of {total} topics are complete. Keep the knowledge active with regular review.</p><Button size="lg" className="mt-7" asChild><Link href="/dashboard/review">Open review queue<ArrowRight /></Link></Button></div>
}

function TodaySkeleton() {
  return <div className="mx-auto max-w-5xl space-y-6 animate-pulse"><div className="h-8 w-72 rounded-lg bg-slate-200 dark:bg-neutral-800" /><div className="h-72 rounded-3xl bg-slate-100 dark:bg-neutral-900" /><div className="grid grid-cols-3 gap-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 rounded-2xl bg-slate-100 dark:bg-neutral-900" />)}</div></div>
}
