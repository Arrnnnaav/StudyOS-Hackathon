import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { deleteCustomTopic } from '@/lib/db'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/topics/custom/[id] — remove one of the signed-in user's custom topics.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    const { id } = await params
    if (!id) return NextResponse.json(errorBody('BAD_REQUEST', 'topic id is required'), { status: 400 })
    await deleteCustomTopic(session.user.id, id)
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('Custom topic delete error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to delete topic'), { status: 500 })
  }
}