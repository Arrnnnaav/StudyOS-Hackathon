# StudyOS - AWS First Commit Hackathon

**Personalized Learning OS for Engineering Students**

> "Know what to learn today. Understand what stops you. Remember what matters."

## Problem

Engineering students have abundant resources (YouTube, LeetCode, GitHub, GFG, docs) but no system that:

1. Tells them **what to learn today** based on their year/goal
2. Shows which resources **actually cover** each topic
2. Lets them **ask questions** about specific code/text and get grounded answers
4. Turns questions into **spaced reviews** for retention

## Solution

StudyOS connects the full learning loop:

```
Year/Track → Today Screen → Curated Resources → Point & Ask → Save to Review → Spaced Repetition → Next Action
```

## Demo Flow (90 seconds)

1. **Sign up** with Google → Select Year 2 → DSA Foundations
2. **Today Screen** → "Complexity Basics (90 min) - First topic, no prerequisites"
3. **Open LeetCode** → Draw rectangle around confusing code → Press Alt+Shift+A
3. **Ask**: "Why do we use `<=` instead of `<` here?"
4. **Get grounded answer** from AWS Bedrock with citations to the exact code you circled
5. **Mark Helpful** → "Save to Review" → Appears in Review Queue tomorrow
6. **Review** → Answer again → Spaced repetition schedules next review

---

## Architecture

### Production architecture (single backend path)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  Chrome Ext     │────▶│  Next.js Route       │────▶│  Bedrock    │
│  (Side Panel)   │     │  Handlers (API)      │     │  (Claude 3  │
└─────────────────┘     │  /api/spatial/ask    │     │  Haiku)     │
                        │  /api/coverage/check │     └─────────────┘
                        │  /api/ask/feedback   │           │
                        │  /api/ask/save-review│           │
                        └──────────┬───────────┘           │
                                   │                       ▼
                        ┌──────────▼───────────┐  ┌─────────────────┐
                        │  DynamoDB            │  │  S3 (Crops)     │
                        │  Profiles, Progress, │  │  Point & Ask    │
                        │  Asks, Reviews,      │  │  Region Crops   │
                        │  Events, Pairings    │  └─────────────────┘
                        └──────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  AWS App Runner      │
                        │  (Next.js 16 App)    │
                        └──────────────────────┘
```

The production API is the **Next.js route-handler layer deployed with the App Runner-hosted app**. The extension calls the same `/api/*` routes; it does not call a separate API Gateway or Lambda service. The SAM template provisions only the AWS resources consumed by those handlers (Cognito, DynamoDB, S3, IAM, and CloudWatch). This keeps the diagram, deployed request path, and source tree aligned.

### Local development

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  Chrome Ext     │────▶│  Local Dev Server    │────▶│  DynamoDB   │
│  (Side Panel)   │     │  Next.js handlers    │     │  Local      │
└─────────────────┘     └──────────────────────┘     │  (Port 8001) │
                                                       └─────────────┘
```

---

## AWS Services Used

| Service | Purpose |
|---------|---------|
| **AWS App Runner** | Next.js 16 frontend and route-handler deployment |
| **Cognito** | Student authentication (Google OAuth) |
| **Next.js Route Handlers** | Production API for the web app and extension, hosted with App Runner |
| **DynamoDB** | User state, progress, asks, reviews, events, pairings |
| **Bedrock** | Grounded explanations (Claude 3 Haiku via Converse API) |
| **S3** | Point & Ask crop storage (7-day lifecycle) |
| **CloudWatch** | Logs, metrics, structured JSON logs for operator dashboard |
| **SAM CLI** | Provisions the application's AWS resources |

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- AWS Account (free tier)
- Google Cloud Console project (for OAuth)

### Local Development

```bash
# Clone and install
git clone https://github.com/Arrnnnaav/StudyOS-Hackathon.git
cd StudyOS-Hackathon
pnpm install

# Environment
cp .env.example .env.local
# Add your credentials

# Start local DynamoDB (Docker)
docker run -d --name dynamodb-local -p 8001:8000 amazon/dynamodb-local:latest -jar DynamoDBLocal.jar -sharedDb

# Create tables
node scripts/create-tables.mjs

# Run dev server
pnpm dev
# Open http://localhost:3000
```

### Extension Development
```bash
# Load unpacked extension in Chrome
# 1. chrome://extensions → Developer mode → Load unpacked
# 2. Select /extension folder
# 3. Press Alt+Shift+A on any page to start spatial Point & Ask
```

### AWS Deployment (Ship It)

```bash
# Deploy infrastructure (SAM)
cd infra
sam build
sam deploy --guided

# Deploy the Next.js 16 app through App Runner
# App Runner Console → Create service → Source code repository → this repo
# Configuration source: Repository (uses apprunner.yaml)
# Runtime role / instance role: AppRunnerInstanceRoleArn from the SAM output
# Configure the runtime variables listed below, then deploy.
# Point the extension API base at the deployed App Runner URL.
```

> Hosting decision: this app stays on **Next.js 16.3.5** and deploys to **AWS App Runner (Node.js 22)**. Amplify Hosting's published SSR compatibility list currently documents Next.js through v15, so it is not the Ship It target for this branch. App Runner's managed Node.js 22 runtime supports source-repository deployments configured by `apprunner.yaml`.

### App Runner runtime variables

Set these in the App Runner service; keep secrets in App Runner or Secrets Manager, never in Git:

```text
AWS_REGION=<same region as SAM stack and Bedrock model>
AUTH_TRUST_HOST=true
NEXTAUTH_URL=https://<your-app-runner-service-url>
NEXTAUTH_SECRET=<new 32-byte random secret>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
BEDROCK_ASK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
BEDROCK_COVERAGE_MODEL_ID=global.anthropic.claude-sonnet-4-5-20250929-v1:0
ASK_DAILY_LIMIT=20
ASK_IDEMPOTENCY_TTL_SECONDS=86400
```

Do **not** set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` as app variables. The App Runner instance role receives temporary credentials automatically.

---

## Project Structure

```
StudyOS-Hackathon/
├── src/
│   ├── app/
│   │   ├── (auth)/signin, onboarding
│   │   ├── (dashboard)/today, roadmap, topics/[id], review, progress, settings, custom-topics
│   │   ├── api/
│   │   │   ├── ask, ask/feedback, ask/save-review
│   │   │   ├── coverage/check
│   │   │   ├── spatial/ask
│   │   │   ├── extension/pair, pair-code, crop
│   │   │   ├── auth/[...nextauth], auth/me, auth/adopt
│   │   │   ├── onboarding, progress, reviews, events, operator
│   │   │   └── topics/[topicId], topics/[topicId]/quiz, topics/custom
│   │   ├── page.tsx (landing)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/ (shadcn/ui: Button, Card, Badge, Progress, etc.)
│   │   ├── coverage-checker.tsx
│   │   └── quiz-runner.tsx
│   ├── data/dsa-curriculum.ts (14 topics, 4 phases, 50+ objectives)
│   ├── lib/
│   │   ├── auth.ts (NextAuth + Cognito, extension token support)
│   │   ├── db.ts (DynamoDB operations, 7 tables)
│   │   ├── bedrock.ts (Bedrock Converse API wrapper)
│   │   ├── s3.ts (S3 crop upload)
│   │   ├── auth-utils.ts (extension token resolver)
│   │   ├── resolver.ts (deterministic spatial resolver)
│   │   ├── spatial.ts (geometry helpers)
│   │   ├── coverage.ts (offline coverage classifier)
│   │   ├── quiz.ts (quiz generator + scorer)
│   │   ├── utils.ts
│   │   └── s3.ts
│   ├── shared/
│   │   ├── contracts.ts (all wire types, error envelope)
│   │   ├── today.ts (pure Today algorithm + tests)
│   │   ├── coverage.ts (offline classifier)
│   │   ├── quiz.ts (quiz generator + scorer)
│   │   ├── spatial.ts (geometry helpers)
│   │   └── resolver.ts (deterministic resolver + tests)
│   ├── lib/auth-utils.ts (extension token resolver)
│   ├── types/index.ts, types/next-auth.d.ts
│   └── data/dsa-curriculum.ts
├── extension/
│   ├── manifest.json (MV3)
│   ├── background.js (service worker, spatial injection, API proxy)
│   ├── content.js (text selection capture)
│   ├── spatial-content.js (rectangle overlay, DOM candidates, grounding chip)
│   ├── geometry.js (client-side resolver + nearestHeading)
│   ├── config.js (apiBase, features.rectangleOnly, privacy)
│   ├── background.js, content.js, sidepanel.html, sidepanel.js
│   ├── popup.html, popup.js (Alt+Shift+A launcher)
│   └── icons/ (16/32/48/128px)
├── infra/
│   ├── template.yaml (SAM: Cognito, 8 DynamoDB tables, Bedrock IAM, S3, CloudWatch)
│   └── samconfig.toml
├── scripts/
│   ├── create-tables.mjs (DynamoDB table provisioning)
│   ├── e2e-features.mjs (page + API smoke tests)
│   └── commit-msg-*.txt
├── .env.example
├── .env.local (gitignored)
├── package.json, pnpm-workspace.yaml, tsconfig.json
└── README.md
```

---

## Hackathon Tracks

| Track | Implementation |
|-------|----------------|
| **Ship It** | App Runner-hosted Next.js 16 handlers + Bedrock + DynamoDB + S3 + CloudWatch |
| **Build It** | Next.js locally + DynamoDB Local (Docker) |
| **Best UI** | Tailwind + shadcn/ui, polished Today screen & spatial extension |

---

## Key Features (P0 - Hackathon Scope)

- ✅ **Student auth** (Google OAuth + Cognito, extension pairing via 6-char code)
- ✅ **Year-based onboarding** → DSA Foundations (14 topics, 4 phases, 50+ objectives)
- ✅ **Today screen** with prerequisite-aware next action (review → in-progress → next prereq-ready)
- ✅ **14-topic DSA curriculum** with curated resources (watch/read/practice per topic)
- ✅ Topic pages with objectives, resources, learning evidence, progress tracking
- ✅ **Chrome Extension MV3** (side panel, text selection, Alt+Shift+A hotkey)
- ✅ **Spatial Point & Ask** — rectangle / circle / freehand marking over any page, grounded on the circled text
- ✅ **Point & Ask → Bedrock grounded answer** (grounding excerpts, insufficient-context detection)
- ✅ **Helpful/Not Helpful** feedback
- ✅ **Save to Review → Spaced repetition (Again/Good)**
- ✅ **Review queue** with Again/Good scheduling
- ✅ **Resource Coverage Lite** — paste any resource and see Strong/Moderate/Weak/Missing per objective
- ✅ **Per-topic Quiz** ("check your understanding") with evidence recording
- ✅ **Custom Topics** — students add their own learning goals to the roadmap
- ✅ **Anonymous device adoption** — use it without an account, sign in to keep history
- ✅ Event tracking (signup, ask, feedback, review, spatial metrics)
- ✅ Operator dashboard (metrics, funnel, domains, errors, spatial vs text-selection split)
- ✅ Extension pairing via 6-char code (10-min expiry, single-use)
- ✅ SAM stack (`infra/template.yaml`): Cognito, 8 DynamoDB tables, Bedrock IAM, CloudWatch, **S3 for Point & Ask crops**

---

## Spatial Point & Ask — Technical Deep Dive

### Rectangle Interaction (Phase 2)
- **Alt+Shift+A** → crosshair cursor → drag rectangle → release → candidate discovery
- Rectangle is the **only enabled tool** for hackathon (circle/pen hidden behind feature flag)

### DOM Candidate Discovery (Phase 3)
- `elementsFromPoint()` grid sampling (6×6) under the rectangle
- `anchorFilter` rejects oversized containers (`body`, `main`, huge `div`s)
- Extracts: `textContent`, `tagName`, `bbox`, `aria-label`, `title`, `alt`, `href`, `src`
- `nearestHeading()` walks up ancestors for nearest `h1–h6` → candidate `label`

### Deterministic Geometry Resolver (Phase 4)
```
score = overlap + containmentBonus - centerDistancePenalty - oversizedContainerPenalty
```
- **overlap** = intersection / markArea
- **containmentBonus** = +0.2 if candidate fully inside mark
- **centerDistancePenalty** = min(0.5, centerDistance / markDiagonal)
- **oversizedContainerPenalty** = 0.5 if candidateArea > 6×markArea AND >40k px²

**Confidence classification:**
- `high`: topScore ≥ 0.7 AND gap ≥ 0.3
- `medium`: gap ≥ 0.12
- `low` (ambiguous): near-tie

### Visible Grounding (Phase 5)
- **Grounding chip** above ask input: `🎯 Binary Search · High confidence`
- Click chip → **pulse highlight** the resolved DOM element
- **Ambiguity chooser** (low confidence): "Did you mean: [1] Code block [2] Paragraph"
- **Privacy indicator**: `✓ Resolved DOM object · ✓ Nearby text · ✕ Full page · ✕ Full screenshot`

### Server-Side Resolution (Phase 7)
```
/api/spatial/ask pipeline:
1. Anchors → CandidateObject[] (source: 'dom' | 'pdf_text')
2. Deterministic resolver → ResolvedTarget {candidateId, confidence, alternatives[]}
3. SpatialContext {mark, target, alternatives, page} → Bedrock prompt
4. Answer → persist Ask + trackEvent(point_ask_succeeded)
5. Response: {answer, anchors_used, confidence (0.9/0.7/0.4), resolved_target, nearby_context}
```

---

## Key Features (Complete List)

| Feature | Status | Notes |
|---------|--------|-------|
| Student Auth (Google OAuth + Cognito) | ✅ | Extension pairing via 6-char code |
| Year-based Onboarding → DSA Foundations | ✅ | 14 topics, 4 phases, 50+ objectives |
| Today Screen (prerequisite-aware) | ✅ | Review → In-progress → Next prereq-ready |
| 14-Topic DSA Curriculum | ✅ | 4 phases, curated resources per topic |
| Topic Pages (objectives, resources, evidence) | ✅ | Progress tracking + evidence state |
| Chrome Extension MV3 | ✅ | Side panel, Alt+Shift+A, context menu |
| **Spatial Point & Ask** | ✅ | Rectangle overlay, DOM candidates, deterministic resolver |
| Grounded Bedrock Answers | ✅ | Citations to circled text, insufficient-context detection |
| Helpful/Not Helpful Feedback | ✅ | Persisted to DynamoDB |
| Save to Review → Spaced Repetition | ✅ | Again (+1d) / Good (+3d) scheduling |
| Review Queue | ✅ | Due today + upcoming, Again/Good actions |
| Resource Coverage Lite | ✅ | Paste resource → Strong/Moderate/Weak/Missing per objective |
| Per-Topic Quiz | ✅ | 1 Q/objective, score → evidence recording |
| Custom Topics | ✅ | User-created topics on personal roadmap |
| Anonymous Device Adoption | ✅ | X-Device-ID → history adopted on login |
| Event Tracking | ✅ | signup, onboarding, topic, ask, feedback, review, spatial |
| Operator Dashboard | ✅ | Metrics, funnel, domains, errors, spatial vs text split |
| Extension Pairing | ✅ | 6-char code, 10-min TTL, single-use |
| SAM Stack | ✅ | Cognito, 8 DynamoDB tables, Bedrock IAM, S3, CloudWatch |
| S3 Crop Storage | ✅ | Private bucket, 7-day lifecycle, CORS for extension |
| Coverage Lite | ✅ | Paste resource → per-objective Strong/Moderate/Weak/Missing |
| Per-Topic Quiz | ✅ | Generated from objectives, evidence recorded |
| Custom Topics | ✅ | Student-created topics on personal roadmap |

---

## Not Built (Post-Hack)

- ❌ **PDF viewer inside extension** (extension is web-only; overlay reads PDF text anchors when a viewer is present)
- ❌ Multiple curriculum tracks
- ❌ Full mastery model (0–100)
- ❌ Semantic ingestion pipeline (DocCluster)
- ❌ Step Functions / EventBridge / OpenSearch / Cedar
- ❌ Research mode web-search grounding (replaced by Bedrock-grounded answers on circled text)
- ❌ Multi-track curriculum
- ❌ Full mastery model (0–100)
- ❌ Semantic ingestion pipeline (DocCluster)
- ❌ Step Functions / EventBridge / OpenSearch
- ❌ Research mode web-search grounding (replaced by Bedrock-grounded answers on circled text)

---

## Verification & Quality

| Check | Result |
|-------|--------|
| TypeScript (`pnpm exec tsc --noEmit`) | ✅ Clean |
| Unit Tests (`pnpm test`) | 31/31 pass |
| Production Build (`pnpm build`) | Run before submission; validates the App Router production bundle |
| E2E (local DynamoDB) | `node scripts/e2e-features.mjs` after DynamoDB Local is running |
| AWS deployment proof | Not committed: run `sam deploy` and an App Runner deploy with your AWS role, then capture the deployed URL and a Bedrock-backed request for the submission |

---

## Hackathon Tracks

| Track | Implementation |
|-------|----------------|
| **Ship It** | App Runner-hosted Next.js 16 handlers + Bedrock + DynamoDB + S3 + CloudWatch |
| **Build It** | Next.js locally + DynamoDB Local (Docker) |
| **Best UI** | Tailwind + shadcn/ui, polished Today screen & spatial extension |

---

## Team

**Arnav Khandelwal** - Solo founder, 2nd year engineering student  
Built during AWS First Commit Hackathon (Sept 17-20, 2026)

---

## License

MIT - Built for AWS First Commit Hackathon
