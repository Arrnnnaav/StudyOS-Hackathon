# StudyOS - AWS First Commit Hackathon

**Personalized Learning OS for Engineering Students**

> "Know what to learn today. Understand what stops you. Remember what matters."

## Problem
Engineering students have abundant resources (YouTube, LeetCode, GitHub, GFG, docs) but no system that:
1. Tells them **what to learn today** based on their year/goal
2. Shows which resources **actually cover** each topic
3. Lets them **ask questions** about specific code/text and get grounded answers
4. Turns questions into **spaced reviews** for retention

## Solution
StudyOS connects the full learning loop:
```
Year/Track → Today Screen → Curated Resources → Point & Ask → Save to Review → Spaced Repetition → Next Action
```

## Demo Flow (90 seconds)
1. **Sign up** with Google → Select Year 2 → DSA Foundations
2. **Today Screen** → "Complexity Basics (90 min) - First topic, no prerequisites"
3. **Open LeetCode** → Select confusing code → Right-click → "Ask StudyOS"
4. **Ask**: "Why do we use `<=` instead of `<` here?"
5. **Get grounded answer** from AWS Bedrock with citations
6. **Mark Helpful** → "Save to Review" → Appears in Review Queue tomorrow

## Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Chrome Ext     │────▶│  API Gateway     │────▶│  Lambda     │
│  (Side Panel)   │     │  (REST API)      │     │  (Bedrock)  │
└─────────────────┘     └──────────────────┘     └─────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  DynamoDB        │
                       │  (State + Events)│
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Amplify         │
                       │  (Next.js App)   │
                       └──────────────────┘
```

## AWS Services Used
| Service | Purpose |
|---------|---------|
| **Amplify Hosting** | Next.js frontend deployment |
| **Cognito** | Student authentication (Google OAuth) |
| **API Gateway + Lambda** | REST API for web + extension |
| **DynamoDB** | User state, progress, asks, reviews, events |
| **Bedrock** | Grounded explanations (Claude 3 Haiku) |
| **CloudWatch** | Logs, metrics, debugging |

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

# Run dev server
pnpm dev
# Open http://localhost:3000
```

### Extension Development
```bash
# Load unpacked extension in Chrome
# 1. chrome://extensions → Developer mode → Load unpacked
# 2. Select /extension folder
# 3. Pin extension, click to open side panel
```

### AWS Deployment
```bash
# Deploy infrastructure (SAM)
cd infra
sam build
sam deploy --guided

# Deploy frontend to Amplify
# Connect GitHub repo in Amplify Console
# Build: pnpm build, Output: .next
```

## Project Structure
```
StudyOS-Hackathon/
├── src/
│   ├── app/
│   │   ├── (auth)/signin, onboarding
│   │   ├── (dashboard)/today, roadmap, topics/[id], review
│   │   ├── api/auth, onboarding, progress, ask, reviews, events, operator
│   │   ├── page.tsx (landing)
│   │   └── layout.tsx
│   ├── components/ui/ (shadcn/ui)
│   ├── data/dsa-curriculum.ts (14 topics, 4 phases)
│   ├── lib/auth.ts (NextAuth + Cognito)
│   ├── lib/db.ts (DynamoDB operations)
│   ├── lib/utils.ts
│   └── types/index.ts
├── extension/
│   ├── manifest.json (MV3)
│   ├── background.js (service worker)
│   ├── content.js (selection capture)
│   ├── sidepanel.html + sidepanel.js
│   └── icons/
├── infra/
│   └── template.yaml (SAM)
└── .env.example
```

## Hackathon Tracks
| Track | Implementation |
|-------|----------------|
| **Ship It** | Deployed on Amplify + Lambda + Bedrock + DynamoDB |
| **Build It** | Runs locally with SAM CLI + LocalStack (DynamoDB) |
| **Best UI** | Tailwind + shadcn/ui, polished Today screen & extension |

## Key Features (P0 - Hackathon Scope)
- ✅ Student auth (Google OAuth + Cognito)
- ✅ Year-based onboarding → DSA Foundations
- ✅ Today screen with prerequisite-aware next action
- ✅ 14-topic DSA curriculum with curated resources
- ✅ Topic pages with objectives, resources, evidence
- ✅ Chrome Extension MV3 (side panel, text selection, Alt+Shift+A)
- ✅ **Spatial Point & Ask** — rectangle / circle / freehand marking over any page, grounded on the circled text
- ✅ Point & Ask → Bedrock grounded answer (grounding excerpts, insufficient-context detection)
- ✅ Helpful/Not Helpful feedback
- ✅ Save to Review → Spaced repetition (Again/Good)
- ✅ Review queue with Again/Good scheduling
- ✅ **Resource Coverage Lite** — paste any resource and see Strong/Moderate/Weak/Missing per objective
- ✅ **Per-topic Quiz** ("check your understanding") with evidence recording
- ✅ **Custom Topics** — students add their own learning goals to the roadmap
- ✅ **Anonymous device adoption** — use it without an account, sign in to keep history
- ✅ Event tracking (signup, ask, feedback, review)
- ✅ Operator dashboard (metrics, funnel, domains, errors)
- ✅ Extension pairing via 6-char code
- ✅ **SAM stack** (`infra/template.yaml`): Cognito, 7 DynamoDB tables, Bedrock IAM, CloudWatch, **S3 for Point & Ask crops**

## Not Built (Post-Hack)
- ❌ PDF viewer inside the extension (extension is web-only for now; the overlay already reads PDF text anchors when a viewer is present)
- ❌ Multiple curriculum tracks
- ❌ Full mastery model (0–100)
- ❌ Semantic ingestion pipeline (DocCluster)
- ❌ Step Functions / EventBridge / OpenSearch
- ❌ Research mode web-search grounding (replaced by Bedrock-grounded answers on circled text)

## Team
**Arnav Khandelwal** - Solo founder, 2nd year engineering student
- Built during AWS First Commit Hackathon (Sept 17-20, 2026)

## License
MIT - Built for AWS First Commit Hackathon