/**
 * shared/contracts.ts — single source of truth for request/response contracts.
 * Consolidates the plan's wire contracts (§10, §12, §18) and the studyos/
 * learning-platform schemas into one module used by the web app, the API
 * route handlers, and the extension.
 *
 * Error envelope is always `{ error: { code, message } }` (studyos convention).
 */

// ---------- Error envelope ----------
export interface ApiErrorBody {
  error: { code: string; message: string }
}
export function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } }
}

// ---------- Point & Ask (plan §10, §8) ----------
export interface AskContext {
  selected_text: string
  nearby_before: string
  nearby_after: string
  domain: string
  page_title: string
}

export interface AskRequest {
  extension_session_token?: string
  /** Stable per-logical-request UUID. Also accepted as the Idempotency-Key header. */
  idempotency_key?: string
  topic_id?: string | null
  context: AskContext
  question: string
  level?: 'eli5' | 'student' | 'expert'
  research?: boolean
}

export interface GroundingExcerpt {
  type: 'selected_text' | 'nearby_before' | 'nearby_after'
  excerpt: string
}

export interface AskResponse {
  ask_id: string
  answer: string
  grounding: GroundingExcerpt[]
  insufficient_context: boolean
  latency_ms: number
  sources?: { id: string; title: string; url: string; cited?: boolean }[]
  cited?: string[]
  level?: string
}

// ---------- Feedback & review (plan §12, §13) ----------
export type FeedbackReason = 'wrong' | 'too_vague' | 'missed_selection' | 'too_long' | 'other'

export interface FeedbackRequest {
  extension_session_token?: string
  askId: string
  helpful: boolean
  reason?: string
}

export interface SaveReviewRequest {
  extension_session_token?: string
  askId: string
  topicId?: string
  question?: string
  answer?: string
}

export interface ReviewItem {
  id: string
  topicId?: string
  askId: string
  question: string
  answer: string
  nextReviewAt: string
  reviewCount: number
  lastRating: 'again' | 'good' | null
  status: 'pending' | 'completed' | 'dismissed'
  createdAt: string
}

export type ReviewRating = 'again' | 'good'

// ---------- Profile / onboarding ----------
export interface Profile {
  id?: string
  email: string
  name: string | null
  image: string | null
  year?: number
  activeTrack?: string
  college?: string
  branch?: string
  phone?: string
  leetcode?: string
  github?: string
  linkedin?: string
  profileCompletedAt?: string
  referralSource?: string
}

// ---------- Progress / evidence ----------
export type TopicStatus = 'not_started' | 'in_progress' | 'done' | 'needs_review'

export interface TopicProgress {
  userId: string
  topicId: string
  status: TopicStatus
  startedAt: string | null
  completedAt: string | null
  timeSpentMin: number
  resourceCompleted: boolean
  questionsAsked: number
  helpfulAnswers: number
  reviewsCompleted: number
  updatedAt: string
}

export type EvidenceState = 'no_evidence' | 'started' | 'developing' | 'reviewed'

// ---------- Coverage Lite (plan §17) ----------
export type CoverageStatus = 'strong' | 'moderate' | 'weak' | 'missing'

export interface ObjectiveCoverage {
  objective: string
  status: CoverageStatus
  reason: string
}

export interface CoverageCheckRequest {
  /** Topic id to check against. */
  topic_id: string
  /** Pasted/thrown resource text. */
  content: string
}

export interface CoverageCheckResponse {
  topic_id: string
  topic_title: string
  coverage: ObjectiveCoverage[]
  overall: CoverageStatus
}

// ---------- Custom topics (Tier-2) ----------
export interface CustomTopic {
  id: string
  userId: string
  title: string
  description: string
  whyItMatters: string
  objectives: string[]
  estimatedMinutes: number
  resources: { title: string; url: string; kind: 'watch' | 'read' | 'practice' }[]
  createdAt: string
}

// ---------- Per-topic quiz (Tier-2) ----------
export interface QuizQuestion {
  text: string
  options: string[]
  correct_index: number
  explanation: string
}

export interface QuizResult {
  correct: number
  total: number
  percent: number
  passed: boolean
}

// ---------- Anonymous adopt ----------
export interface AdoptRequest {
  /** The anonymous device id captured before sign-in. */
  device_id: string
}

export interface ExtensionPairResponse {
  token: string
  expiresAt: string
}

// ---------- Spatial Point & Ask (learning-platform port) ----------
export interface SpatialMark {
  type: 'polygon' | 'circle' | 'rectangle'
  role: 'reference' | 'source' | 'target'
  x: number
  y: number
  width: number
  height: number
  closed?: boolean
  points?: [number, number][]
}

export interface SpatialAnchor {
  id: string
  type: string
  text?: string
  label?: string
  bbox: { x: number; y: number; width: number; height: number }
  score?: number
  href?: string
  src?: string
  page?: number | null
}

export interface SpatialAskRequest {
  extension_session_token?: string
  question: string
  marks: SpatialMark[]
  anchors: SpatialAnchor[]
  canvas: { width: number; height: number }
  page: { url: string; title: string; surface: 'web' | 'pdf' }
  research?: boolean
  level?: string
}

export interface SpatialAskResponse {
  id: string
  answer: string
  anchors_used: SpatialAnchor[]
  confidence: number
  provider: string
  model: string
  vision: boolean
  ocr: boolean
  sources?: { id: string; title: string; url: string }[]
  cited?: string[]
  quota?: { signed_in: boolean; remaining: number; limit: number }
  resolved_target?: {
    candidateId: string
    confidence: Confidence
    type?: string
    label?: string
    alternatives?: string[]
  }
  nearby_context?: string
}

// ---------- Spatial resolved-target pipeline (plan Phases 1/4/7) ----------
/** A 2D axis-aligned rectangle in viewport (CSS px) coordinates. */
export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

export type CandidateSource = 'dom' | 'pdf_text'

/** Confidence that a candidate is what the student pointed at. */
export type Confidence = 'high' | 'medium' | 'low'

/** A discovered, geometry-scored object under/near the mark. */
export interface CandidateObject {
  id: string
  source: CandidateSource
  type?: string
  text?: string
  label?: string
  bbox: BBox
  geometry: {
    overlap: number
    centerDistance: number
    containment: boolean
  }
}

/** The single most-likely object the student pointed at. */
export interface ResolvedTarget {
  candidateId: string
  confidence: Confidence
  alternatives?: string[]
}

/** Complete spatial context sent to the answerer. */
export interface SpatialContext {
  mark: BBox
  target: CandidateObject
  alternatives?: CandidateObject[]
  page: {
    title: string
    domain: string
    type: 'web' | 'pdf'
  }
}

/** Wire shape for a spatial ask once resolution has happened. */
export interface ResolvedSpatialAskRequest {
  context_type: 'spatial'
  resolved_target: {
    type?: string
    label?: string
    text?: string
    confidence: Confidence
  }
  nearby_context?: string
  domain: string
  page_title: string
  extension_session_token?: string
  question: string
}
