// StudyOS Extension Background Script
// Handles auth, pairing, API communication, and the spatial Point & Ask overlay.

// API base: the published extension uses LearningHQ. Developers may override it
// locally without exposing an endpoint chooser to students.
const DEFAULT_API_BASE = 'https://le-eee1a14046a44cd1b2f9d6fe82789fda.ecs.us-east-1.on.aws/api'
let API_BASE = DEFAULT_API_BASE
async function apiBase() {
  try {
    const { studyos_api_base } = await chrome.storage.local.get('studyos_api_base')
    return studyos_api_base || DEFAULT_API_BASE
  } catch {
    return DEFAULT_API_BASE
  }
}
const STORAGE_KEYS = {
  EXTENSION_TOKEN: 'studyos_extension_token',
  DEVICE_ID: 'studyos_device_id',
  USER_ID: 'studyos_user_id'
}

// Generate or get device ID
function getDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.DEVICE_ID, (result) => {
      let deviceId = result[STORAGE_KEYS.DEVICE_ID]
      if (!deviceId) {
        deviceId = 'dev-' + crypto.randomUUID()
        chrome.storage.local.set({ [STORAGE_KEYS.DEVICE_ID]: deviceId })
      }
      resolve(deviceId)
    })
  })
}

// Get extension session token
async function getExtensionToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.EXTENSION_TOKEN, (result) => {
      resolve(result[STORAGE_KEYS.EXTENSION_TOKEN] || null)
    })
  })
}

// Save extension token
async function saveExtensionToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.EXTENSION_TOKEN]: token }, resolve)
  })
}

// Clear extension token
async function clearExtensionToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(STORAGE_KEYS.EXTENSION_TOKEN, resolve)
  })
}

// Pair with pairing code
async function pairWithCode(code) {
  const response = await fetch(`${await apiBase()}/extension/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.toUpperCase() })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Pairing failed')
  }
  
  const { token, expiresAt } = await response.json()
  await saveExtensionToken(token)
  return { token, expiresAt }
}

// Create pairing code
async function createPairingCode(email) {
  const response = await fetch(`${await apiBase()}/extension/pair-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create pairing code')
  }
  
  return response.json()
}

// Make authenticated API request
async function apiRequest(endpoint, options = {}) {
  const token = await getExtensionToken()
  const deviceId = await getDeviceId()
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  headers['X-Device-ID'] = deviceId
  
  const response = await fetch(`${await apiBase()}${endpoint}`, {
    ...options,
    headers
  })
  
  if (response.status === 401) {
    await clearExtensionToken()
    throw new Error('Authentication expired. Please pair again.')
  }
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Request failed')
  }
  
  return response.json()
}

// Ask question
async function askQuestion(data) {
  return apiRequest('/ask', {
    method: 'POST',
    body: JSON.stringify({ ...data, idempotency_key: data.idempotency_key || crypto.randomUUID() })
  })
}

// Submit feedback
async function submitFeedback(askId, helpful, reason) {
  return apiRequest(`/ask/feedback`, {
    method: 'POST',
    body: JSON.stringify({ askId, helpful, reason })
  })
}

// Save to review
async function saveToReview(askId) {
  return apiRequest(`/ask/save-review`, {
    method: 'POST',
    body: JSON.stringify({ askId })
  })
}

// Track event
async function trackEvent(eventName, properties = {}) {
  return apiRequest('/events', {
    method: 'POST',
    body: JSON.stringify({
      eventName,
      properties,
      deviceId: await getDeviceId()
    })
  })
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    async PAIR_WITH_CODE({ code }) {
      try {
        const result = await pairWithCode(code)
        sendResponse({ success: true, ...result })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
    },
    
    async GET_EXTENSION_TOKEN() {
      const token = await getExtensionToken()
      sendResponse({ token })
    },
    
    async ASK_QUESTION({ data }) {
      try {
        const result = await askQuestion(data)
        sendResponse({ success: true, ...result })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
    },
    
    async SUBMIT_FEEDBACK({ askId, helpful, reason }) {
      try {
        await submitFeedback(askId, helpful, reason)
        sendResponse({ success: true })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
    },
    
    async SAVE_TO_REVIEW({ askId }) {
      try {
        const result = await saveToReview(askId)
        sendResponse({ success: true, ...result })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
    },
    
    async TRACK_EVENT({ eventName, properties }) {
      try {
        await trackEvent(eventName, properties)
        sendResponse({ success: true })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
    },
    
    async OPEN_SIDE_PANEL() {
      const tab = sender.tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
      if (!tab?.windowId) throw new Error('Open a browser tab before pairing')
      await chrome.sidePanel.open({ windowId: tab.windowId })
      sendResponse({ success: true })
    },
    async CAPTURE_SELECTION() {
      try {
        const tab = sender.tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
        const selection = await captureSelection(tab)
        if (!selection) return sendResponse({ ok: false, error: 'Select text on the page first.' })
        await chrome.storage.session.set({ studyos_pending_selection: selection })
        await chrome.sidePanel.open({ windowId: tab.windowId })
        sendResponse({ ok: true })
      } catch (error) {
        sendResponse({ ok: false, error: error.message })
      }
    },

    // ---- Spatial Point & Ask (rectangle/circle/pen) ----
    async TOGGLE_SPATIAL() {
      try {
        const res = await toggleSpatial(sender.tab)
        sendResponse(res)
      } catch (error) {
        sendResponse({ ok: false, error: error.message })
      }
    },
    async SPATIAL_ASK({ payload }) {
      try {
        const token = await getExtensionToken()
        const requestPayload = {
          ...payload,
          research: payload?.research === true,
          ...(payload?.idempotency_key ? { idempotency_key: payload.idempotency_key } : {}),
        }
        const res = await fetch(`${await apiBase()}/spatial/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Device-ID': await getDeviceId(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ ...requestPayload, extension_session_token: token })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return sendResponse({ ok: false, code: data.error?.code, error: data.error?.message || `request failed (${res.status})` })
        sendResponse({ ok: true, ...data })
      } catch (error) {
        sendResponse({ ok: false, error: error.message })
      }
    },
    async SPATIAL_FEEDBACK({ askId, helpful }) {
      try {
        await submitFeedback(askId, helpful, null)
        sendResponse({ ok: true })
      } catch (error) {
        sendResponse({ ok: false, error: error.message })
      }
    },
    async SPATIAL_SAVE_REVIEW({ askId }) {
      try {
        const result = await saveToReview(askId)
        sendResponse({ ok: true, ...result })
      } catch (error) {
        sendResponse({ ok: false, error: error.message })
      }
    }
  }
  
  const handler = handlers[message.type]
  if (handler) {
    handler(message).catch(err => {
      sendResponse({ success: false, error: err.message })
    })
    return true // Keep channel open for async response
  }
})

// Handle extension install
chrome.runtime.onInstalled.addListener(async () => {
  const deviceId = await getDeviceId()
  console.log('StudyOS extension installed', { deviceId })
  
  // Create context menu
  chrome.contextMenus.create({
    id: 'studyos-ask',
    title: 'Ask StudyOS about this selection',
    contexts: ['selection']
  })
})

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'studyos-ask' && info.selectionText) {
    const selection = await captureSelection(tab)
    if (selection) await chrome.storage.session.set({ studyos_pending_selection: selection })
    await chrome.sidePanel.open({ windowId: tab.windowId })
  }
})

async function captureSelection(tab) {
  if (!tab || tab.id == null) return null
  const [{ result: loaded } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => Boolean(globalThis.__studyosContentLoaded) })
  if (!loaded) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
  return chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' })
}

// ---- Spatial Point & Ask: Alt+Shift+A injection + API proxy ----
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'toggle-spatial') {
    toggleSpatial(tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]).catch(() => {})
  }
})

// Inject config + geometry + the overlay content script, then open it.
async function toggleSpatial(tab) {
  if (!tab || tab.id == null) return { ok: false, error: 'no active tab' }
  const [{ result: loaded } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => Boolean(window.__studyosSpatialLoaded) })
  if (!loaded) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['config.js', 'geometry.js', 'spatial-content.js'] })
  }
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'spatial:toggle' })
  return res || { ok: true }
}

console.log('StudyOS background script loaded')
