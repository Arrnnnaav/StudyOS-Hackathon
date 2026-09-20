/* StudyOS extension config — edition point for api base + feature flags. */
window.STUDYOS_SPATIAL = {
  apiBase: (typeof window !== 'undefined' && window.__STUDYOS_API_BASE__) || 'https://le-eee1a14046a44cd1b2f9d6fe82789fda.ecs.us-east-1.on.aws/api',
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
