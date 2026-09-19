# StudyOS — AWS First Commit Hackathon

> Know what to learn today. Understand what stops you. Remember what matters.

StudyOS is a learning workflow for engineering students: choose a track, get a prerequisite-aware next action, ask a grounded question about selected code or text, and save the answer for spaced review.

## What is built

- Google OAuth through NextAuth, with DynamoDB-backed user data and anonymous-device adoption after sign-in.
- A DSA Foundations track: 14 topics, curated watch/read/practice resources, prerequisite-aware Today view, topic progress, custom topics, and per-topic quizzes.
- A Chrome MV3 side panel with pairing, text selection, and rectangle-based spatial Point & Ask (`Alt` + `Shift` + `A`). It sends selected/nearby context, never a full page or screenshot by default.
- Grounded Bedrock answers, helpful/not-helpful feedback, saved review cards, and Again/Good spaced-repetition scheduling.
- Resource Coverage Lite, event tracking, and an operator overview.
- A safe Ask pipeline: idempotency, daily per-user quota, streaming, short conversation context, and model routing.
- A three-level organization hierarchy: bootstrapped Master Admins, scoped Organization Admins, and Students. Admins can invite/manage one cohort, publish structured topics, and see only organization-assignment progress.

## Demo flow

1. Sign in with Google and choose Year 2 / DSA Foundations.
2. Open **Today** and begin the next prerequisite-ready topic.
3. On a page containing code or study material, press `Alt` + `Shift` + `A`, draw a rectangle, and ask a question.
4. Watch the grounded answer stream into the extension side panel.
5. Mark it helpful and save it to the review queue.
6. Complete the review with Again or Good to schedule the next repetition.

## Architecture

### Production path — one backend story

```text
Web app / Chrome extension
          |
          v
AWS App Runner — Next.js 16 route handlers
  |       |             |
  |       |             +--> Amazon Bedrock
  |       +----------------> DynamoDB
  +------------------------> S3 private crop storage
                              |
                              v
                         CloudWatch logs
```

The real production API is the Next.js route-handler layer. There is no API Gateway or Lambda proxy in the request path. The extension calls the same `/api/*` endpoints as the web app.

**Hosting decision:** the repository uses Next.js `16.3.5`, so the Ship It target is **AWS App Runner on Node.js 22**. `apprunner.yaml` is the source-repository deployment configuration. Amplify is not the target for this branch because its published Next.js SSR compatibility documentation currently stops at v15.

### AWS resources

| Service | Role in StudyOS |
|---|---|
| App Runner | Hosts the Next.js 16 app and route handlers |
| DynamoDB | Users, progress, asks, reviews, events, extension pairing, Ask safety state, and organization membership/content |
| Bedrock | Claude 3.5 Haiku for Ask; Claude Sonnet 4.5 for Coverage Lite |
| S3 | Private Point & Ask crop storage with a seven-day lifecycle |
| CloudWatch | Application and deployment observability |
| IAM | Temporary credentials for the running App Runner service |
| Cognito | User pool provisioned by the stack for AWS-native identity evolution; the current web sign-in flow is Google OAuth through NextAuth |

`infra/template.yaml` provisions nine DynamoDB tables, including `StudyOSOrganizations`. `AppRunnerInstanceRoleArn` is attached to the App Runner service, so the application receives temporary AWS credentials; never place AWS access keys in App Runner environment variables.

## Organization administration

Roles are intentionally small and explicit:

| Role | Scope |
|---|---|
| Master Admin | Exact email allowlist in `MASTER_ADMIN_EMAILS`; creates organizations, appoints organization admins, can inspect all organization-only cohort progress, and can unpublish content. |
| Organization Admin | One organization; creates copyable student invites or rotating join codes, removes students, publishes topics, and sees only assigned-topic completion/active counts. |
| Student | At most one active organization; accepts one invite or join code, sees published library topics, and receives the next published assigned topic in **Today**. |

Organizations use signed single-use invite tokens (seven-day expiry) or rotating join codes; no outbound email service is required. Removing a student removes organization access but leaves that student’s personal learning history intact. Structured topics include description, objectives, estimated time, optional watch/read/practice resources, and a `library` or `assigned` delivery mode. Privileged organization actions are recorded as product audit events.

Set the master allowlist before deploying:

```text
MASTER_ADMIN_EMAILS=owner@example.com,another-owner@example.com
```

Do not use a company domain as an authorization rule. The future/enterprise ideas intentionally deferred from this hackathon scope are in [`docs/roadmaps/admin-hierarchy-future.md`](docs/roadmaps/admin-hierarchy-future.md).

## Ask reliability and cost controls

| Control | Behaviour |
|---|---|
| Idempotency | `/api/ask` and `/api/ask/stream` require an `Idempotency-Key` header or `idempotency_key` body value. Same request replays the stored answer; reused keys with different payloads return `409`. |
| Durable state | `StudyOSAskSafety` stores processing/completed requests and expires them by DynamoDB TTL. |
| Rate limit | Each user gets `ASK_DAILY_LIMIT` model-backed asks per UTC day (default `20`). Over-limit calls receive `429` and `Retry-After`. |
| Streaming | `/api/ask/stream` emits Server-Sent Events: `ready`, `token`, `complete`, and `error`. |
| Context | At most two prior asks from the same user, topic, and domain are included. Selected context remains primary. |
| Model routing | Point & Ask uses `anthropic.claude-3-5-haiku-20241022-v1:0`; Coverage Lite uses `global.anthropic.claude-sonnet-4-5-20250929-v1:0`. Both are environment-overridable. |

## Local development

### Prerequisites

- Node.js 20+
- pnpm 12 (Corepack is supported)
- Docker for DynamoDB Local
- A Google OAuth client for full sign-in testing

```powershell
git clone https://github.com/Arrnnnaav/StudyOS-Hackathon.git
cd StudyOS-Hackathon
corepack enable
pnpm install

Copy-Item .env.example .env.local

docker run -d --name dynamodb-local -p 8001:8000 amazon/dynamodb-local:latest -jar DynamoDBLocal.jar -sharedDb
$env:DYNAMODB_ENDPOINT = 'http://localhost:8001'
node scripts/create-tables.mjs

pnpm dev
```

Open `http://localhost:3000`. To load the extension, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `extension/`.

For local DynamoDB only, set dummy AWS SDK credentials in `.env.local`; App Runner must use its instance role instead.

## Deploy to AWS App Runner

### 1. Prepare AWS access

Do not share credentials in chat or commit them. Use AWS IAM Identity Center or another short-lived deployment role. The deployer needs permission to create the resources in `infra/template.yaml` (CloudFormation/SAM, IAM, DynamoDB, S3, Cognito, CloudWatch, and App Runner) and to enable the selected Bedrock models.

In Amazon Bedrock → Model catalog, enable access to the Ask and Coverage models for the chosen region. Use the same region for the SAM stack, App Runner service, and Bedrock configuration.

### 2. Deploy the infrastructure

```powershell
cd infra
sam build
sam deploy --guided --capabilities CAPABILITY_NAMED_IAM
```

Record the `AppRunnerInstanceRoleArn` stack output. This repository cannot claim a deployed URL until this command succeeds with your AWS account.

### 3. Create the App Runner service

1. App Runner console → **Create service** → **Source code repository** → select this repository.
2. Choose **Configuration source: Repository**. App Runner reads `apprunner.yaml` from the repository root.
3. Attach `AppRunnerInstanceRoleArn` as the service **instance role**.
4. Add the runtime variables below; store secrets in App Runner/Secrets Manager.
5. Deploy, then point the Chrome extension API base URL at the resulting App Runner URL.

```text
AWS_REGION=<same region as the SAM stack>
AUTH_TRUST_HOST=true
NEXTAUTH_URL=https://<app-runner-service-url>
NEXTAUTH_SECRET=<new random 32-byte secret>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
BEDROCK_ASK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
BEDROCK_COVERAGE_MODEL_ID=global.anthropic.claude-sonnet-4-5-20250929-v1:0
ASK_DAILY_LIMIT=20
ASK_IDEMPOTENCY_TTL_SECONDS=86400
MASTER_ADMIN_EMAILS=<comma-separated exact admin emails>
```

Add this Google OAuth redirect URI after the App Runner URL exists:

```text
https://<app-runner-service-url>/api/auth/callback/google
```

Do **not** configure `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in App Runner. The instance role provides temporary credentials to the AWS SDK.

## API surface

| Route group | Purpose |
|---|---|
| `/api/ask`, `/api/ask/stream` | Contextual Ask with durable replay, quota, streaming, persistence, and model routing |
| `/api/spatial/ask` | Rectangle/anchor-based Point & Ask resolution |
| `/api/ask/feedback`, `/api/ask/save-review` | Feedback and spaced-review conversion |
| `/api/coverage/check` | Coverage Lite analysis |
| `/api/progress`, `/api/reviews`, `/api/topics/*` | Learning progress, reviews, quiz evidence, and custom topics |
| `/api/extension/*` | Pairing, token flow, and crop upload |
| `/api/events`, `/api/operator/overview` | Product events and operator reporting |
| `/api/organization`, `/api/admin/organizations/*` | Organization join context, master/org-admin management, invites, join codes, publishing, and scoped cohort progress |

## Quality checks

```powershell
pnpm exec tsc --noEmit
pnpm test
pnpm lint
pnpm build

# Requires DynamoDB Local on port 8001 and a running app on port 3000
node scripts/e2e-features.mjs
```

Latest local verification:

| Check | Result |
|---|---|
| TypeScript | Pass |
| Shared unit tests | 37/37 pass |
| Production build | Pass; includes `/api/ask/stream` |
| Local E2E | Pass; page/API auth checks, idempotency replay, daily quota, organization invite/join/publish flow, custom topics, reviews, adoption, quiz, and coverage |
| ESLint | Exit code 0; legacy warning cleanup remains |

## Scaling plan toward 10K MAU

The application should keep AI endpoints in Next.js route handlers on App Runner initially. Moving them to Lambda/API Gateway is not a near-term scaling requirement.

1. Replace operator analytics scans with access-pattern-specific DynamoDB GSIs and `Query` operations.
2. Pre-aggregate analytics asynchronously from events (DynamoDB Streams first; SQS/EventBridge only when independent buffering or fan-out is needed).
3. Add Bedrock bounded retries, timeouts, a circuit breaker, alarms, and quota monitoring before launch.
4. Cache stable curriculum, coverage, and quiz work selectively; do not expect high cache hits for unique Ask requests.
5. Load test realistic streaming traffic, starting at 100 concurrent clients and progressing to 500. Tune App Runner maximum concurrency and instance limits from observed P95 latency and Bedrock quota behaviour.

Do not add Kinesis, ClickHouse, OpenSearch, AppSync, multi-region deployment, or a Lambda migration until measurements show a concrete need.

## Project layout

```text
src/app/api/             Next.js route handlers
src/app/dashboard/       Student learning experience
src/components/          UI and learning widgets
src/data/                DSA curriculum
src/lib/                 Bedrock, DynamoDB, auth, S3, and Ask safety modules
src/shared/              Contracts and testable algorithms
extension/               Chrome MV3 extension
infra/template.yaml      SAM infrastructure stack
apprunner.yaml           App Runner source-deployment configuration
scripts/                 DynamoDB Local setup and E2E verification
```

## Hackathon tracks

| Track | Evidence |
|---|---|
| Ship It | App Runner-ready Next.js 16 app, SAM AWS stack, Bedrock, DynamoDB, S3, and CloudWatch |
| Build It | Local Next.js + DynamoDB Local setup and E2E script |
| Best UI | Responsive learning dashboard and spatial Chrome extension workflow |

## License

MIT
