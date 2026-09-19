// StudyOS popup - opens the side panel or starts a spatial (circle/box) Point & Ask.
document.getElementById('openPanel').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SELECTION' })
    if (!response?.ok) throw new Error(response?.error || 'Select text on the page first.')
    window.close()
  } catch (e) {
    alert(e.message)
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
