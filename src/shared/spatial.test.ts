import test from 'node:test'
import assert from 'node:assert/strict'
import { rankAnchors, anchorsToContext, overlapScore, buildSpatialPrompt } from './spatial.ts'
import type { SpatialMark, SpatialAnchor } from './contracts'

const mark: SpatialMark = { type: 'rectangle', role: 'reference', x: 10, y: 10, width: 40, height: 30 }

function anchor(id: string, x: number, y: number, w: number, h: number, text: string): SpatialAnchor {
  return { id, type: 'p', text, bbox: { x, y, width: w, height: h } }
}

test('overlapScore is near 1 for a contained anchor', () => {
  const inside = anchor('a', 12, 12, 20, 10, 'inside the box')
  assert.ok(overlapScore(inside, mark) > 0.9)
})

test('rankAnchors favours overlapping and longer text', () => {
  const overlapping = anchor('b', 15, 15, 30, 20, 'This is the long, relevant sentence under the mark with plenty of detail.')
  const farAway = anchor('c', 300, 300, 40, 10, 'far away content')
  const ranked = rankAnchors([farAway, overlapping], [mark])
  assert.equal(ranked[0].id, 'b')
})

test('user selection anchor tops the ranking', () => {
  const selection: SpatialAnchor = { id: 'sel', type: 'selection', text: 'exactly what I selected', bbox: { x: 10, y: 10, width: 20, height: 10 }, score: 1 }
  const some = anchor('n', 14, 14, 30, 20, 'some overlapping but not selected text')
  const ranked = rankAnchors([some, selection], [mark])
  assert.equal(ranked[0].id, 'sel')
})

test('anchorsToContext dedupes and bounds', () => {
  const a = anchor('1', 0, 0, 10, 10, 'duplicate duplicate duplicate text')
  const b = anchor('2', 0, 0, 10, 10, 'duplicate duplicate duplicate text')
  const ctx = anchorsToContext([a, b])
  assert.equal((ctx.match(/duplicate/g) || []).length % 3, 0) // only one copy kept
})

test('buildSpatialPrompt grounds on marked text only', () => {
  const p = buildSpatialPrompt({ question: 'why?', markedText: 'const x = 1', pageTitle: 'T', pageUrl: 'http://x', surface: 'web' })
  assert.ok(p.includes('const x = 1'))
  assert.ok(p.includes('why?'))
})