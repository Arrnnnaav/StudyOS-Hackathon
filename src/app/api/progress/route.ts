import { auth } from '@/lib/auth'
import { getDueReviews, getUserProgress, startTopic, completeTopic } from '@/lib/db'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { NextResponse } from 'next/server'
import { progressStats, todayPick, toStatusMap } from '@/shared/today'
import type { TopicProgress } from '@/shared/contracts'
import { getOrganizationMembership, getOrganizationTopics } from '@/lib/organization-db'
import { organizationTodayPick } from '@/shared/organization'

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
  const membership = await getOrganizationMembership(session.user.id)
  const assignedTopics = membership
    ? (await getOrganizationTopics(membership.organizationId, 'published')).filter((topic) => topic.deliveryMode === 'assigned')
    : []
  const organizationPick = organizationTodayPick(dueReviews.length, assignedTopics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    estimatedMinutes: topic.estimatedMinutes,
    status: (statusMap[`org:${membership?.organizationId}:${topic.id}`] === 'in_progress' ? 'in_progress' : statusMap[`org:${membership?.organizationId}:${topic.id}`] === 'done' ? 'done' : 'not_started') as 'not_started' | 'in_progress' | 'done',
  })))
  const today = organizationPick.kind === 'assigned_topic'
    ? {
        kind: 'organization_topic' as const,
        topic: assignedTopics.find((topic) => topic.id === organizationPick.topicId)!,
        continued: organizationPick.continued,
        whyNow: organizationPick.continued ? 'This organization-assigned topic is already in progress — keep the momentum.' : 'Your organization assigned this topic. It is your next recommended learning action.',
      }
    : todayPick(topics, statusMap, dueReviews.length, dueReviews[0]?.topicId)

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
  const membership = knownTopic ? null : await getOrganizationMembership(session.user.id)
  const organizationTopic = membership ? (await getOrganizationTopics(membership.organizationId, 'published')).find((topic) => topic.id === topicId && topic.deliveryMode === 'assigned') : undefined
  const persistedTopicId = organizationTopic ? `org:${membership!.organizationId}:${topicId}` : topicId
  if (!knownTopic && !organizationTopic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  if (action === 'start') {
    await startTopic(session.user.id, persistedTopicId)
    return NextResponse.json({ success: true })
  }

  if (action === 'complete') {
    await completeTopic(session.user.id, persistedTopicId)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
