import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { recordDeviceUser, adoptAnonymousData } from '@/lib/db'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/adopt — merge anonymous usage into the signed-in account.
 * Body: { device_id }. The extension / web app captures a random device id
 * BEFORE sign-up; on this call any anonymized asks/progress under
 * anon-<device_id> move onto the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    }

    let deviceId: string
    try {
      const body = await request.json()
      deviceId = String(body?.device_id ?? '').trim()
    } catch {
      return NextResponse.json(errorBody('BAD_JSON', 'body must be valid JSON'), { status: 400 })
    }

    if (!deviceId || deviceId.length > 128) {
      return NextResponse.json(errorBody('BAD_REQUEST', 'device_id is required'), { status: 400 })
    }

    await adoptAnonymousData(deviceId, session.user.id)
    await recordDeviceUser(deviceId, session.user.id)

    return NextResponse.json({ success: true, adopted: true })
  } catch (error) {
    console.error('Adopt error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to adopt anonymous data'), { status: 500 })
  }
}