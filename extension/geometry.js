/* StudyOS — shared geometry for spatial marks. Ported from learning-platform.
   Plain script: runs as a content script and preloader. Exposes SpatialGeometry. */
(function (root) {
  'use strict';
  if (root.StudyOSGeometry) return;

  function bboxOfPoints(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    return points.length ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : { x: 0, y: 0, width: 0, height: 0 };
  }

  function simplify(points, tolerance) {
    tolerance = tolerance || 2;
    const kept = [];
    for (const point of points) {
      const last = kept[kept.length - 1];
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= tolerance) kept.push(point);
    }
    if (points.length && kept[kept.length - 1] !== points[points.length - 1]) kept.push(points[points.length - 1]);
    return kept;
  }

  function strokeToMark(points, role) {
    const clean = simplify(points.map(p => [Math.round(p[0]), Math.round(p[1])]));
    const box = bboxOfPoints(clean);
    const first = clean[0] || [0, 0], last = clean[clean.length - 1] || first;
    const diag = Math.hypot(box.width, box.height) || 1;
    const closed = clean.length > 8 && Math.hypot(first[0] - last[0], first[1] - last[1]) < Math.max(24, diag * 0.35);
    const pad = closed ? 0 : Math.max(8, Math.min(40, diag * 0.15));
    return {
      type: 'polygon', role: role || 'reference', closed, points: clean,
      x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2,
    };
  }

  function shapeToMark(kind, start, end, role) {
    const x = Math.min(start[0], end[0]), y = Math.min(start[1], end[1]);
    return { type: kind === 'circle' ? 'circle' : 'rectangle', role: role || 'reference', x, y,
             width: Math.abs(end[0] - start[0]), height: Math.abs(end[1] - start[1]) };
  }

  function intersectArea(a, b) {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }

  function samplePoints(box, steps) {
    steps = steps || 6;
    const points = [];
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) points.push([box.x + (box.width * i) / steps, box.y + (box.height * j) / steps]);
    return points;
  }

  function anchorFilter(elementBox, markBox, viewport) {
    if (elementBox.width <= 0 || elementBox.height <= 0) return false;
    const elementArea = elementBox.width * elementBox.height;
    const markArea = Math.max(1, markBox.width * markBox.height);
    const viewportArea = Math.max(1, viewport.width * viewport.height);
    if (elementArea > viewportArea * 0.45 && markArea < viewportArea * 0.3) return false;
    if (elementArea > markArea * 6 && elementArea > 40000) return false;
    return intersectArea(elementBox, markBox) > 0;
  }

  function scoreAnchor(anchor, markBox) {
    const markArea = Math.max(0, markBox.width) * Math.max(0, markBox.height);
    const anchorArea = anchor.bbox.width * anchor.bbox.height;
    const inter = intersectArea(anchor.bbox, markBox);
    const union = markArea + anchorArea - inter;
    const iou = union ? inter / union : 0;
    const markOverlap = markArea ? inter / markArea : 0;
    const anchorOverlap = anchorArea ? inter / anchorArea : 0;
    const cx = markBox.x + markBox.width / 2, cy = markBox.y + markBox.height / 2;
    const containsCenter = anchor.bbox.x <= cx && cx <= anchor.bbox.x + anchor.bbox.width && anchor.bbox.y <= cy && cy <= anchor.bbox.y + anchor.bbox.height;
    const containsAnchor = markBox.x <= anchor.bbox.x && markBox.y <= anchor.bbox.y && markBox.x + markBox.width >= anchor.bbox.x + anchor.bbox.width && markBox.y + markBox.height >= anchor.bbox.y + anchor.bbox.height;
    return Math.max(iou, Math.min(0.94, markOverlap * 0.9), Math.min(0.95, anchorOverlap * 0.95), containsCenter && !markArea ? 0.95 : 0, containsAnchor ? 0.96 : 0);
  }

  function rankAnchors(anchors, markBox) {
    return anchors
      .filter(a => a.bbox && a.bbox.width >= 0 && a.bbox.height >= 0)
      .map(a => ({ ...a, score: Math.round(scoreAnchor(a, markBox) * 1000) / 1000 }))
      .filter(a => a.score >= 0.1)
      .sort((a, b) => b.score - a.score || (String(b.text || '').length - String(a.text || '').length) || (a.bbox.width * a.bbox.height) - (b.bbox.width * b.bbox.height));
  }

  const api = { bboxOfPoints, simplify, strokeToMark, shapeToMark, intersectArea, samplePoints, anchorFilter, scoreAnchor, rankAnchors };
  root.StudyOSGeometry = api;
  root.SpatialGeometry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);