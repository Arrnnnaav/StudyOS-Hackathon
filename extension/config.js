/* StudyOS extension config — edition point for api base + feature flags. */
window.STUDYOS_SPATIAL = {
  apiBase: (typeof window !== 'undefined' && window.__STUDYOS_API_BASE__) || 'http://localhost:3000/api',
  productName: 'StudyOS',
  features: {
    // Hackathon scope: rectangle only. circle/pen stay off unless flipped on.
    rectangleOnly: true,
  },
  // Privacy tier: what we send by default. anchors_only = resolved DOM object + nearby text only.
  privacy: 'anchors_only',
};
if (typeof self !== 'undefined') {
  self.STUDYOS_SPATIAL = self.STUDYOS_SPATIAL || window.STUDYOS_SPATIAL;
}