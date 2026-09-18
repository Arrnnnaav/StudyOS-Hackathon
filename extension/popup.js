// StudyOS popup - opens the side panel or starts a spatial (circle/box) Point & Ask.
document.getElementById('openPanel').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    await chrome.sidePanel.open({ windowId: tab.windowId })
    window.close()
  } catch (e) {
    alert('Could not open side panel: ' + e.message)
  }
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