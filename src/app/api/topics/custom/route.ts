import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getCustomTopics, createCustomTopic } from '@/lib/db'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/topics/custom — list the signed-in user's custom topics.
 * POST /api/topics/custom — create a custom topic { title, description, why, objectives, estimatedMinutes }.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    const topics = await getCustomTopics(session.user.id)
    return NextResponse.json({ topics })
  } catch (error) {
    console.error('Custom topics list error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to list topics'), { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(errorBody('BAD_JSON', 'body must be valid JSON'), { status: 400 })
    }

    const title = String(body.title ?? '').trim()
    const description = String(body.description ?? '').trim()
    const why = String(body.why ?? '').trim()
    const objectives = Array.isArray(body.objectives) ? body.objectives.map(String).filter(Boolean) : []
    const estimatedMinutes = Number(body.estimatedMinutes ?? 30)

    if (!title) {
      return NextResponse.json(errorBody('BAD_REQUEST', 'title is required'), { status: 400 })
    }
    if (!objectives.length) {
      return NextResponse.json(errorBody('BAD_REQUEST', 'at least one objective is required'), { status: 400 })
    }

    const id = `custom-${Date.now().toString(36)}`
    const topic = {
      id,
      userId: session.user.id,
      title,
      description,
      why,
      objectives,
      estimatedMinutes,
    }
    await createCustomTopic(topic)
    return NextResponse.json({ topic }, { status: 201 })
  } catch (error) {
    console.error('Custom topic create error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to create topic'), { status: 500 })
  }
}