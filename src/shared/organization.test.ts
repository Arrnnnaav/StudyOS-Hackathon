import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canAccessOrganization,
  actorFromIdentity,
  isMasterAdminEmail,
  organizationTodayPick,
  organizationCohortProgress,
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

test('master allowlist overrides membership and other users inherit their membership role', () => {
  assert.deepEqual(actorFromIdentity('owner@studyos.dev', 'owner@studyos.dev', { organizationId: 'org-a', role: 'student' }), { kind: 'master_admin' })
  assert.deepEqual(actorFromIdentity('teacher@studyos.dev', 'owner@studyos.dev', { organizationId: 'org-a', role: 'organization_admin' }), { kind: 'organization_admin', organizationId: 'org-a' })
  assert.equal(actorFromIdentity('student@studyos.dev', 'owner@studyos.dev', undefined), null)
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

test('cohort progress reports only organization assignment rows for each student', () => {
  const progress = organizationCohortProgress(
    [
      { userId: 'admin-1', role: 'organization_admin' as const },
      { userId: 'student-1', role: 'student' as const },
      { userId: 'student-2', role: 'student' as const },
    ],
    {
      'student-1': [
        { topicId: 'org:club-1:arrays', status: 'done' },
        { topicId: 'org:club-1:trees', status: 'in_progress' },
        { topicId: 'binary-search', status: 'done' },
      ],
      'student-2': [{ topicId: 'org:other:arrays', status: 'done' }],
    },
    'club-1',
  )

  assert.deepEqual(progress, [
    { userId: 'student-1', completedTopics: 1, activeTopics: 1 },
    { userId: 'student-2', completedTopics: 0, activeTopics: 0 },
  ])
})
