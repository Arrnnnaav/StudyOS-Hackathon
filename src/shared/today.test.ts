import test from 'node:test'
import assert from 'node:assert/strict'
import type { Topic } from '../data/dsa-curriculum'
import {
  todayPick,
  toStatusMap,
  statusOf,
  prerequisitesDone,
  evidenceLabel,
  progressStats,
} from './today.ts'

function topic(id: string, prerequisites: string[] = []): Topic {
  return {
    id,
    title: id,
    description: '',
    whyItMatters: '',
    objectives: [],
    prerequisites,
    estimatedMinutes: 30,
    difficulty: 1,
    importance: 50,
    resources: [],
  }
}

const topics = [
  topic('complexity-basics'),
  topic('arrays', ['complexity-basics']),
  topic('hashing', ['arrays']),
  topic('binary-search', ['complexity-basics']),
]

test('toStatusMap builds a lookup map', () => {
  const map = toStatusMap([
    { topicId: 'arrays', status: 'done' },
    { topicId: 'hashing', status: 'in_progress' },
  ])
  assert.equal(map['arrays'], 'done')
  assert.equal(map['hashing'], 'in_progress')
  // statusOf applies the not_started default for missing topics.
  assert.equal(statusOf(map, 'binary-search'), 'not_started')
})

test('a due review is today’s first action', () => {
  const pick = todayPick(topics, toStatusMap([]), 2)
  assert.equal(pick.kind, 'review')
  if (pick.kind === 'review') assert.equal(pick.reviewsDue, 2)
})

test('an in-progress topic is picked before the next topic', () => {
  const map = toStatusMap([{ topicId: 'arrays', status: 'in_progress' }])
  const pick = todayPick(topics, map, 0)
  assert.equal(pick.kind, 'topic')
  if (pick.kind === 'topic') {
    assert.equal(pick.topic.id, 'arrays')
    assert.equal(pick.continued, true)
  }
})

test('picks the first prerequisite-ready topic from the start', () => {
  const pick = todayPick(topics, toStatusMap([]), 0)
  assert.equal(pick.kind, 'topic')
  if (pick.kind === 'topic') {
    assert.equal(pick.topic.id, 'complexity-basics')
    assert.equal(pick.continued, false)
  }
})

test('with the first topic done, the next curriculum topic unlocks and wins', () => {
  const map = toStatusMap([{ topicId: 'complexity-basics', status: 'done' }])
  const pick = todayPick(topics, map, 0)
  assert.equal(pick.kind, 'topic')
  if (pick.kind === 'topic') {
    // Both arrays and binary-search are eligible once complexity-basics is done.
    // Curriculum order puts arrays first -> it is picked.
    assert.equal(pick.topic.id, 'arrays')
  }
})

test('binary-search stays gated until its own prerequisites are done', () => {
  // arrays is in progress but NOT done -> binary-search is locked.
  const map = toStatusMap([
    { topicId: 'complexity-basics', status: 'done' },
    { topicId: 'arrays', status: 'in_progress' },
  ])
  const pick = todayPick(topics, map, 0)
  assert.equal(pick.kind, 'topic')
  if (pick.kind === 'topic') assert.notEqual(pick.topic.id, 'binary-search')
})

test('all done when everything is completed', () => {
  const map = toStatusMap(topics.map((t) => ({ topicId: t.id, status: 'done' })))
  const pick = todayPick(topics, map, 0)
  assert.equal(pick.kind, 'done')
})

test('prerequisitesDone reflects prerequisite map', () => {
  const map = toStatusMap([{ topicId: 'complexity-basics', status: 'done' }])
  assert.equal(prerequisitesDone(topics[1], map), true)
  assert.equal(prerequisitesDone(topics[3], map), true)
  assert.equal(prerequisitesDone(topics[2], map), false) // hashing needs arrays
})

test('evidenceLabel transitions follow "complete ≠ mastery"', () => {
  assert.equal(evidenceLabel({ status: 'not_started', questionsAsked: 0, reviewsCompleted: 0 }), 'No Evidence')
  assert.equal(evidenceLabel({ status: 'in_progress', questionsAsked: 0, reviewsCompleted: 0 }), 'Developing')
  assert.equal(evidenceLabel({ status: 'done', questionsAsked: 0, reviewsCompleted: 0 }), 'Developing')
  assert.equal(evidenceLabel({ status: 'done', questionsAsked: 2, reviewsCompleted: 0 }), 'Developing')
  assert.equal(evidenceLabel({ status: 'done', questionsAsked: 2, reviewsCompleted: 1 }), 'Reviewed')
})

test('progressStats counts done topics', () => {
  const map = toStatusMap([
    { topicId: 'complexity-basics', status: 'done' },
    { topicId: 'arrays', status: 'done' },
  ])
  assert.deepEqual(progressStats(topics, map), { done: 2, total: 4 })
})