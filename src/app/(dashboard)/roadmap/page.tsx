'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, CheckCircle, Circle, BookOpen, Lock, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { dsaFoundations } from '@/data/dsa-curriculum'

export default function RoadmapPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [progress, setProgress] = useState<any>({})

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

  const curriculum = dsaFoundations
  const completedTopics = new Set() // Would come from user progress

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">📚</span>
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-neutral-50">
            {curriculum.name}
          </h1>
        </div>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl">
          {curriculum.description}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline">{curriculum.totalTopics} topics</Badge>
          <Badge variant="outline">{curriculum.phases.length} phases</Badge>
          <Badge variant="outline">{curriculum.estimatedWeeks} weeks</Badge>
          <Badge variant="secondary">Year {curriculum.yearMin}–{curriculum.yearMax}</Badge>
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-8">
        {curriculum.phases.map((phase, phaseIndex) => (
          <section key={phase.id}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl font-bold text-neutral-400 dark:text-neutral-500">
                Phase {phaseIndex + 1}
              </span>
              <h2 className="text-2xl font-bold text-neutral-950 dark:text-neutral-500">
                {phase.title}
              </h2>
              <Badge variant="outline" className="ml-auto text-xs">
                ~{phase.estimatedHours}h • {phase.topics.length} topics
              </Badge>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">{phase.description}</p>
            
            <div className="space-y-3">
              {phase.topics.map((topic, topicIndex) => {
                const isCompleted = false // Would come from progress
                const isInProgress = false
                const prereqsMet = true // Would check against completed topics
                
                return (
                  <Link
                    key={topic.id}
                    href={`/dashboard/topics/${topic.id}`}
                    className="block group"
                  >
                    <Card className="hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                          {/* Status indicator */}
                          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                            <Circle className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                          </div>
                          
                          {/* Topic info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 transition-colors">
                                {topic.title}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {topic.estimatedMinutes} min
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Difficulty: {topic.difficulty}/5
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Importance: {topic.importance}%
                              </Badge>
                            </div>
                            <p className="text-neutral-600 dark:text-neutral-400 text-sm line-clamp-2">
                              {topic.description}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3" />
                                {topic.objectives.length} objectives
                              </span>
                              <span className="flex items-center gap-1">
                                {topic.prerequisites.length > 0 ? (
                                  <>
                                    🔗 {topic.prerequisites.length} prerequisites
                                  </>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400">No prerequisites</span>
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                {topic.resources.length} resources
                              </span>
                            </div>
                          </div>
                          
                          {/* Action */}
                          <div className="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}