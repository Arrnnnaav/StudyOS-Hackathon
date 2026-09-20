import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const routeFiles = [
  'src/app/api/ask/route.ts',
  'src/app/api/ask/stream/route.ts',
  'src/app/api/coverage/check/route.ts',
  'src/app/api/spatial/ask/route.ts',
]

test('all live AI routes use the Gemini provider boundary instead of Bedrock', async () => {
  for (const file of routeFiles) {
    const source = await readFile(new URL(file, root), 'utf8')
    assert.match(source, /@\/lib\/ai/)
    assert.doesNotMatch(source, /@\/lib\/bedrock/)
  }
})

test('example configuration makes Gemini the active live provider', async () => {
  const env = await readFile(new URL('.env.example', root), 'utf8')
  assert.match(env, /^GEMINI_API_KEY=/m)
  assert.match(env, /^GEMINI_MODEL=gemini-3\.6-flash$/m)
  assert.match(env, /^BEDROCK_WEB_SEARCH_ENABLED=false$/m)
})

test('public product copy does not claim blocked Bedrock is generating answers', async () => {
  for (const file of ['src/app/page.tsx', 'extension/manifest.json', 'extension/popup.html']) {
    const source = await readFile(new URL(file, root), 'utf8')
    assert.doesNotMatch(source, /AWS Bedrock/i)
    assert.match(source, /Gemini|grounded explanation/i)
  }
})

test('the app provides an extension privacy disclosure for Store submission', async () => {
  const policy = await readFile(new URL('src/app/privacy/page.tsx', root), 'utf8')
  assert.match(policy, /selected text/i)
  assert.match(policy, /server-side/i)
  assert.match(policy, /Gemini/i)
  assert.match(policy, /Normal Ask/i)
  assert.match(policy, /previous questions and answers/i)
})
