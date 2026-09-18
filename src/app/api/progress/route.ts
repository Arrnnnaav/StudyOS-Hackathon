import { auth } from '@/lib/auth'
import { getUserProgress, startTopic, completeTopic } from '@/lib/db'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { NextResponse } from 'next/server'

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
        progress: p || {
          status: 'not_started',
          startedAt: null,
          completedAt: null,
          timeSpentMin: 0,
          resourceCompleted: false,
          questionsAsked: 0,
          helpfulAnswers: 0,
          reviewsCompleted: 0
        }
      }
    })
  }))

  // Compute today's action
  const today = computeToday(phasesWithProgress)

  return NextResponse.json({
    curriculum: {
      ...curriculum,
      phases: phasesWithProgress
    },
    today
  })
}

function computeToday(phases: any[]) {
  // Find first review due (would need reviews table)
  // For now, find first incomplete topic with prerequisites met
  
  const completedTopics = new Set()
  const inProgressTopic = phases.flatMap(p => p.topics).find(t => t.progress.status === 'in_progress')
  
  phases.forEach(p => {
    p.topics.forEach((t: any) => {
      if (t.progress.status === 'done') completedTopics.add(t.id)
    })
  })

  if (inProgressTopic) {
    return {
      type: 'continue',
      topic: inProgressTopic,
      reason: 'Continue where you left off'
    }
  }

  for (const phase of phases) {
    for (const topic of phase.topics) {
      if (topic.progress.status !== 'done') {
        const prereqsMet = topic.prerequisites.every((p: string) => completedTopics.has(p))
        if (prereqsMet) {
          return {
            type: 'next',
            topic,
            reason: `Prerequisites met. This is the next topic in your roadmap.`
          }
        }
      }
    }
  }

  return {
    type: 'complete',
    reason: 'All topics completed! 🎉'
  }
}

export async function POST(request: Request) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { topicId, action } = await request.json()
  
  if (!topicId || !action) {
    return NextResponse.json({ error: 'topicId and action required' }, { status: 400 })
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