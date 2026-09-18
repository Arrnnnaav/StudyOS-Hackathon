'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { BookMarked, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function TopicsPage() {
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🗂️</span>
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-neutral-50">
            All Topics
          </h1>
        </div>
        <p className="text-neutral-600 dark:text-neutral-400">
          Browse every topic in {dsaFoundations.name}. {dsaFoundations.totalTopics} topics across {dsaFoundations.phases.length} phases.
        </p>
      </div>

      {/* Phases */}
      <div className="space-y-8">
        {dsaFoundations.phases.map((phase, phaseIndex) => (
          <section key={phase.id}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl font-bold text-neutral-400 dark:text-neutral-500">
                Phase {phaseIndex + 1}
              </span>
              <h2 className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">{phase.title}</h2>
              <Badge variant="outline" className="ml-auto text-xs">
                ~{phase.estimatedHours}h • {phase.topics.length} topics
              </Badge>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">{phase.description}</p>

            <div className="space-y-3">
              {phase.topics.map(topic => (
                <Link key={topic.id} href={`/dashboard/topics/${topic.id}`} className="block group">
                  <Card className="hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <BookMarked className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 transition-colors">
                              {topic.title}
                            </span>
                            <Badge variant="secondary" className="text-xs">{topic.estimatedMinutes} min</Badge>
                            <Badge variant="outline" className="text-xs">Difficulty: {topic.difficulty}/5</Badge>
                          </div>
                          <p className="text-neutral-600 dark:text-neutral-400 text-sm line-clamp-2">{topic.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                            <span>{topic.objectives.length} objectives</span>
                            <span>{topic.resources.length} resources</span>
                            {topic.prerequisites.length > 0 && (
                              <span>🔗 {topic.prerequisites.length} prerequisites</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                      </div>
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