'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress as ProgressBar } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { CheckCircle, Circle, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'

export default function ProgressPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return <div className="flex h-64 items-center justify-center">Loading...</div>
  }

  if (status === 'unauthenticated') {
    return null
  }

  const totalTopics = dsaFoundations.totalTopics
  const completed = 0
  const inProgress = 0
  const remaining = totalTopics - completed - inProgress
  const pct = totalTopics > 0 ? Math.round((completed / totalTopics) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">📊</span>
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-neutral-50">
            Your Progress
          </h1>
        </div>
        <p className="text-neutral-600 dark:text-neutral-400">
          {dsaFoundations.name} • {dsaFoundations.description}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{completed}</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{inProgress}</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-neutral-400 dark:text-neutral-500">{remaining}</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Remaining</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{pct}%</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Complete</div>
          </CardContent>
        </Card>
      </div>

      {/* Overall progress bar */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProgressBar value={pct} className="h-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {completed} of {totalTopics} topics completed
          </p>
        </CardContent>
      </Card>

      {/* Topic progress by phase */}
      <div className="space-y-8">
        {dsaFoundations.phases.map((phase, phaseIndex) => (
          <section key={phase.id}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl font-bold text-neutral-400 dark:text-neutral-500">
                Phase {phaseIndex + 1}
              </span>
              <h2 className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">{phase.title}</h2>
              <Badge variant="outline" className="ml-auto text-xs">
                {phase.topics.length} topics
              </Badge>
            </div>
            <div className="space-y-2">
              {phase.topics.map(topic => (
                <Link key={topic.id} href={`/dashboard/topics/${topic.id}`} className="block group">
                  <Card className="hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer">
                    <CardContent className="py-3 flex items-center gap-3">
                      <Circle className="h-5 w-5 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 transition-colors truncate">
                          {topic.title}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> {topic.estimatedMinutes} min
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">Not started</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}