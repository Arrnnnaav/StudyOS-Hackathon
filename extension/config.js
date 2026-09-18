/* StudyOS extension config — edition point for api base. */
window.STUDYOS_SPATIAL = {
  apiBase: (typeof window !== 'undefined' && window.__STUDYOS_API_BASE__) || 'http://localhost:3000/api',
  productName: 'StudyOS',
};
if (typeof self !== 'undefined') {
  self.STUDYOS_SPATIAL = self.STUDYOS_SPATIAL || window.STUDYOS_SPATIAL;
}