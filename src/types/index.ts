export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  year: number // 1-4
  activeTrack: string // curriculum key
  createdAt: string
  lastActiveAt: string
}

export interface TopicProgress {
  userId: string
  topicId: string
  status: 'not_started' | 'in_progress' | 'done' | 'needs_review'
  startedAt: string | null
  completedAt: string | null
  timeSpentMin: number
  resourceCompleted: boolean
  questionsAsked: number
  helpfulAnswers: number
  reviewsCompleted: number
  updatedAt: string
}

export interface TopicEvidence {
  resourceCompleted: boolean
  questionsAsked: number
  helpfulAnswers: number
  reviewsCompleted: number
  lastReviewAt: string | null
}

export interface TopicState {
  status: 'not_started' | 'in_progress' | 'done' | 'needs_review'
  evidence: TopicEvidence
  label: 'No Evidence' | 'Started' | 'Developing' | 'Reviewed'
}

export interface Ask {
  id: string
  userId: string
  topicId: string | null
  domain: string
  pageTitle: string
  selectedText: string
  nearbyBefore: string
  nearbyAfter: string
  question: string
  answer: string
  model: string
  latencyMs: number
  helpful: boolean | null
  feedbackReason: string | null
  savedToReview: boolean
  createdAt: string
}

export interface ReviewItem {
  id: string
  userId: string
  topicId: string
  askId: string
  question: string
  answer: string
  nextReviewAt: string
  reviewCount: number
  lastRating: 'again' | 'good' | null
  status: 'pending' | 'completed' | 'dismissed'
  createdAt: string
}

export interface AnalyticsEvent {
  eventId: string
  eventName: string
  timestamp: string
  userId: string
  sessionId: string
  topicId: string | null
  domain: string | null
  properties: Record<string, unknown>
}

export interface AskMetadata {
  askId: string
  userId: string
  timestamp: string
  topicId: string | null
  domain: string
  contextType: 'text_selection' | 'rectangle' | 'pdf' | 'code'
  selectedChars: number
  nearbyChars: number
  questionChars: number
  modelId: string
  latencyMs: number
  success: boolean
  errorCode: string | null
  insufficientContext: boolean
  helpfulVote: boolean | null
  feedbackReason: string | null
  savedToReview: boolean
}

export interface OperatorMetrics {
  registeredStudents: number
  activatedStudents: number
  totalAsks: number
  askSuccessRate: number
  helpfulRate: number
  reviewSaveRate: number
  avgAskLatencyMs: number
  topDomains: Array<{ domain: string; count: number }>
  topTopics: Array<{ topicId: string; count: number }>
  recentErrors: Array<{
    errorCode: string
    errorType: string
    timestamp: string
  }>
  funnel: {
    signup: number
    onboarding: number
    firstTopic: number
    firstAsk: number
    reviewSave: number
    reviewComplete: number
  }
}

export interface ExtensionPairRequest {
  code: string
}

export interface ExtensionPairResponse {
  token: string
  expiresAt: string
}

export interface AskRequest {
  extensionSessionToken: string
  topicId: string | null
  context: {
    selectedText: string
    nearbyBefore: string
    nearbyAfter: string
    domain: string
    pageTitle: string
  }
  question: string
}

export interface AskResponse {
  askId: string
  answer: string
  grounding: Array<{
    type: 'selected_text' | 'nearby_before' | 'nearby_after'
    excerpt: string
  }>
  insufficientContext: boolean
  latencyMs: number
}

export interface FeedbackRequest {
  askId: string
  helpful: boolean
  reason?: string
}

export interface SaveReviewRequest {
  askId: string
}

export interface ReviewRateRequest {
  reviewId: string
  rating: 'again' | 'good'
}