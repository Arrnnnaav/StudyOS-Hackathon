// StudyOS Extension Side Panel Script

const API_BASE = 'http://localhost:3000/api' // Change to production URL

// DOM Elements
const emptyState = document.getElementById('emptyState')
const questionForm = document.getElementById('questionForm')
const answerDisplay = document.getElementById('answerDisplay')
const pairingFlow = document.getElementById('pairingFlow')
const mainContent = document.getElementById('mainContent')

const selectedTextDisplay = document.getElementById('selectedTextDisplay')
const domainBadge = document.getElementById('domainBadge')
const questionInput = document.getElementById('questionInput')
const askBtn = document.getElementById('askBtn')
const cancelBtn = document.getElementById('cancelBtn')
const answerContent = document.getElementById('answerContent')
const helpfulBtn = document.getElementById('helpfulBtn')
const notHelpfulBtn = document.getElementById('notHelpfulBtn')
const saveReviewBtn = document.getElementById('saveReviewBtn')
const newQuestionBtn = document.getElementById('newQuestionBtn')
const historyList = document.getElementById('historyList')

const pairBtn = document.getElementById('pairBtn')
const openSidePanelBtn = document.getElementById('openSidePanelBtn')
const pairingCodeInput = document.getElementById('pairingCodeInput')
const submitPairBtn = document.getElementById('submitPairBtn')
const cancelPairBtn = document.getElementById('cancelPairBtn')
const cancelPairBtn2 = document.getElementById('cancelPairBtn')

const levelSelect = document.getElementById('levelSelect')
const researchToggle = document.getElementById('researchToggle')

let currentAskId = null
let currentTopicId = null

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthState()
  loadPendingSelection()
  loadHistory()
  setupEventListeners()
})

async function checkAuthState() {
  const token = await getExtensionToken()
  if (token) {
    showMainContent()
  } else {
    showEmptyState()
  }
}

function getExtensionToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get('studyos_extension_token', (result) => {
      resolve(result.studyos_extension_token || null)
    })
  }
}

function saveExtensionToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ studyos_extension_token: token }, resolve)
  })
}

function clearExtensionToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('studyos_extension_token', resolve)
  })
}

async function loadPendingSelection() {
  return new Promise((resolve) => {
    chrome.storage.session.get('studyos_pending_selection', (result) => {
      const selection = result.studyos_pending_selection
      if (selection) {
        showQuestionForm(selection)
        chrome.storage.session.remove('studyos_pending_selection')
      }
      resolve()
    })
  })
}

async function loadHistory() {
  try {
    const response = await apiRequest('/ask/history', { method: 'GET' })
    if (response.history) {
      renderHistory(response.history)
    }
  } catch (error) {
    console.log('No history available')
  }
}

function setupEventListeners() {
  // Ask button
  askBtn.addEventListener('click', handleAsk)
  
  // Cancel
  cancelBtn.addEventListener('click', () => {
    showEmptyState()
  })
  
  // New question
  newQuestionBtn.addEventListener('click', () => {
    showEmptyState()
  })
  
  // Feedback
  helpfulBtn.addEventListener('click', () => submitFeedback(true))
  notHelpfulBtn.addEventListener('click', () => submitFeedback(false))
  
  // Save to review
  saveReviewBtn.addEventListener('click', handleSaveReview)
  
  // Pairing
  pairBtn.addEventListener('click', showPairingFlow)
  openSidePanelBtn.addEventListener('click', showPairingFlow)
  submitPairBtn.addEventListener('click', handlePair)
  cancelPairBtn.addEventListener('click', hidePairingFlow)
  cancelPairBtn2?.addEventListener('click', hidePairingFlow)
  
  // Pairing code input formatting
  pairingCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  })
  
  // Enter key for question
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  })
  
  // Enter key for pairing
  pairingCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handlePair()
    }
  })
}

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
    showEmptyState()
    throw new Error('Authentication expired. Please pair again.')
  }
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Request failed')
  }
  
  return response.json()
}

function getDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get('studyos_device_id', (result) => {
      let deviceId = result.studyos_device_id
      if (!deviceId) {
        deviceId = 'dev-' + crypto.randomUUID()
        chrome.storage.local.set({ studyos_device_id: deviceId })
      }
      resolve(deviceId)
    })
  }
}

function showEmptyState() {
  emptyState.classList.remove('hidden')
  questionForm.classList.add('hidden')
  answerDisplay.classList.add('hidden')
  pairingFlow.classList.add('hidden')
  mainContent.classList.remove('hidden')
}

function showQuestionForm(selection) {
  emptyState.classList.add('hidden')
  questionForm.classList.remove('hidden')
  answerDisplay.classList.add('hidden')
  pairingFlow.classList.add('hidden')
  mainContent.classList.remove('hidden')
  
  // Populate selection
  selectedTextDisplay.textContent = selection.selectedText
  domainBadge.textContent = selection.domain
  domainBadge.classList.remove('hidden')
  
  // Focus question input
  setTimeout(() => questionInput.focus(), 100)
  
  currentTopicId = selection.topicId || null
}

function showAnswerDisplay(data) {
  emptyState.classList.add('hidden')
  questionForm.classList.add('hidden')
  answerDisplay.classList.remove('hidden')
  pairingFlow.classList.add('hidden')
  mainContent.classList.remove('hidden')
  
  currentAskId = data.askId
  currentTopicId = data.topicId
  
  // Render answer with markdown-like formatting
  answerContent.innerHTML = formatAnswer(data.answer)
  
  // Track event
  trackEvent('answer_viewed', { askId: data.askId })
}

function formatAnswer(text) {
  // Simple markdown-like formatting
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n```([\s\S]*?)```\n/g, '<pre><code>$1</code></pre>')
    .replace(/\n```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n/g, '<br>')
}

async function handleAsk() {
  const question = questionInput.value.trim()
  if (!question) return
  
  // Get selection from storage
  const selection = await getStoredSelection()
  if (!selection) {
    alert('No selection found. Please select text first.')
    return
  }
  
  askBtn.disabled = true
  askBtn.textContent = 'Asking...'
  
  try {
    const response = await apiRequest('/ask', {
      method: 'POST',
      body: JSON.stringify({
        extension_session_token: await getExtensionToken(),
        topic_id: currentTopicId,
        context: {
          selected_text: selection.selectedText,
          nearby_before: selection.nearbyBefore,
          nearby_after: selection.nearbyAfter,
          domain: selection.domain,
          page_title: selection.pageTitle
        },
        question,
        level: levelSelect.value,
        research_mode: researchToggle.checked
      })
    })
    
    showAnswerDisplay(response)
    questionInput.value = ''
  } catch (error) {
    alert('Error: ' + error.message)
  } finally {
    askBtn.disabled = false
    askBtn.textContent = 'Ask StudyOS'
  }
}

function getStoredSelection() {
  return new Promise((resolve) => {
    chrome.storage.session.get('studyos_pending_selection', (result) => {
      resolve(result.studyos_pending_selection)
    })
  }
}

async function submitFeedback(helpful) {
  if (!currentAskId) return
  
  const reason = helpful ? null : prompt('What was wrong? (optional)')
  
  try {
    await apiRequest('/ask/feedback', {
      method: 'POST',
      body: JSON.stringify({
        extension_session_token: await getExtensionToken(),
        askId: currentAskId,
        helpful,
        reason
      })
    })
    
    // Update UI
    helpfulBtn.disabled = true
    notHelpfulBtn.disabled = true
    helpfulBtn.classList.add('opacity-50')
    notHelpfulBtn.classList.add('opacity-50')
    
    if (helpful) {
      helpfulBtn.classList.add('ring-2', 'ring-emerald-500')
    } else {
      notHelpfulBtn.classList.add('ring-2', 'ring-red-500')
    }
    
    trackEvent('feedback_submitted', { askId: currentAskId, helpful })
  } catch (error) {
    alert('Error submitting feedback: ' + error.message)
  }
}

async function handleSaveReview() {
  if (!currentAskId) return
  
  try {
    await apiRequest('/ask/save-review', {
      method: 'POST',
      body: JSON.stringify({
        extension_session_token: await getExtensionToken(),
        askId: currentAskId
      })
    })
    
    saveReviewBtn.disabled = true
    saveReviewBtn.textContent = '✓ Saved to Review'
    saveReviewBtn.classList.add('opacity-50')
    
    trackEvent('review_saved', { askId: currentAskId })
    
    // Reload history
    loadHistory()
  } catch (error) {
    alert('Error saving review: ' + error.message)
  }
}

function showPairingFlow() {
  emptyState.classList.add('hidden')
  questionForm.classList.add('hidden')
  answerDisplay.classList.add('hidden')
  pairingFlow.classList.remove('hidden')
  mainContent.classList.remove('hidden')
  pairingCodeInput.focus()
}

function hidePairingFlow() {
  pairingFlow.classList.add('hidden')
  showEmptyState()
}

async function handlePair() {
  const code = pairingCodeInput.value.trim().toUpperCase()
  if (!code || code.length !== 6) {
    alert('Please enter a valid 6-character code')
    return
  }
  
  submitPairBtn.disabled = true
  submitPairBtn.textContent = 'Connecting...'
  
  try {
    const response = await fetch(`${API_BASE}/extension/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Pairing failed')
    }
    
    const { token, expiresAt } = await response.json()
    await saveExtensionToken(token)
    
    hidePairingFlow()
    showEmptyState()
    
    // Track event
    trackEvent('extension_paired', {})
    
  } catch (error) {
    alert('Pairing failed: ' + error.message)
  } finally {
    submitPairBtn.disabled = false
    submitPairBtn.textContent = 'Connect'
  }
}

function renderHistory(history) {
  if (!history || history.length === 0) {
    historyList.innerHTML = '<p class="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">No questions yet</p>'
    return
  }
  
  historyList.innerHTML = history.slice(0, 10).map(item => `
    <div class="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
      <div class="flex items-start gap-2">
        <span class="text-lg">${item.helpful === true ? '👍' : item.helpful === false ? '👎' : '❓'}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">${item.question}</p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">${item.domain} • ${formatRelativeTime(item.createdAt)}</p>
        </div>
      </div>
    `).join('')
}

function formatRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

async function trackEvent(eventName, properties = {}) {
  try {
    await apiRequest('/events', {
      method: 'POST',
      body: JSON.stringify({
        eventName,
        properties,
        deviceId: await getDeviceId()
      })
    })
  } catch (error) {
    // Silently fail for tracking
  }
}

console.log('StudyOS side panel loaded')