'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowRight, Clock, BookOpen, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface TodayAction {
  type: 'next' | 'continue' | 'review' | 'complete'
  topic?: any
  reason?: string
}

export default function TodayPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === 'loading') {
    return <div className="flex h-64 items-center justify-center">Loading...</div>
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin')
    return null
  }

  // This would come from server component in production
  // For now, we'll show a placeholder
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-neutral-50">
            Today
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            DSA Foundations • Day 1 of 98 • <span className="font-semibold text-emerald-600">🔥 0-day streak</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            <RotateCcw className="h-4 w-4" />
            <span>0 / 14 topics</span>
          </div>
          <Progress value={0} className="w-48 h-2" />
        </div>
      </div>

      {/* Today's Actions */}
      <div className="space-y-4 mb-8">
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <CardTitle className="text-emerald-900 dark:text-emerald-100">TODAY</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <span className="text-lg">1</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">Complexity Basics</span>
                  <Badge variant="secondary" className="text-xs">90 min</Badge>
                  <Badge variant="outline" className="text-xs">Difficulty: 1/5</Badge>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-2">
                  Big-O, time & space complexity analysis. Every interview starts with "what is the time complexity?"
                </div>
                <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> 3 resources</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> 90 min</span>
                </div>
              </div>
              <Button className="ml-auto h-10" asChild>
                <Link href="/dashboard/topics/complexity-basics">
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Start Topic
                </Link>
              </Button>
            </div>
            
            <div className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <span>WHY NOW</span>
              <span className="text-neutral-500 dark:text-neutral-400">First topic in your roadmap. No prerequisites required.</span>
            </div>
          </CardContent>
        </Card>

        {/* Review Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-lg">📚</span>
              <CardTitle>REVIEW</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-500 dark:text-neutral-400 text-center py-4">
              No reviews due yet. Complete topics and save answers to build your review queue.
            </p>
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle>PROGRESS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">0</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">Completed</div>
              </div>
              <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">1</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">In Progress</div>
              </div>
              <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="text-3xl font-bold text-neutral-400 dark:text-neutral-500">13</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">Remaining</div>
              </div>
              <div className="text-center p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">0%</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">Complete</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/dashboard/roadmap" className="block">
          <Card className="hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer">
            <CardContent className="py-6 text-center">
              <BookOpen className="h-8 w-8 mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
              <h3 className="font-semibold">View Full Roadmap</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">All 14 topics, 4 phases</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/topics/complexity-basics" className="block">
          <Card className="hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer">
            <CardContent className="py-6 text-center">
              <span className="text-3xl">🎯</span>
              <h3 className="font-semibold mt-2">Start First Topic</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Complexity Basics (90 min)</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}