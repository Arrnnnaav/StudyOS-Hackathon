import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const backgroundSource = readFileSync(new URL('./background.js', import.meta.url), 'utf8')

function loadBackground() {
  const storage = {
    studyos_extension_token: 'paired-extension-token',
    studyos_device_id: 'test-device',
  }
  let messageListener
  let savedRequest

  const localStorage = {
    get(key, callback) {
      const value = { [key]: storage[key] }
      if (callback) callback(value)
      else return Promise.resolve(value)
    },
    set(values, callback) {
      Object.assign(storage, values)
      callback?.()
      return Promise.resolve()
    },
    remove(key, callback) {
      delete storage[key]
      callback?.()
      return Promise.resolve()
    },
  }

  const chrome = {
    storage: { local: localStorage, session: { set: async () => {} } },
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
    runtime: {
      onMessage: { addListener(listener) { messageListener = listener } },
      onInstalled: { addListener() {} },
    },
    contextMenus: { create() {}, onClicked: { addListener() {} } },
    commands: { onCommand: { addListener() {} } },
    tabs: { query: async () => [], sendMessage: async () => ({ ok: true }) },
    scripting: { executeScript: async () => [] },
  }

  vm.runInNewContext(backgroundSource, {
    chrome,
    console,
    crypto: webcrypto,
    fetch: async (_url, options) => {
      savedRequest = JSON.parse(options.body)
      const authorized = savedRequest.extension_session_token === 'paired-extension-token'
      return {
        ok: authorized,
        status: authorized ? 200 : 401,
        json: async () => authorized ? { success: true, reviewId: 'review-1' } : { error: 'Unauthorized' },
      }
    },
    setTimeout,
    clearTimeout,
  })

  return {
    async send(message) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('background did not respond')), 100)
        const respond = (response) => {
          clearTimeout(timer)
          resolve(response)
        }
        assert.equal(messageListener(message, {}, respond), true)
      })
    },
    get savedRequest() { return savedRequest },
  }
}

test('spatial Save to Review reaches the API with the paired extension token', async () => {
  const background = loadBackground()
  const response = await background.send({ type: 'spatial:save-review', askId: 'ask-1' })

  assert.deepEqual({ ...response }, { ok: true, success: true, reviewId: 'review-1' })
  assert.deepEqual(background.savedRequest, { askId: 'ask-1', extension_session_token: 'paired-extension-token' })
})
