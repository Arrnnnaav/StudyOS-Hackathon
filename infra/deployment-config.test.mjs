import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const rootFile = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('ECS release assets build a Node 22 container and expose the app port', () => {
  assert.equal(existsSync(new URL('../Dockerfile', import.meta.url)), true)
  assert.equal(existsSync(new URL('../.dockerignore', import.meta.url)), true)
  const dockerfile = rootFile('Dockerfile')
  assert.match(dockerfile, /FROM node:22-/)
  assert.match(dockerfile, /EXPOSE 3000/)
  assert.match(dockerfile, /pnpm build/)
  assert.match(dockerfile, /pnpm", "start/)
})

test('main-branch CI validates before an OIDC-backed ECS Express deployment', () => {
  assert.equal(existsSync(new URL('../.github/workflows/deploy.yml', import.meta.url)), true)
  const workflow = rootFile('.github/workflows/deploy.yml')
  assert.match(workflow, /branches: \[main\]/)
  assert.match(workflow, /pnpm test/)
  assert.match(workflow, /pnpm exec tsc --noEmit/)
  assert.match(workflow, /pnpm build/)
  assert.match(workflow, /id-token: write/)
  assert.match(workflow, /amazon-ecr-login/)
  assert.match(workflow, /amazon-ecs-deploy-express-service/)
  assert.doesNotMatch(workflow, /GEMINI_API_KEY=.+/)
})

test('load balancer health endpoint is an unauthenticated ok route', () => {
  const route = rootFile('src/app/api/health/route.ts')
  assert.match(route, /export function GET\(\)/)
  assert.match(route, /NextResponse\.json\(\{ status: 'ok' \}\)/)
})
