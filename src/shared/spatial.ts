/**
 * shared/spatial.ts — Point & Ask grounding helpers (rectangle/circle/freehand).
 * Extracts the most relevant text anchors under a marked region so the model
 * only ever sees what the student circled (never the whole page). Pure + tested.
 */
import type { SpatialMark, SpatialAnchor } from './contracts'

/** Normalize a shape into a rectangle bbox (polygon/circle fall back to bbox). */
export function markBox(mark: SpatialMark): { x: number; y: number; width: number; height: number } {
  return { x: mark.x, y: mark.y, width: mark.width, height: mark.height }
}

export function intersectArea(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * Overlap score between an anchor bbox and the mark bbox (0..1).
 * Mirrors the resolver: max(IoU, 0.9*markOverlap, 0.95*anchorOverlap) so a
 * fully-contained anchor scores high even though raw IoU punishes containment.
 */
export function overlapScore(anchor: SpatialAnchor, mark: SpatialMark): number {
  const box = markBox(mark)
  const inter = intersectArea(anchor.bbox, box)
  const anchorArea = anchor.bbox.width * anchor.bbox.height || 1
  const markArea = box.width * box.height || 1
  const union = anchorArea + markArea - inter
  const iou = union ? inter / union : 0
  const markOverlap = markArea ? inter / markArea : 0
  const anchorOverlap = anchorArea ? inter / anchorArea : 0
  return Math.max(iou, Math.min(0.94, markOverlap * 0.9), Math.min(0.95, anchorOverlap * 0.95))
}

/** Deterministic heuristic: rank a mark's anchors by overlap, depth, text. */
export function rankAnchors(anchors: SpatialAnchor[], marks: SpatialMark[], limit = 8): SpatialAnchor[] {
  // For each anchor pick its best overlap across all marks.
  const scored = anchors.map((a) => {
    const best = marks.reduce((acc, m) => Math.max(acc, overlapScore(a, m)), 0)
    const textLen = (a.text || '').length
    const depthScore = a.type === 'selection' ? 1 : 0 // user selection is the strongest signal
    return { a, best, depthScore, textLen }
  })
  return scored
    .filter((s) => s.best > 0.05)
    .sort((x, y) => y.depthScore - x.depthScore || y.best - x.best || y.textLen - x.textLen)
    .slice(0, limit)
    .map((s) => s.a)
}

/** Join ranked anchor text into model-facing context, deduped and bounded. */
export function anchorsToContext(anchors: { text?: string }[], maxChars = 1800): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const a of anchors) {
    const text = (a.text || '').replace(/\s+/g, ' ').trim()
    if (!text || seen.has(text) || text.length < 8) continue
    seen.add(text)
    parts.push(text.slice(0, 600))
    if (parts.join('\n').length > maxChars) break
  }
  return parts.join('\n')
}

/** User selection extracted from marks → anchors (when the extension supplies one). */
export function pickSelection(marks: SpatialMark[], anchors: SpatialAnchor[]): string {
  const sel = anchors.find((a) => a.type === 'selection')?.text?.trim() || ''
  return sel
}

/** Build the grounded prompt for the spatial ask. */
export function buildSpatialPrompt(o: {
  question: string
  markedText: string
  pageTitle: string
  pageUrl: string
  surface: 'web' | 'pdf'
}): string {
  const { question, markedText, pageTitle, pageUrl, surface } = o
  return [
    `The student is reading ${surface === 'pdf' ? 'a PDF' : 'a web page'}.`,
    `Page: ${pageTitle} (${pageUrl})`,
    '',
    'Text under the student\'s selection/mark:',
    '```',
    markedText || '(no text found under the mark — the selection may be a diagram)',
    '```',
    '',
    `Question: ${question}`,
    '',
    'Explain what the selected part does, why it matters, and answer the question directly.',
    'If the marked text is insufficient to answer reliably, say so clearly.',
    'Never invent code, citations, or surrounding text that was not provided.',
  ].join('\n')
}