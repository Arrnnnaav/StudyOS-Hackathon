import { auth } from '@/lib/auth'
import { getUserProgress, getTopicProgress, recordQuestionAsked } from '@/lib/db'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topicId } = await params
    
    // Find topic in curriculum
    let topic: any = null
    let phaseIndex = -1
    let topicIndex = -1
    
    dsaFoundations.phases.forEach((phase, pIdx) => {
      phase.topics.forEach((t, tIdx) => {
        if (t.id === topicId) {
          topic = t
          phaseIndex = pIdx
          topicIndex = tIdx
        }
      })
    })

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Get user progress for this topic
    const progress = await getTopicProgress(session.user.id, topicId) || {
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
    const evidenceLabel = computeEvidenceLabel(progress)

    // Check prerequisites
    const userProgress = await getUserProgress(session.user.id) // would need all progress
    const completedTopics = new Set() // Would come from userProgress
    
    const prerequisitesMet = topic.prerequisites.every((p: string) => completedTopics.has(p))

    return NextResponse.json({
      topic: {
        ...topic,
        progress,
        evidenceLabel,
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

function computeEvidenceLabel(progress: any): 'No Evidence' | 'Started' | 'Developing' | 'Reviewed' {
  if (progress.status === 'not_started' && progress.questionsAsked === 0) {
    return 'No Evidence'
  }
  if (progress.status === 'in_progress' || progress.questionsAsked > 0) {
    return 'Developing'
  }
  if (progress.status === 'done' && progress.reviewsCompleted === 0) {
    return 'Developing'
  }
  if (progress.reviewsCompleted > 0) {
    return 'Reviewed'
  }
  return 'No Evidence'
}