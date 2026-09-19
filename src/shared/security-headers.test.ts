import assert from 'node:assert/strict'
import test from 'node:test'
import { securityHeaders } from './security-headers.ts'

test('production security headers prevent framing, MIME sniffing, and insecure referrers', () => {
  const headers = Object.fromEntries(securityHeaders(false).map((header) => [header.key, header.value]))
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/)
  assert.match(headers['Content-Security-Policy'], /https:\/\/accounts\.google\.com/)
  assert.equal(headers['Strict-Transport-Security'], 'max-age=63072000; includeSubDomains')
})

test('development CSP permits Next.js eval support without weakening production CSP', () => {
  const development = Object.fromEntries(securityHeaders(true).map((header) => [header.key, header.value]))['Content-Security-Policy']
  const production = Object.fromEntries(securityHeaders(false).map((header) => [header.key, header.value]))['Content-Security-Policy']
  assert.match(development, /'unsafe-eval'/)
  assert.doesNotMatch(production, /'unsafe-eval'/)
})
