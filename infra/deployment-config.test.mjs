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
  assert.match(workflow, /uses: pnpm\/action-setup@v4[\s\S]*?version: 12\.4\.2[\s\S]*?uses: actions\/setup-node@v4[\s\S]*?cache: pnpm/)
  assert.doesNotMatch(workflow, /corepack prepare/)
  assert.match(workflow, /pnpm test/)
  assert.match(workflow, /pnpm exec tsc --noEmit/)
  assert.match(workflow, /pnpm build/)
  assert.match(workflow, /id-token: write/)
  assert.match(workflow, /amazon-ecr-login/)
  assert.match(workflow, /amazon-ecs-deploy-express-service/)
  assert.doesNotMatch(workflow, /GEMINI_API_KEY=.+/)
})

test('ECS Express deployment has the required roles and server-side runtime secret wiring', () => {
  const template = rootFile('infra/template.yaml')
  const workflow = rootFile('.github/workflows/deploy.yml')

  assert.match(template, /EcsTaskExecutionRole:/)
  assert.match(template, /EcsTaskApplicationRole:/)
  assert.match(template, /EcsExpressInfrastructureRole:/)
  assert.match(template, /GitHubActionsDeployRole:/)
  assert.match(template, /GitHubOidcProvider:/)
  assert.match(template, /RuntimeConfigSecret:/)
  assert.match(template, /AmazonECSTaskExecutionRolePolicy/)
  assert.match(template, /AmazonECSInfrastructureRoleforExpressGatewayServices/)
  assert.match(template, /token\.actions\.githubusercontent\.com/)
  assert.match(template, /RuntimeSecretArn:/)

  assert.match(workflow, /execution-role-arn: \$\{\{ vars\.ECS_TASK_EXECUTION_ROLE_ARN \}\}/)
  assert.match(workflow, /infrastructure-role-arn: \$\{\{ vars\.ECS_INFRASTRUCTURE_ROLE_ARN \}\}/)
  assert.match(workflow, /task-role-arn: \$\{\{ vars\.ECS_TASK_ROLE_ARN \}\}/)
  assert.match(workflow, /vars\.RUNTIME_SECRET_ARN/)
  assert.match(workflow, /NVIDIA_NIM_API_KEY/)
  assert.doesNotMatch(workflow, /environment: production/)
})

test('load balancer health endpoint is an unauthenticated ok route', () => {
  const route = rootFile('src/app/api/health/route.ts')
  assert.match(route, /export function GET\(\)/)
  assert.match(route, /NextResponse\.json\(\{ status: 'ok' \}\)/)
})
