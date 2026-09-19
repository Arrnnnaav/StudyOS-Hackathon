import { auth } from '@/lib/auth'
import { getUserProgress, getTopicProgress } from '@/lib/db'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { NextResponse } from 'next/server'
import { evidenceLabel, prerequisitesDone, toStatusMap } from '@/shared/today'
import type { Topic, } from '@/data/dsa-curriculum'
import type { TopicProgress } from '@/shared/contracts'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topicId } = await params
    
    // Find topic in curriculum
    const phaseIndex = dsaFoundations.phases.findIndex((phase) => phase.topics.some((topic) => topic.id === topicId))
    const topicIndex = phaseIndex < 0 ? -1 : dsaFoundations.phases[phaseIndex].topics.findIndex((topic) => topic.id === topicId)
    const topic: Topic | undefined = phaseIndex < 0 ? undefined : dsaFoundations.phases[phaseIndex].topics[topicIndex]

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Get user progress for this topic
    const storedProgress = await getTopicProgress(session.user.id, topicId) as Partial<TopicProgress> | undefined
    const progress = storedProgress ?? {
      status: 'not_started',
      startedAt: null,
      completedAt: null,
      timeSpentMin: 0,
      resourceCompleted: false,
      questionsAsked: 0,
      helpfulAnswers: 0,
      reviewsCompleted: 0
    }

    // Compute evidence label
    const label = evidenceLabel({
      status: progress.status ?? 'not_started',
      questionsAsked: progress.questionsAsked ?? 0,
      reviewsCompleted: progress.reviewsCompleted ?? 0,
    })

    // Check prerequisites
    const userProgress = await getUserProgress(session.user.id)
    const prerequisitesMet = prerequisitesDone(topic, toStatusMap(userProgress))

    return NextResponse.json({
      topic: {
        ...topic,
        progress,
        evidenceLabel: label,
        prerequisitesMet
      },
      phaseIndex,
      topicIndex
    })

  } catch (error) {
    console.error('Get topic error:', error)
    return NextResponse.json({ error: 'Failed to get topic' }, { status: 500 })
  }
}
