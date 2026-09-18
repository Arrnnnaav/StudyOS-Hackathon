// StudyOS popup - opens the side panel
document.getElementById('openPanel').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    await chrome.sidePanel.open({ windowId: tab.windowId })
    window.close()
  } catch (e) {
    alert('Could not open side panel: ' + e.message)
  }
})