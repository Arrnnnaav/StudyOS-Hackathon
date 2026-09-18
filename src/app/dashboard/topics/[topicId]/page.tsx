'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronRight, CheckCircle, Circle, BookOpen, Lock, AlertCircle, Clock, Sparkles, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { dsaFoundations } from '@/data/dsa-curriculum'

export default function TopicPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const topicId = params.topicId as string
  const [topic, setTopic] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    // Find topic in curriculum
    let foundTopic: any = null
    dsaFoundations.phases.forEach(phase => {
      phase.topics.forEach(t => {
        if (t.id === topicId) foundTopic = t
      })
    })
    setTopic(foundTopic)
    
    // Fetch progress (would call API in production)
    // setProgress(await fetch(`/api/topics/${topicId}`).then(r => r.json()))
  }, [topicId])

  if (status === 'loading') {
    return <div className="flex h-64 items-center justify-center">Loading...</div>
  }

  if (status === 'unauthenticated') {
    return null
  }

  if (!topic) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-950 dark:text-neutral-50 mb-4">Topic not found</h1>
        <Link href="/dashboard/roadmap">
          <Button>Back to Roadmap</Button>
        </Link>
      </div>
    )
  }

  // Mock progress for demo
  const mockProgress = {
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    timeSpentMin: 0,
    resourceCompleted: false,
    questionsAsked: 0,
    helpfulAnswers: 0,
    reviewsCompleted: 0
  }

  const evidenceLabel = computeEvidenceLabel(mockProgress)
  const prereqsMet = true // Would check against completed topics

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/roadmap" className="inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4">
          ← Back to Roadmap
        </Link>
        
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-neutral-500">
            {topic.title}
          </h1>
          <Badge variant="secondary">{topic.estimatedMinutes} min</Badge>
          <Badge variant="outline">Difficulty: {topic.difficulty}/5</Badge>
          <Badge variant="outline">Importance: {topic.importance}%</Badge>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge variant={evidenceLabel === 'No Evidence' ? 'outline' : evidenceLabel === 'Reviewed' ? 'secondary' : 'default'}>
            {evidenceLabel}
          </Badge>
          {topic.prerequisites.length > 0 && !prereqsMet && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Prerequisites not met
            </Badge>
          )}
        </div>
      </div>

      {/* Why it matters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Why this matters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-700 dark:text-neutral-300">{topic.whyItMatters}</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="objectives">Objectives ({topic.objectives.length})</TabsTrigger>
          <TabsTrigger value="resources">Resources ({topic.resources.length})</TabsTrigger>
          <TabsTrigger value="practice">Practice</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{topic.description}</p>
            </CardContent>
          </Card>

          {/* Prerequisites */}
          {topic.prerequisites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Prerequisites ({topic.prerequisites.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {topic.prerequisites.map((p: string) => (
                    <Badge key={p} variant={prereqsMet ? 'secondary' : 'destructive'} className="text-xs">
                      {p} {prereqsMet ? '✓' : '✗'}
                    </Badge>
                  ))}
                </div>
                {!prereqsMet && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    Complete prerequisites before starting this topic.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Learning Evidence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Learning Evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400">Resource completed</span>
                <span className="font-medium">{mockProgress.resourceCompleted ? '✓' : '✗'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400">Questions asked</span>
                <span className="font-medium">{mockProgress.questionsAsked}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400">Helpful explanations</span>
                <span className="font-medium">{mockProgress.helpfulAnswers}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="text-neutral-600 dark:text-neutral-400">Reviews completed</span>
                <span className="font-medium">{mockProgress.reviewsCompleted}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-neutral-600 dark:text-neutral-400">Time spent</span>
                <span className="font-medium">{mockProgress.timeSpentMin} min</span>
              </div>
            </CardContent>
          </Card>

          {/* Progress Actions */}
          <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button className="flex-1" asChild>
                  <Link href={`/dashboard/topics/${topic.id}?action=start`}>
                    {mockProgress.status === 'not_started' ? 'Start Topic' : 'Continue Topic'}
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/roadmap">
                    Back to Roadmap
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Objectives Tab */}
        <TabsContent value="objectives" className="space-y-4">
          {topic.objectives.map((objective: string, index: number) => (
            <Card key={index} className="bg-neutral-50 dark:bg-neutral-800/50">
              <CardContent className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {index + 1}
                </span>
                <p className="text-neutral-700 dark:text-neutral-300 pt-1">{objective}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          {topic.resources.map((resource: any, index: number) => (
            <Card key={index}>
              <CardContent className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  {resource.type === 'video' && '▶'}
                  {resource.type === 'article' && '📄'}
                  {resource.type === 'problems' && '💻'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={resource.url} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                      {resource.title}
                    </Link>
                    <Badge variant="outline" className="text-xs capitalize">{resource.type}</Badge>
                    <Badge variant="outline" className="text-xs">{resource.source}</Badge>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Quality score: {resource.qualityScore}%</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">Open</a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Practice Tab */}
        <TabsContent value="practice" className="space-y-4">
          {topic.practiceUrl ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Practice Problems
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  Practice problems to reinforce your understanding of this topic.
                </p>
                <Button asChild>
                  <a href={topic.practiceUrl} target="_blank" rel="noopener noreferrer">
                    Open Practice Problems
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-neutral-50 dark:bg-neutral-800/50">
              <CardContent className="py-8 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-neutral-400 dark:text-neutral-500 mb-4" />
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">No practice link yet</h3>
                <p className="text-neutral-500 dark:text-neutral-400">
                  Practice problems will be added soon. For now, use the resources above to practice.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function computeEvidenceLabel(progress: any): 'No Evidence' | 'Started' | 'Developing' | 'Reviewed' {
  if (progress.status === 'not_started' && progress.questionsAsked === 0) return 'No Evidence'
  if (progress.status === 'in_progress' || progress.questionsAsked > 0) return 'Developing'
  if (progress.status === 'done' && progress.reviewsCompleted === 0) return 'Developing'
  if (progress.reviewsCompleted > 0) return 'Reviewed'
  return 'No Evidence'
}