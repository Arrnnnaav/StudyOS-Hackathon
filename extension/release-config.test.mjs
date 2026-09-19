import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const extensionFile = (file) => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
const appFile = (file) => readFileSync(new URL(`../src/app/${file}`, import.meta.url), 'utf8')

test('student extension uses the LearningHQ API without broad persistent page access', () => {
  const manifest = JSON.parse(extensionFile('manifest.json'))
  const config = extensionFile('config.js')
  const background = extensionFile('background.js')

  assert.deepEqual(manifest.host_permissions, ['https://learninghq.in/*'])
  assert.equal(manifest.content_scripts, undefined)
  assert.equal(manifest.web_accessible_resources, undefined)
  assert.match(config, /https:\/\/learninghq\.in\/api/)
  assert.match(background, /https:\/\/learninghq\.in\/api/)
})

test('student setup does not depend on a source folder or remotely hosted extension code', () => {
  const sidepanel = extensionFile('sidepanel.html')
  const pairingGuide = appFile('dashboard/settings/pairing-guide/page.tsx')

  assert.doesNotMatch(sidepanel, /https:\/\/cdn\.tailwindcss\.com/)
  assert.doesNotMatch(sidepanel, /https:\/\/fonts\.googleapis\.com/)
  assert.doesNotMatch(pairingGuide, /Load unpacked|extension folder|localhost:3000/)
  assert.match(pairingGuide, /Chrome Web Store/)
})
