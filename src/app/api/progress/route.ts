import { auth } from '@/lib/auth'
import { getDueReviews, getUserProgress, startTopic, completeTopic } from '@/lib/db'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { NextResponse } from 'next/server'
import { progressStats, todayPick, toStatusMap } from '@/shared/today'
import type { TopicProgress } from '@/shared/contracts'

const emptyProgress = (): Omit<TopicProgress, 'userId' | 'topicId' | 'updatedAt'> => ({
  status: 'not_started',
  startedAt: null,
  completedAt: null,
  timeSpentMin: 0,
  resourceCompleted: false,
  questionsAsked: 0,
  helpfulAnswers: 0,
  reviewsCompleted: 0,
})

export async function GET() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const progress = await getUserProgress(session.user.id)
  
  // Merge progress with curriculum
  const curriculum = dsaFoundations
  const phasesWithProgress = curriculum.phases.map(phase => ({
    ...phase,
    topics: phase.topics.map(topic => {
      const p = progress.find(item => item.topicId === topic.id)
      return {
        ...topic,
        progress: p || emptyProgress()
      }
    })
  }))

  const topics = curriculum.phases.flatMap((phase) => phase.topics)
  const statusMap = toStatusMap(progress)
  const dueReviews = await getDueReviews(session.user.id, new Date().toISOString())
  const today = todayPick(topics, statusMap, dueReviews.length, dueReviews[0]?.topicId)

  return NextResponse.json({
    curriculum: {
      ...curriculum,
      phases: phasesWithProgress
    },
    today,
    stats: progressStats(topics, statusMap),
  })
}

export async function POST(request: Request) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { topicId, action } = await request.json() as { topicId?: string; action?: string }
  
  if (!topicId || !action) {
    return NextResponse.json({ error: 'topicId and action required' }, { status: 400 })
  }

  const knownTopic = dsaFoundations.phases.flatMap((phase) => phase.topics).some((topic) => topic.id === topicId)
  if (!knownTopic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  if (action === 'start') {
    await startTopic(session.user.id, topicId)
    return NextResponse.json({ success: true })
  }

  if (action === 'complete') {
    await completeTopic(session.user.id, topicId)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
