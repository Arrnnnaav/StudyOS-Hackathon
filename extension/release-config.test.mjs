import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const extensionFile = (file) => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
const appFile = (file) => readFileSync(new URL(`../src/app/${file}`, import.meta.url), 'utf8')

test('student extension uses the LearningHQ API without broad persistent page access', () => {
  const manifest = JSON.parse(extensionFile('manifest.json'))
  const config = extensionFile('config.js')
  const background = extensionFile('background.js')
  const spatialContent = extensionFile('spatial-content.js')
  const sidepanel = extensionFile('sidepanel.js')

  assert.deepEqual(manifest.host_permissions, ['https://le-eee1a14046a44cd1b2f9d6fe82789fda.ecs.us-east-1.on.aws/*'])
  assert.equal(manifest.content_scripts, undefined)
  assert.equal(manifest.web_accessible_resources, undefined)
  assert.match(config, /https:\/\/le-eee1a14046a44cd1b2f9d6fe82789fda\.ecs\.us-east-1\.on\.aws\/api/)
  assert.match(background, /https:\/\/le-eee1a14046a44cd1b2f9d6fe82789fda\.ecs\.us-east-1\.on\.aws\/api/)
  assert.match(spatialContent, /https:\/\/le-eee1a14046a44cd1b2f9d6fe82789fda\.ecs\.us-east-1\.on\.aws\/api/)
  assert.match(sidepanel, /https:\/\/le-eee1a14046a44cd1b2f9d6fe82789fda\.ecs\.us-east-1\.on\.aws\/api/)
})

test('student setup does not depend on a source folder or remotely hosted extension code', () => {
  const sidepanel = extensionFile('sidepanel.html')
  const pairingGuide = appFile('dashboard/settings/pairing-guide/page.tsx')
  const settings = appFile('dashboard/settings/page.tsx')
  const spatialContent = extensionFile('spatial-content.js')
  const popup = extensionFile('popup.html')
  const popupScript = extensionFile('popup.js')

  assert.doesNotMatch(sidepanel, /https:\/\/cdn\.tailwindcss\.com/)
  assert.doesNotMatch(sidepanel, /https:\/\/fonts\.googleapis\.com/)
  assert.doesNotMatch(pairingGuide, /Load unpacked|extension folder|localhost:3000/)
  assert.doesNotMatch(settings, /Load unpacked|extension folder|localhost:3000/)
  assert.match(pairingGuide, /Chrome Web Store/)
  assert.match(settings, /Chrome Web Store/)
  assert.doesNotMatch(spatialContent, /localhost:3000/)
  assert.match(spatialContent, /Gemini Google Search/)
  assert.match(spatialContent, /Public-web fallback sources/)
  assert.match(popup, /id="pairExtension"/)
  assert.match(popupScript, /type: 'OPEN_SIDE_PANEL'/)
  assert.match(popupScript, /chrome\.sidePanel\.open/)
})

test('clearing a spatial selection also resets opt-in research mode', () => {
  const spatialContent = extensionFile('spatial-content.js')
  assert.match(spatialContent, /onclick:\s*\(\)\s*=>\s*\{\s*state\.marks\s*=\s*\[\];\s*state\.research\s*=\s*false;/)
})
