// StudyOS popup - opens the side panel or starts a spatial (circle/box) Point & Ask.
let activeWindowId = null
void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  activeWindowId = tab?.windowId ?? null
})

document.getElementById('openPanel').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SELECTION' })
    if (!response?.ok) throw new Error(response?.error || 'Select text on the page first.')
    window.close()
  } catch (e) {
    alert(e.message)
  }
})

document.getElementById('pairExtension').addEventListener('click', () => {
  if (activeWindowId === null) {
    alert('Open the popup again, then select Pair extension with StudyOS.')
    return
  }

  // Must be invoked synchronously from this click; awaiting tab lookup first
  // causes Chrome to reject the call as no longer being a user gesture.
  void chrome.sidePanel.open({ windowId: activeWindowId })
    .then(() => window.close())
    .catch(() => alert('Chrome could not open the pairing panel. Use the browser Side panel button and choose StudyOS.'))
})

const spatialBtn = document.getElementById('spatialBtn')
if (spatialBtn) {
  spatialBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    chrome.runtime.sendMessage({ type: 'TOGGLE_SPATIAL' }, (res) => {
      window.close()
    })
  })
}
