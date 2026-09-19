import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessOrganization,
  isMasterAdminEmail,
  organizationTodayPick,
} from './organization.ts'

test('master email matching is normalized and never inferred from a domain', () => {
  assert.equal(isMasterAdminEmail(' Arnav@StudyOS.dev ', 'arnav@studyos.dev, owner@example.com'), true)
  assert.equal(isMasterAdminEmail('student@studyos.dev', 'arnav@studyos.dev'), false)
  assert.equal(isMasterAdminEmail(null, 'arnav@studyos.dev'), false)
})

test('organization admin access is limited to the organization in membership', () => {
  assert.equal(canAccessOrganization({ kind: 'organization_admin', organizationId: 'org-a' }, 'org-a'), true)
  assert.equal(canAccessOrganization({ kind: 'organization_admin', organizationId: 'org-a' }, 'org-b'), false)
  assert.equal(canAccessOrganization({ kind: 'student', organizationId: 'org-a' }, 'org-a'), false)
  assert.equal(canAccessOrganization({ kind: 'master_admin' }, 'org-b'), true)
})

test('Today keeps reviews first, then resumes active assignments before the next assignment', () => {
  const assignments = [
    { id: 'assigned-1', title: 'Pointers', estimatedMinutes: 45, status: 'not_started' as const },
    { id: 'assigned-2', title: 'Graphs', estimatedMinutes: 60, status: 'in_progress' as const },
  ]

  assert.deepEqual(organizationTodayPick(2, assignments), { kind: 'review' })
  assert.deepEqual(organizationTodayPick(0, assignments), { kind: 'assigned_topic', topicId: 'assigned-2', continued: true })
})

test('Today chooses the next assigned topic before the personal curriculum fallback', () => {
  const assignments = [{ id: 'assigned-1', title: 'Pointers', estimatedMinutes: 45, status: 'not_started' as const }]
  assert.deepEqual(organizationTodayPick(0, assignments), { kind: 'assigned_topic', topicId: 'assigned-1', continued: false })
  assert.deepEqual(organizationTodayPick(0, []), { kind: 'personal_curriculum' })
})
