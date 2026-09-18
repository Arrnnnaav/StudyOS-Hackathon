// E2E verification of the new StudyOS AI/learning features.
// 1) All pages render 200 on the running production server.
// 2) New API routes enforce auth (401 without a session).
// 3) Direct DB/module-level verification of custom topics + quiz evidence.
process.env.DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8001'
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_ACCESS_KEY_ID = 'dummy'
process.env.AWS_SECRET_ACCESS_KEY = 'dummy'

const BASE = 'http://localhost:3000'
let failures = 0
function check(name, cond, detail = '') {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''))
  if (!cond) failures++
}

// --- 1) Page routes ---
const pages = [
  '/', '/auth/signin', '/auth/onboarding', '/dashboard/today', '/dashboard/roadmap',
  '/dashboard/review', '/dashboard/topics', '/dashboard/topics/binary-search',
  '/dashboard/progress', '/dashboard/settings', '/dashboard/custom-topics',
]
for (const p of pages) {
  try {
    const res = await fetch(BASE + p)
    check(`page ${p}`, res.status === 200, `http ${res.status}`)
  } catch (e) {
    check(`page ${p}`, false, e.message)
  }
}

// --- 2) New API auth gating ---
async function gate(path, opts) {
  const res = await fetch(BASE + path, opts)
  return res.status
}
check('/api/coverage/check no-auth → 401', (await gate('/api/coverage/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic_id: 'binary-search', content: 'x' }) })) === 401)
check('/api/spatial/ask no-auth → 401', (await gate('/api/spatial/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'why', marks: [{ x: 1, y: 1, width: 5, height: 5, type: 'rectangle', role: 'reference' }] }) })) === 401)
check('/api/topics/custom GET no-auth → 401', (await gate('/api/topics/custom')) === 401)
check('/api/topics/custom POST no-auth → 401', (await gate('/api/topics/custom', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x', objectives: ['a'] }) })) === 401)
check('/api/topics/binary-search/quiz GET no-auth → 401', (await gate('/api/topics/binary-search/quiz')) === 401)
check('/api/auth/adopt no-auth → 401', (await gate('/api/auth/adopt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device_id: 'dev-x' }) })) === 401)

// --- 3) Direct module-level verification of the new logic against local DB ---
const { createUser, createCustomTopic, getCustomTopics, deleteCustomTopic, recordDeviceUser, getDeviceUser } = await import('../src/lib/db.ts')
const { generateQuiz, scoreAttempt } = await import('../src/shared/quiz.ts')
const { classifyCoverage } = await import('../src/shared/coverage.ts')

const uid = 'user-feature-' + Date.now()
await createUser({ id: uid, email: 'feature@test.com', name: 'F', image: null, year: 2, activeTrack: 'dsa-foundations' })

// custom topics round-trip
await createCustomTopic({ id: 'ct1', userId: uid, title: 'My Topic', description: 'd', why: 'w', objectives: ['a', 'b'], estimatedMinutes: 30 })
const ct = await getCustomTopics(uid)
check('custom topic created + listed', ct.some(t => t.id === 'ct1'))
await deleteCustomTopic(uid, 'ct1')
const ct2 = await getCustomTopics(uid)
check('custom topic deleted', !ct2.some(t => t.id === 'ct1'))

// device adopt mapping
await recordDeviceUser('dev-e2e', uid)
check('device→user mapping stored', (await getDeviceUser('dev-e2e'))?.userId === uid)

// quiz generator + scoring
const q = generateQuiz(['Explain binary search', 'Implement lower bound'])
check('quiz generator returns questions', Array.isArray(q) && q.length === 2 && Array.isArray(q[0].options))
const scored = scoreAttempt([0, 0], q)
check('quiz scoring works', typeof scored.percent === 'number' && scored.total === 2)

// coverage offline classifier
const cov = classifyCoverage(['Implement lower and upper bound variants'], 'To implement lower bound, return the first index where the value is not smaller than the target. The upper bound returns the first index strictly greater.')
check('coverage classifier returns statuses', Array.isArray(cov) && typeof cov[0].status === 'string')

console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)