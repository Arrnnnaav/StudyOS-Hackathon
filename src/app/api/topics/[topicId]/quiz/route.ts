import { NextResponse } from 'next/server'
import { dsaFoundations } from '@/data/dsa-curriculum'
import { auth } from '@/lib/auth'
import { recordQuestionAsked } from '@/lib/db'
import { generateQuiz, scoreAttempt } from '@/shared/quiz'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function findTopic(topicId: string) {
  for (const phase of dsaFoundations.phases) {
    for (const t of phase.topics) {
      if (t.id === topicId) return t
    }
  }
  return null
}

/**
 * GET /api/topics/[topicId]/quiz — return the generated quiz (no auth needed to
 * fetch a quiz, but we require a session to keep it consistent).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ topicId: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    const { topicId } = await params
    const topic = findTopic(topicId)
    if (!topic) return NextResponse.json(errorBody('NOT_FOUND', 'topic not found'), { status: 404 })
    return NextResponse.json({ quiz: generateQuiz(topic.objectives) })
  } catch (error) {
    console.error('Quiz GET error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to load quiz'), { status: 500 })
  }
}

/**
 * POST /api/topics/[topicId]/quiz — submit answers, record evidence.
 * Body: { answers: number[] } (index per question).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    const { topicId } = await params
    const topic = findTopic(topicId)
    if (!topic) return NextResponse.json(errorBody('NOT_FOUND', 'topic not found'), { status: 404 })

    let answers: number[]
    try {
      const body = await request.json()
      answers = Array.isArray(body?.answers) ? body.answers.map(Number) : []
    } catch {
      return NextResponse.json(errorBody('BAD_JSON', 'body must be valid JSON'), { status: 400 })
    }

    const quiz = generateQuiz(topic.objectives)
    const result = scoreAttempt(answers, quiz)

    // Record evidence (questionsAsked +1, helpful if passed). UpdateCommand creates
    // the progress row if it doesn't exist.
    await recordQuestionAsked(session.user.id, topicId, result.passed)

    return NextResponse.json({ topic_id: topicId, ...result })
  } catch (error) {
    console.error('Quiz POST error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to submit quiz'), { status: 500 })
  }
}