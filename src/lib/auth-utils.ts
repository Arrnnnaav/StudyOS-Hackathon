import { auth } from '@/lib/auth'
import { getExtensionToken } from '@/lib/db'

/**
 * Resolves the authenticated user for an API request, supporting both the
 * NextAuth web session and the opaque beta extension session token.
 *
 * The extension sends its token as `extension_session_token` (matching how
 * `/api/ask` consumes it).
 */
export async function resolveApiUser(body: Record<string, unknown>): Promise<{ userId: string } | null> {
  // Extension token path
  const token = typeof body.extension_session_token === 'string'
    ? body.extension_session_token
    : null
  if (token) {
    const tokenData = await getExtensionToken(token)
    if (tokenData && new Date(tokenData.expiresAt) > new Date()) {
      return { userId: tokenData.userId }
    }
    return null
  }

  // Web NextAuth session path
  const session = await auth()
  if (session?.user?.id) {
    return { userId: session.user.id }
  }

  return null
}