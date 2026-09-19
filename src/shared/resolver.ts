/**
 * shared/resolver.ts — deterministic geometry resolver (plan Phase 4).
 * Picks the most likely object under a rectangle mark WITHOUT AI.
 *
 * score = overlap + containmentBonus − centerDistancePenalty − oversizedContainerPenalty
 *
 * Confidence is derived from the score margin (never treated as a probability):
 *   - top score high and a clear gap  → "high"
 *   - moderate gap                   → "medium"
 *   - near-tie among close scores    → "low" (caller should ask the user to disambiguate)
 */
import type { BBox, CandidateObject, CandidateSource, Confidence, ResolvedTarget } from './contracts'
import { intersectArea } from './spatial.ts'

export function bboxCenter(b: BBox): { cx: number; cy: number } {
  return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 }
}

/** Distance between two bbox centers, in px. */
export function centerDistance(a: BBox, b: BBox): number {
  const ca = bboxCenter(a), cb = bboxCenter(b)
  return Math.hypot(ca.cx - cb.cx, ca.cy - cb.cy)
}

export function bboxArea(b: BBox): number {
  return Math.max(0, b.width) * Math.max(0, b.height)
}

/** Geometric features captured for a candidate; the pieces demand for the contract. */
export function candidateGeometry(
  mark: BBox,
  candidate: { bbox: BBox },
): { overlap: number; centerDistance: number; containment: boolean } {
  const inter = intersectArea(mark, candidate.bbox)
  const markArea = bboxArea(mark)
  const candArea = bboxArea(candidate.bbox)
  const overlap = markArea ? inter / markArea : 0
  const contains =
    candidate.bbox.x >= mark.x &&
    candidate.bbox.y >= mark.y &&
    candidate.bbox.x + candidate.bbox.width <= mark.x + mark.width &&
    candidate.bbox.y + candidate.bbox.height <= mark.y + mark.height
  return {
    overlap: Math.min(1, Math.round(overlap * 1000) / 1000),
    centerDistance: Math.round(centerDistance(mark, candidate.bbox) * 1000) / 1000,
    containment: contains,
  }
}

/**
 * Score one candidate against a mark rectangle (0..~1.2). Kept internal so the
 * classification thresholds live here. Higher is better.
 */
function scoreCandidate(mark: BBox, candidate: { bbox: BBox; geometry?: CandidateObject['geometry'] }): {
  score: number
  geometry: CandidateObject['geometry']
} {
  // Always derive geometry from the bbox — it is a computed value, never trusted input.
  const geo = candidateGeometry(mark, candidate)
  const areaMark = bboxArea(mark)
  const areaCand = bboxArea(candidate.bbox)

  // Overlap of the mark that the candidate covers (0..1).
  const overlap = geo.overlap

  // Containment bonus: a candidate fully inside the mark is a strong signal.
  const containmentBonus = geo.containment ? 0.2 : 0

  // Center-distance penalty: penalize as a fraction of the mark's diagonal.
  const diag = Math.hypot(mark.width, mark.height) || 1
  const centerPenalty = Math.min(0.5, geo.centerDistance / diag)

  // Oversized-container penalty: a giant parent div (body/main) that touches the
  // mark but isn't really "the object" must not win over the actual code block.
  const oversizedPenalty = areaCand > areaMark * 6 && areaCand > 40000 ? 0.5 : 0

  const score = overlap + containmentBonus - centerPenalty - oversizedPenalty
  return { score: Math.round(score * 1000) / 1000, geometry: geo }
}

/** Classify the margin between the top and second-ranked candidate. */
export function classifyConfidence(top: number, second: number | undefined): Confidence {
  if (second === undefined) return 'high'
  const gap = top - second
  if (top >= 0.7 && gap >= 0.3) return 'high'
  if (gap >= 0.12) return 'medium'
  return 'low'
}

/**
 * Resolve the best candidate for a mark. Pure + synchronous.
 * Returns a ResolvedTarget plus the enriched candidate list (carries geometry).
 */
export function resolve(
  mark: BBox,
  candidates: (CandidateObject & { geometry?: CandidateObject['geometry'] })[],
): { target: ResolvedTarget; candidates: CandidateObject[] } {
  const scored = candidates.map((c) => {
    const { score, geometry } = scoreCandidate(mark, c)
    return { c: { ...c, geometry }, score }
  })
  const ranked = scored
    .filter((s) => s.score > 0.05)
    .sort((a, b) => b.score - a.score)

  if (!ranked.length) {
    return { target: { candidateId: '', confidence: 'low', alternatives: [] }, candidates }
  }

  const top = ranked[0]
  const second = ranked[1]
  const confidence = classifyConfidence(top.score, second?.score)

  const alternatives =
    confidence === 'low' && second
      ? ranked.slice(1, 4).map((s) => s.c.id)
      : ranked.slice(1, 4).map((s) => s.c.id)

  return {
    target: { candidateId: top.c.id, confidence, alternatives },
    candidates: ranked.map((s) => s.c),
  }
}

/** Shorthand: resolve and return only the winning candidate id + confidence. */
export function resolveCandidateId(mark: BBox, candidates: CandidateObject[]): ResolvedTarget {
  return resolve(mark, candidates).target
}

export function describeTarget(c: CandidateObject): { type?: string; label?: string; text?: string } {
  return { type: c.type, label: c.label, text: c.text }
}

export { scoreCandidate as _scoreCandidate }