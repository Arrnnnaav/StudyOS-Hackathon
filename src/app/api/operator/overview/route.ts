import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { TABLES } from '@/lib/db'
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is operator (in production, use Cognito groups or custom claims)
    // For hackathon, allow specific email
    const operatorEmails = ['admin@studyos.dev', 'arnav@studyos.dev']
    if (!operatorEmails.includes(session.user?.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get metrics from events table (last 7 days)
    const events = await getRecentEvents(7)
    
    const metrics = computeMetrics(events)

    return NextResponse.json(metrics)

  } catch (error) {
    console.error('Operator overview error:', error)
    return NextResponse.json({ error: 'Failed to get metrics' }, { status: 500 })
  }
}

async function getRecentEvents(days: number) {
  const items: any[] = []
  const end = new Date()
  
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const bucket = d.toISOString().split('T')[0]
    
    const result = await db.send(new QueryCommand({
      TableName: 'StudyOSEvents',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `DAY#${bucket}` }
    }))
    items.push(...(result.Items || []))
  }
  return items
}

function computeMetrics(events: any[]) {
  const users = new Set(events.map(e => e.userId).filter(Boolean))
  const studentUsers = Array.from(users).filter(u => !u.startsWith('anon-'))
  
  const signupEvents = events.filter(e => e.eventName === 'signup_completed')
  const onboardingEvents = events.filter(e => e.eventName === 'onboarding_completed')
  const firstTopicEvents = events.filter(e => e.eventName === 'topic_started')
  const askEvents = events.filter(e => e.eventName === 'point_ask_submitted')
  const successfulAsks = askEvents.filter(e => e.properties.success !== false)
  const helpfulEvents = events.filter(e => e.eventName === 'answer_helpful')
  const notHelpfulEvents = events.filter(e => e.eventName === 'answer_not_helpful')
  const reviewSaves = events.filter(e => e.eventName === 'review_saved')
  
  const registeredStudents = studentUsers.length
  const activatedStudents = new Set(onboardingEvents.map(e => e.userId)).size
  
  const askLatencies = askEvents
    .map(e => e.properties.latencyMs)
    .filter((l): l is number => typeof l === 'number')
  
  const domainCounts = new Map<string, number>()
  const topicCounts = new Map<string, number>()
  
  askEvents.forEach(e => {
    if (e.domain) domainCounts.set(e.domain, (domainCounts.get(e.domain) || 0) + 1)
    if (e.topicId) topicCounts.set(e.topicId, (topicCounts.get(e.topicId) || 0) + 1)
  })

  return {
    registeredStudents,
    activatedStudents,
    totalAsks: askEvents.length,
    askSuccessRate: askEvents.length > 0 ? successfulAsks.length / askEvents.length : 0,
    helpfulRate: (helpfulEvents.length + notHelpfulEvents.length) > 0 
      ? helpfulEvents.length / (helpfulEvents.length + notHelpfulEvents.length) 
      : 0,
    reviewSaveRate: askEvents.length > 0 ? reviewSaves.length / askEvents.length : 0,
    avgAskLatencyMs: askLatencies.length > 0 
      ? Math.round(askLatencies.reduce((a, b) => a + b, 0) / askLatencies.length) 
      : 0,
    topDomains: Array.from(domainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topTopics: Array.from(topicCounts.entries())
      .map(([topicId, count]) => ({ topicId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    funnel: {
      signup: signupEvents.length,
      onboarding: onboardingEvents.length,
      firstTopic: firstTopicEvents.length,
      firstAsk: new Set(askEvents.map(e => e.userId)).size,
      reviewSave: reviewSaves.length,
      reviewComplete: events.filter(e => e.eventName === 'review_completed').length
    },
    recentErrors: events
      .filter(e => e.eventName === 'point_ask_failed')
      .slice(-10)
      .map(e => ({
        errorCode: e.properties.errorCode || 'UNKNOWN',
        errorType: e.properties.error || 'Unknown',
        timestamp: e.timestamp
      }))
  }
}