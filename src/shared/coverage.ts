/**
 * shared/coverage.ts — Coverage Lite (plan §17).
 * Evaluates a pasted resource excerpt against a topic's objectives and returns
 * per-objective status: strong / moderate / weak / missing.
 *
 * The production route asks Bedrock for a structured JSON judgement. A pure,
 * deterministic keyword-overlap classifier is provided here as an offline
 * fallback (so coverage works without a model), and is unit-tested.
 */
import type { CoverageStatus } from './contracts'

export type CoverageWeight = 'high' | 'medium' | 'low'

/** Obvious token that should only match if the objective almost literally covers it. */
const HIGH_SIGNAL = new Set([
  'implement', 'explain', 'trace', 'solve', 'apply', 'define', 'compare',
  'recognize', 'identify', 'use', 'reason', 'analyze', 'proof', 'derive',
])

/** Short functional words that carry no topical signal. */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'how', 'why', 'what', 'when', 'where', 'that',
  'this', 'its', 'are', 'was', 'were', 'has', 'have', 'you', 'your', 'from',
  'into', 'each', 'both', 'not', 'but', 'all', 'any', 'can', 'will', 'over',
])

/** Naive suffix stemmer so {halves, halving, halved} → `halv`. Good enough for overlap. */
function stem(word: string): string {
  let w = word
  if (w.length <= 5) return w
  if (w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.endsWith('tion')) w = w.slice(0, -4)
  else if (w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.endsWith('es')) w = w.slice(0, -2)
  else if (w.endsWith('s')) w = w.slice(0, -1)
  return w
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#_-]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
      .map(stem),
  )
}

/** Score how well `content` covers one objective: 0..1. */
export function coverageScore(objective: string, content: string): { score: number; matched: string[] } {
  const contentTokens = tokens(content)
  const objTokens = tokens(objective)
  let hits = 0
  const matched: string[] = []
  for (const word of objTokens) {
    if (HIGH_SIGNAL.has(word)) continue // verbs are too generic to match on
    if (contentTokens.has(word)) {
      hits++
      matched.push(word)
    }
  }
  const contentLen = content.length
  // A resource only needs to be moderately long to fully cover short objectives.
  const lengthFactor = Math.min(1, contentLen / 450)
  const objectiveWords = Math.max(1, objTokens.size)
  const coverage = hits / objectiveWords
  const score = coverage * (0.5 + 0.5 * lengthFactor)
  return { score: Math.min(1, Math.round(score * 1000) / 1000), matched }
}

/** Map a 0..1 score to a status (thresholds mirror the Bedrock judgements). */
export function scoreToStatus(score: number): CoverageStatus {
  if (score >= 0.5) return 'strong'
  if (score >= 0.3) return 'moderate'
  if (score >= 0.12) return 'weak'
  return 'missing'
}

/**
 * Pure fallback classifier. Returns one verdict per objective.
 * Used when Bedrock is unavailable (no key, quota, error).
 */
export function classifyCoverage(
  objectives: string[],
  content: string,
): { status: CoverageStatus; reason: string }[] {
  return objectives.map((objective) => {
    const { score, matched } = coverageScore(objective, content)
    const status = scoreToStatus(score)
    const reason =
      status === 'missing'
        ? 'No relevant explanation or code was found in the resource for this objective.'
        : matched.length > 0
          ? `Covers ${matched.slice(0, 4).join(', ')} with an estimated score of ${Math.round(score * 100)}%.`
          : `Partial topical overlap found (estimated ${Math.round(score * 100)}%).`
    return { status, reason }
  })
}

/** Combine per-objective statuses into one overall status. */
export function overallStatus(statuses: CoverageStatus[]): CoverageStatus {
  if (!statuses.length) return 'missing'
  const order: Record<CoverageStatus, number> = { strong: 3, moderate: 2, weak: 1, missing: 0 }
  let min = 3
  for (const s of statuses) {
    if ((order[s] ?? 0) < min) min = order[s]
  }
  return (['strong', 'moderate', 'weak', 'missing'] as CoverageStatus[]).find(
    (s) => order[s] === min,
  ) ?? 'missing'
}