/* StudyOS spatial Point & Ask overlay. Draw a rectangle/circle/freehand over the part you are
   reading and ask; the answer comes from /api/spatial/ask, grounded on the text under your mark.
   Injected by background.js on Alt+Shift+A. Requires config.js + geometry.js loaded first. */
(function () {
  'use strict';
  if (window.__studyosSpatialLoaded) return;
  window.__studyosSpatialLoaded = true;

  const G = window.StudyOSGeometry;
  const CFG = window.STUDYOS_SPATIAL || { apiBase: 'http://localhost:3000/api', productName: 'StudyOS' };
  const STROKE = '#16a34a', TARGET = '#2563eb';
  const state = { open: false, tool: 'rect', role: 'reference', marks: [], busy: false, drawing: null, research: true };
  let host, root, svg, toolbar, hint, panel;

  const CSS = `
    :host { all: initial; }
    .overlay { position: fixed; inset: 0; z-index: 2147483646; cursor: crosshair; touch-action: none; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .toolbar { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; align-items: center;
      background: #111827; color: #fff; border-radius: 999px; padding: 6px 10px; font: 500 13px/1 system-ui, sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,.4); z-index: 2147483647; cursor: default; white-space: nowrap; }
    .toolbar button { all: unset; cursor: pointer; padding: 6px 10px; border-radius: 999px; color: #d1d5db; }
    .toolbar button:hover { background: #1f2937; }
    .toolbar button.active { background: ${STROKE}; color: #fff; }
    .toolbar .sep { width: 1px; height: 18px; background: #374151; margin: 0 4px; }
    .panel { position: fixed; width: 360px; max-width: calc(100vw - 24px); background: #fff; color: #111827; border-radius: 14px;
      box-shadow: 0 18px 50px rgba(0,0,0,.28); font: 14px/1.45 system-ui, sans-serif; z-index: 2147483647; cursor: default; display: flex; flex-direction: column; overflow: hidden; }
    .panel header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .panel header b { color: ${STROKE}; }
    .panel header .close { margin-left: auto; all: unset; cursor: pointer; padding: 2px 6px; border-radius: 6px; color: #6b7280; }
    .thread { max-height: 40vh; overflow: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
    .q { align-self: flex-end; background: #eef2ff; padding: 7px 10px; border-radius: 12px 12px 3px 12px; max-width: 90%; white-space: pre-wrap; }
    .a { background: #fff; white-space: pre-wrap; }
    .a small { display: block; color: #6b7280; font-size: 11px; margin-top: 4px; }
    .a .actions { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
    .a .actions button { all: unset; cursor: pointer; font-size: 12px; color: #374151; padding: 3px 8px; border-radius: 6px; background: #f3f4f6; }
    .a .actions button.on { color: #fff; background: ${STROKE}; }
    .a .sources { margin-top: 6px; font-size: 11px; color: #6b7280; }
    .ask { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid #e5e7eb; align-items: flex-end; }
    textarea { flex: 1; resize: none; border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 10px; font: inherit; min-height: 40px; max-height: 120px; outline: none; }
    .ask button { all: unset; cursor: pointer; height: 38px; min-width: 38px; display: grid; place-items: center; border-radius: 10px; }
    .ask .send { background: #111827; color: #fff; padding: 0 12px; font-weight: 600; }
    .ask .send[disabled] { opacity: .5; }
    .meta { padding: 0 12px 10px; font-size: 11px; color: #6b7280; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .meta label { display: inline-flex; gap: 4px; align-items: center; color: #111827; cursor: pointer; }
  `;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'class') node.className = value; else if (key.startsWith('on')) node[key] = value; else node.setAttribute(key, value);
    }
    for (const child of children || []) node.append(child);
    return node;
  }

  function send(message) {
    return new Promise(resolve => chrome.runtime.sendMessage(message, response => resolve(response || { ok: false, error: chrome.runtime.lastError?.message || 'no response' })));
  }

  function svgNode(name, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    return node;
  }

  function build() {
    host = el('div', { id: 'studyos-spatial-host' });
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;';
    root = host.attachShadow({ mode: 'open' });
    root.append(el('style', {}, [CSS]));
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const overlay = el('div', { class: 'overlay' });
    overlay.append(svg);
    toolbar = el('div', { class: 'toolbar' }, [
      el('button', { 'data-tool': 'rect', class: 'active', onclick: () => setTool('rect') }, ['▭ Box']),
      el('button', { 'data-tool': 'circle', onclick: () => setTool('circle') }, ['◯ Circle']),
      el('button', { 'data-tool': 'pen', onclick: () => setTool('pen') }, ['✎ Pen']),
      el('span', { class: 'sep' }),
      el('button', { onclick: () => { state.marks = []; while (svg.firstChild) svg.removeChild(svg.firstChild); if (panel) { panel.remove(); panel = null; } } }, ['Clear']),
      el('button', { onclick: close }, ['Done (Esc)']),
    ]);
    hint = el('div', { style: 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:rgba(17,24,39,.9);color:#fff;padding:8px 14px;border-radius:10px;font:13px/1.3 system-ui;z-index:2147483647' },
      ['Drag a box around the code or text you are confused about, then ask below']);
    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
    root.append(overlay, toolbar, hint);
    document.documentElement.append(host);
  }

  function setTool(tool) {
    state.tool = tool;
    for (const b of toolbar.querySelectorAll('[data-tool]')) b.classList.toggle('active', b.dataset.tool === tool);
  }

  function open() {
    if (!host) build();
    host.style.display = '';
    state.open = true;
    document.addEventListener('keydown', onKey, true);
  }

  function close() {
    state.open = false;
    if (host) host.style.display = 'none';
    document.removeEventListener('keydown', onKey, true);
  }

  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }

  function onDown(event) {
    if (event.button !== 0 || (panel && panel.contains(event.target))) return;
    event.preventDefault();
    const start = [event.clientX, event.clientY];
    const color = state.role === 'target' ? TARGET : STROKE;
    let shape;
    if (state.tool === 'pen') shape = svgNode('path', { d: `M${start[0]} ${start[1]}`, fill: 'none', stroke: color, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    else if (state.tool === 'circle') shape = svgNode('ellipse', { fill: 'none', stroke: color, 'stroke-width': 4 });
    else shape = svgNode('rect', { fill: 'none', stroke: color, 'stroke-width': 4, rx: 6 });
    svg.append(shape);
    state.drawing = { start, points: [start], shape };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onMove(event) {
    const d = state.drawing; if (!d) return;
    const point = [event.clientX, event.clientY];
    if (state.tool === 'pen') { d.points.push(point); d.shape.setAttribute('d', d.shape.getAttribute('d') + ` L${point[0]} ${point[1]}`); return; }
    const box = G.shapeToMark(state.tool, d.start, point);
    if (state.tool === 'circle') { d.shape.setAttribute('cx', box.x + box.width / 2); d.shape.setAttribute('cy', box.y + box.height / 2); d.shape.setAttribute('rx', box.width / 2); d.shape.setAttribute('ry', box.height / 2); }
    else { d.shape.setAttribute('x', box.x); d.shape.setAttribute('y', box.y); d.shape.setAttribute('width', box.width); d.shape.setAttribute('height', box.height); }
    d.end = point;
  }

  function onUp(event) {
    const d = state.drawing; if (!d) return;
    state.drawing = null;
    const end = d.end || [event.clientX, event.clientY];
    const mark = state.tool === 'pen' ? G.strokeToMark(d.points, state.role) : G.shapeToMark(state.tool, d.start, end, state.role);
    if (mark.width < 6 && mark.height < 6) { d.shape.remove(); return; }
    mark.scrollX = window.scrollX; mark.scrollY = window.scrollY;
    state.marks.push(mark);
    hint.style.display = 'none';
    showPanel(mark);
  }

  /* Collect DOM text/elements under each mark (never the whole page). */
  function unionBox(marks) {
    const x = Math.min(...marks.map(m => m.x)), y = Math.min(...marks.map(m => m.y));
    return { x, y, width: Math.max(...marks.map(m => m.x + m.width)) - x, height: Math.max(...marks.map(m => m.y + m.height)) - y };
  }

  function elementText(element) {
    if (element.matches('img,svg,canvas,video,picture')) return (element.getAttribute('alt') || element.getAttribute('aria-label') || element.getAttribute('title') || '').trim();
    if (element.matches('input,textarea,select')) return (element.value || element.placeholder || '').trim();
    return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function collectAnchors(marks) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const seen = new Map();
    host.style.pointerEvents = 'none';
    try {
      for (const mark of marks) {
        for (const [x, y] of G.samplePoints(mark, 6)) {
          if (x < 0 || y < 0 || x > viewport.width || y > viewport.height) continue;
          for (const element of document.elementsFromPoint(x, y).slice(0, 6)) {
            if (element === host || element === document.documentElement || element === document.body || seen.has(element)) continue;
            const rect = element.getBoundingClientRect();
            const bbox = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
            if (!G.anchorFilter(bbox, mark, viewport)) continue;
            const text = elementText(element).slice(0, 600);
            if (!text && !element.matches('img,svg,canvas,video')) continue;
            seen.set(element, { id: 'el-' + seen.size, type: element.tagName.toLowerCase(), text, bbox,
              href: element.closest('a[href]')?.href || '', src: element.currentSrc || element.src || '' });
          }
        }
      }
    } finally { host.style.pointerEvents = ''; }
    const box = unionBox(marks);
    const ranked = G.rankAnchors([...seen.values()], box).slice(0, 10);
    const selection = window.getSelection && window.getSelection();
    if (selection && selection.rangeCount && String(selection).trim()) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      ranked.unshift({ id: 'selection', type: 'selection', text: String(selection).trim().slice(0, 700), score: 1,
        bbox: rect.width ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : box });
    }
    return ranked;
  }

  function showPanel(mark) {
    if (!panel) {
      panel = el('div', { class: 'panel' });
      const thread = el('div', { class: 'thread' });
      const input = el('textarea', { placeholder: 'Ask about what you circled… (Enter to send)', rows: 1 });
      const sendButton = el('button', { class: 'send', onclick: () => submit(input, thread, sendButton) }, ['Ask']);
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input, thread, sendButton); } e.stopPropagation(); });
      input.addEventListener('keyup', e => e.stopPropagation());
      panel.append(
        el('header', {}, [el('b', {}, ['STUDYOS · POINT & ASK']), el('button', { class: 'close', title: 'Close', onclick: close }, ['✕'])]),
        thread,
        el('div', { class: 'ask' }, [input, sendButton]),
        el('div', { class: 'meta' }, [
          el('label', { title: 'Ground on the circled text (no external sources).' }, [
            el('input', { type: 'checkbox', checked: '', onchange: e => { state.research = e.target.checked; } }),
            'Ground on circled text']),
        ]),
      );
      panel.addEventListener('pointerdown', e => e.stopPropagation());
      root.append(panel);
      setTimeout(() => input.focus(), 0);
    }
    const margin = 12, width = Math.min(360, window.innerWidth - 24);
    let left = mark.x + mark.width + margin;
    if (left + width > window.innerWidth - margin) left = Math.max(margin, mark.x - width - margin);
    panel.style.left = left + 'px';
    panel.style.top = Math.max(margin, Math.min(mark.y, window.innerHeight - 220)) + 'px';
  }

  async function submit(input, thread, sendButton) {
    const question = input.value.trim();
    if (!question || state.busy || !state.marks.length) return;
    state.busy = true; sendButton.disabled = true;
    thread.append(el('div', { class: 'q' }, [question]));
    input.value = '';
    const answerNode = el('div', { class: 'a' }, ['Looking at what you circled…']);
    thread.append(answerNode); thread.scrollTop = thread.scrollHeight;
    try {
      const marks = state.marks.map(m => ({ ...m }));
      const anchors = collectAnchors(marks);
      const viewer = window.__studyosPdfViewer || null;
      const result = await send({
        type: 'spatial:ask',
        payload: {
          question,
          marks,
          anchors,
          canvas: { width: window.innerWidth, height: window.innerHeight },
          page: {
            url: viewer ? viewer.fileUrl : location.href,
            title: (viewer ? viewer.title : document.title || location.hostname).slice(0, 500),
            surface: viewer ? 'pdf' : 'web',
          },
          research: state.research !== false,
        },
      });
      if (!result.ok) throw result;
      answerNode.textContent = '';
      answerNode.append(document.createTextNode(result.answer));
      answerNode.append(el('small', {}, [
        result.provider && result.provider !== 'none' ? result.provider + '/' + result.model : 'no model',
        ' · ' + (result.anchors_used?.length || 0) + ' anchor(s)',
        ' · ' + Math.round((result.confidence || 0) * 100) + '% confidence',
      ].join('')));
      const actions = el('div', { class: 'actions' });
      answerNode.append(actions);
      const helpful = el('button', { onclick: async () => { await send({ type: 'spatial:feedback', askId: result.id, helpful: true }); helpful.classList.add('on'); helpful.textContent = '✓ Helpful'; } }, ['👍 Helpful']);
      const save = el('button', { onclick: async () => { const r = await send({ type: 'spatial:save-review', askId: result.id }); save.textContent = r.ok ? '✓ Saved to Review' : '✗ ' + (r.error || 'failed'); } }, ['📚 Save to Review']);
      actions.append(helpful, save);
    } catch (error) {
      answerNode.className = 'a';
      answerNode.textContent = error.code ? error.error : (error.error || 'Something went wrong sending your question.');
      answerNode.append(el('small', {}, [error.code || 'ERROR']));
    } finally {
      state.busy = false; sendButton.disabled = false; thread.scrollTop = thread.scrollHeight; input.focus();
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return;
    if (message.type === 'spatial:toggle') {
      if (state.open) close(); else open();
      sendResponse({ ok: true, open: state.open });
    }
  });
  window.__studyosSpatialOpen = open;
  window.__studyosSpatialClose = close;
})();