import { randomUUID } from 'node:crypto'
import { trackEvent } from '@/lib/db'

/** Audit privileged organization changes without exposing student private learning data. */
export async function auditOrganizationAction(
  userId: string,
  eventName: string,
  organizationId: string,
  properties: Record<string, unknown> = {},
) {
  try {
    await trackEvent({
      eventId: randomUUID(),
      eventName,
      timestamp: new Date().toISOString(),
      userId,
      sessionId: `organization:${organizationId}`,
      topicId: null,
      domain: null,
      properties: { organizationId, ...properties },
    })
  } catch (error) {
    // An audit write must not make an otherwise valid onboarding/publishing action fail.
    console.error('organization audit write failed', error)
  }
}
