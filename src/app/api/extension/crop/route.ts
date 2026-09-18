import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { putCrop, cropsConfigured } from '@/lib/s3'
import { errorBody } from '@/shared/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CROP = 16 * 1024 * 1024 // 16 MB

/**
 * POST /api/extension/crop — persist a captured Point & Ask crop to S3.
 * Body: { image: <data-url or base64>, page_url }. Returns the S3 key.
 * Web + extension token flows are both accepted via the shared resolver.
 */
export async function POST(request: Request) {
  try {
    // Accept either the web session or an extension token.
    let userId: string | null = null
    const session = await auth()
    if (session?.user?.id) userId = session.user.id
    if (!userId) {
      // Try extension token from body via the shared resolver.
      const { resolveApiUser } = await import('@/lib/auth-utils')
      const body = await request.json().catch(() => null)
      const user = body ? await resolveApiUser(body as Record<string, unknown>) : null
      if (user) userId = user.userId
    }
    if (!userId) {
      return NextResponse.json(errorBody('UNAUTHORIZED', 'authentication required'), { status: 401 })
    }

    if (!cropsConfigured()) {
      return NextResponse.json(errorBody('NOT_CONFIGURED', 'S3 crops are not configured on this deployment'), { status: 503 })
    }

    const body = await request.json().catch(() => null)
    const image = String(body?.image ?? '')
    if (!image || image.length > MAX_CROP) {
      return NextResponse.json(errorBody('BAD_REQUEST', 'image (data URL) is required and under 16MB'), { status: 400 })
    }

    const { key } = await putCrop(userId, image)
    return NextResponse.json({ key })
  } catch (error) {
    console.error('Crop upload error:', error)
    return NextResponse.json(errorBody('INTERNAL', 'Failed to store crop'), { status: 500 })
  }
}