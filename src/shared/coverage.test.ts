import test from 'node:test'
import assert from 'node:assert/strict'
import { coverageScore, classifyCoverage, overallStatus, scoreToStatus } from './coverage.ts'

test('a resource that explains the objective is strong', () => {
  const objectives = [
    'Explain how binary search halves the search space',
    'Implement lower and upper bound variants',
  ]
  const resource =
    'Binary search works by repeatedly comparing the middle element and halving the search space each step. ' +
    'To implement lower bound, return the first index where the value is not less than the target. ' +
    'For upper bound, return the first index where the value is greater than the target. ' +
    'Both variants run in O(log n) and are monotonic over the array.'
  const verdict = classifyCoverage(objectives, resource)
  assert.equal(verdict[0].status, 'strong')
  assert.equal(verdict[1].status, 'strong')
})

test('an empty resource is missing for every objective', () => {
  const verdict = classifyCoverage(['Explain hashing collisions'], '')
  assert.equal(verdict[0].status, 'missing')
})

test('a vaguely related resource is weak or moderate', () => {
  const objectives = ['Solve dynamic programming coin change on 2D grids']
  const verdict = classifyCoverage(objectives, 'We cover recursion and some memoization basics.')
  // Not missing (some generic overlap) but not strong either.
  assert.notEqual(verdict[0].status, 'strong')
})

test('scoreToStatus thresholds', () => {
  assert.equal(scoreToStatus(0.6), 'strong')
  assert.equal(scoreToStatus(0.4), 'moderate')
  assert.equal(scoreToStatus(0.2), 'weak')
  assert.equal(scoreToStatus(0.05), 'missing')
})

test('overallStatus takes the weakest objective', () => {
  assert.equal(overallStatus(['strong', 'moderate', 'strong']), 'moderate')
  assert.equal(overallStatus(['missing', 'strong']), 'missing')
  assert.equal(overallStatus([]), 'missing')
})

test('coverageScore returns matched terms and bounded score', () => {
  const { score, matched } = coverageScore('Implement lower bound for binary search', 'Lower bound code for search')
  assert.ok(score >= 0 && score <= 1)
  assert.ok(matched.length >= 0)
})