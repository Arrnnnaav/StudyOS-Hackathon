// StudyOS Extension Background Script
// Handles auth, pairing, and API communication

const API_BASE = 'http://localhost:3000/api' // Change to production URL
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
  const response = await fetch(`${API_BASE}/extension/pair`, {
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
  const response = await fetch(`${API_BASE}/extension/pair-code`, {
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
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
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
    body: JSON.stringify(data)
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
      await chrome.sidePanel.open({ windowId: sender.tab?.windowId })
      sendResponse({ success: true })
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
    // Open side panel with selection
    await chrome.sidePanel.open({ windowId: tab.windowId })
    
    // Send selection to side panel
    chrome.runtime.sendMessage({
      type: 'SELECTION_CAPTURED',
      data: {
        selectedText: info.selectionText,
        pageUrl: tab.url,
        pageTitle: tab.title
      }
    })
  }
})

console.log('StudyOS background script loaded')