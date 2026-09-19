import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve, classifyConfidence, bboxCenter, centerDistance } from './resolver.ts'
import type { BBox, CandidateObject } from './contracts'

// mark = rectangle the user drew
const mark: BBox = { x: 100, y: 100, width: 200, height: 60 }

function cand(id: string, bbox: BBox, o: Partial<CandidateObject> = {}): CandidateObject {
  return {
    id,
    source: 'dom',
    bbox,
    text: o.text ?? 'some text',
    ...o,
    geometry: { overlap: 0, centerDistance: 0, containment: false, ...o.geometry },
  }
}

test('code block fully inside the mark wins', () => {
  const code = cand('code', { x: 105, y: 105, width: 190, height: 50 }, { type: 'pre', label: 'Binary-search code block' })
  const para = cand('para', { x: 300, y: 300, width: 100, height: 40 }, { type: 'p', label: 'Explanation' })
  const res = resolve(mark, [para, code])
  assert.equal(res.target.candidateId, 'code')
  assert.equal(res.target.confidence, 'high')
  const top = res.candidates.find((c) => c.id === 'code')!
  assert.equal(top.geometry.containment, true)
})

test('a giant parent div must NOT win over the real code block', () => {
  // The body div touches the mark but is enormous — resolve must pick the code block.
  const giant = cand('body', { x: 0, y: 0, width: 2000, height: 1500 }, { type: 'div', text: 'whole page content' })
  const code = cand('code', { x: 100, y: 100, width: 200, height: 60 }, { type: 'pre', text: 'for (int i = 0; i < n; i++)' })
  const res = resolve(mark, [giant, code])
  assert.equal(res.target.candidateId, 'code')
})

test('paragraph under the mark wins when boxed', () => {
  const para = cand('p', { x: 102, y: 102, width: 150, height: 55 }, { type: 'p', label: 'Intro paragraph' })
  const farPre = cand('pre', { x: 800, y: 800, width: 200, height: 60 }, { type: 'pre' })
  const res = resolve(mark, [farPre, para])
  assert.equal(res.target.candidateId, 'p')
})

test('table cell wins when the mark bounds that cell', () => {
  // The user boxed a single cell → the cell (not the whole row) must win.
  const cellMark: BBox = { x: 104, y: 104, width: 120, height: 52 }
  const cell = cand('td', { x: 100, y: 100, width: 130, height: 60 }, { type: 'td', text: 'O(log n)' })
  const row = cand('tr', { x: 100, y: 100, width: 400, height: 60 }, { type: 'tr', text: 'row' })
  const res = resolve(cellMark, [row, cell])
  assert.equal(res.target.candidateId, 'td')
})

test('a row wins when the mark bounds the whole row (appropriate)', () => {
  const rowMark: BBox = { x: 100, y: 100, width: 200, height: 60 }
  const cell = cand('td', { x: 104, y: 104, width: 120, height: 52 }, { type: 'td', text: 'O(log n)' })
  const row = cand('tr', { x: 100, y: 100, width: 198, height: 58 }, { type: 'tr', text: 'row' })
  const res = resolve(rowMark, [row, cell])
  assert.equal(res.target.candidateId, 'tr')
})

test('near-tie scores yield low confidence (ambiguous)', () => {
  // Two overlapping-ish candidates with a tiny margin.
  const a = cand('a', { x: 100, y: 100, width: 200, height: 60 }, { type: 'pre', text: 'aaa' })
  const b = cand('b', { x: 100, y: 100, width: 195, height: 58 }, { type: 'p', text: 'bbb' })
  const res = resolve(mark, [a, b])
  assert.equal(res.target.confidence, 'low')
  assert.ok((res.target.alternatives || []).includes('b'))
})

test('single candidate maps to high confidence', () => {
  const only = cand('only', { x: 102, y: 102, width: 100, height: 40 }, { type: 'code' })
  const res = resolve(mark, [only])
  assert.equal(res.target.candidateId, 'only')
  assert.equal(res.target.confidence, 'high')
})

test('no candidates => low confidence, empty id', () => {
  const res = resolve(mark, [])
  assert.equal(res.target.confidence, 'low')
  assert.equal(res.target.candidateId, '')
})

test('classifyConfidence thresholds', () => {
  assert.equal(classifyConfidence(0.9, 0.4), 'high')
  assert.equal(classifyConfidence(0.6, 0.4), 'medium')
  assert.equal(classifyConfidence(0.5, 0.45), 'low')
  assert.equal(classifyConfidence(0.8, undefined), 'high')
})

test('bboxCenter and centerDistance helpers', () => {
  assert.deepEqual(bboxCenter({ x: 0, y: 0, width: 10, height: 10 }), { cx: 5, cy: 5 })
  assert.equal(centerDistance({ x: 0, y: 0, width: 10, height: 0 }, { x: 10, y: 0, width: 10, height: 0 }), 10)
})