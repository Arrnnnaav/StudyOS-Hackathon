// StudyOS Extension Content Script
// Captures text selection and nearby DOM context

let selectionOverlay = null
let isSelecting = false

// Initialize
function init() {
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('keydown', handleKeyDown)
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SELECTION') {
      const selection = getCurrentSelection()
      sendResponse(selection)
    }
  })
}

function getCurrentSelection() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return null
  
  const selectedText = selection.toString().trim()
  if (!selectedText) return null
  
  // Get range
  const range = selection.getRangeAt(0)
  
  // Get nearby context (500 chars before/after)
  const container = range.commonAncestorContainer
  const textContent = container.textContent || ''
  const startOffset = range.startOffset
  const endOffset = range.endOffset
  
  // For text nodes, get surrounding text
  let nearbyBefore = ''
  let nearbyAfter = ''
  
  if (container.nodeType === Node.TEXT_NODE) {
    const fullText = container.textContent
    nearbyBefore = fullText.substring(Math.max(0, startOffset - 500), startOffset)
    nearbyAfter = fullText.substring(endOffset, Math.min(fullText.length, endOffset + 500))
  } else {
    // For elements, get text content around range
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    )
    
    let foundStart = false
    let beforeText = ''
    let afterText = ''
    
    while (walker.nextNode()) {
      const node = walker.currentNode
      const nodeText = node.textContent
      
      if (!foundStart) {
        if (node === range.startContainer) {
          foundStart = true
          beforeText = nodeText.substring(Math.max(0, range.startOffset - 500), range.startOffset)
        } else {
          beforeText = nodeText.slice(-500) + beforeText
        }
      } else {
        afterText += nodeText.substring(0, 500)
        if (afterText.length >= 500) break
      }
    }
    
    nearbyBefore = beforeText.slice(-500)
    nearbyAfter = afterText.slice(0, 500)
  }
  
  return {
    selectedText,
    nearbyBefore,
    nearbyAfter,
    pageUrl: window.location.href,
    pageTitle: document.title,
    domain: window.location.hostname
  }
}

function handleMouseUp(event) {
  // Check for keyboard shortcut (Alt+Shift+A)
  if (event.altKey && event.shiftKey && event.key === 'a') {
    event.preventDefault()
    const selection = getCurrentSelection()
    if (selection) {
      openSidePanelWithSelection(selection)
    }
    return
  }
  
  // Normal selection handling
  const selection = getCurrentSelection()
  if (selection) {
    // Store for context menu
    window.__studyos_last_selection = selection
  }
}

function handleKeyDown(event) {
  // Alt+Shift+A to capture selection
  if (event.altKey && event.shiftKey && event.key === 'A') {
    event.preventDefault()
    const selection = getCurrentSelection()
    if (selection) {
      openSidePanelWithSelection(selection)
    }
  }
}

function openSidePanelWithSelection(selection) {
  // Store selection for side panel
  chrome.storage.session.set({ 
    'studyos_pending_selection': selection 
  })
  
  // Open side panel
  chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' })
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

console.log('StudyOS content script loaded')