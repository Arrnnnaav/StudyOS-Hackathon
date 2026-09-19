/* StudyOS spatial Point & Ask overlay.
   Alt+Shift+A → draw a rectangle → studyOS resolves the object you circled (deterministically,
   no model guessing) → shows the "resolved target" chip for visible grounding → you ask →
   the answer is grounded on that resolved object via /api/spatial/ask.
   Privacy: anchors_only by default — only the resolved DOM object + nearby text leave the browser.
   Injected by background.js. Requires config.js + geometry.js loaded first. */
(function () {
  'use strict';
  if (window.__studyosSpatialLoaded) return;
  window.__studyosSpatialLoaded = true;

  const G = window.StudyOSGeometry;
  const CFG = window.STUDYOS_SPATIAL || { apiBase: 'http://localhost:3000/api', productName: 'StudyOS', features: {}, privacy: 'anchors_only' };
  const RECT_ONLY = CFG.features && CFG.features.rectangleOnly !== false;
  const PRIVACY = CFG.privacy || 'anchors_only';
  const STROKE = '#16a34a';
  const state = { open: false, tool: 'rect', marks: [], busy: false, drawing: null, research: false };
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
    .chip { margin: 8px 12px 0; padding: 7px 10px; border: 1px solid #d1fae5; background: #ecfdf5; color: #065f46; border-radius: 8px;
      font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .chip .conf { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
    .chip .conf.low { color: #b45309; }
    .chip .conf.medium { color: #b45309; }
    .chip .conf.high { color: #065f46; }
    .thread { max-height: 40vh; overflow: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
    .q { align-self: flex-end; background: #eef2ff; padding: 7px 10px; border-radius: 12px 12px 3px 12px; max-width: 90%; white-space: pre-wrap; }
    .a { background: #fff; white-space: pre-wrap; }
    .a small { display: block; color: #6b7280; font-size: 11px; margin-top: 4px; }
    .a .actions { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
    .a .actions button { all: unset; cursor: pointer; font-size: 12px; color: #374151; padding: 3px 8px; border-radius: 6px; background: #f3f4f6; }
    .a .actions button.on { color: #fff; background: ${STROKE}; }
    .ask { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid #e5e7eb; align-items: flex-end; }
    textarea { flex: 1; resize: none; border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 10px; font: inherit; min-height: 40px; max-height: 120px; outline: none; }
    .ask button { all: unset; cursor: pointer; height: 38px; min-width: 38px; display: grid; place-items: center; border-radius: 10px; }
    .ask .send { background: #111827; color: #fff; padding: 0 12px; font-weight: 600; }
    .ask .send[disabled] { opacity: .5; }
    .ambiguous { margin: 0 12px; padding: 8px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #92400e; }
    .ambiguous label { display: block; padding: 4px 6px; border-radius: 6px; cursor: pointer; margin-top: 2px; }
    .ambiguous label:hover { background: #fef3c7; }
    .ambiguous .chosen { background: #fef3c7; font-weight: 600; }
    .privacy { padding: 6px 12px 8px; border-top: 1px solid #e5e7eb; font-size: 10.5px; color: #6b7280; display: flex; flex-wrap: wrap; gap: 4px 10px; }
    .privacy .y { color: #065f46; } .privacy .n { color: #b91c1c; }
    .research-control { display:block; margin-top:6px; font-size:11px; color:#374151; cursor:pointer; }
    .research-disclosure { display:block; font-size:10px; color:#6b7280; margin-top:3px; }
    .sources { margin-top:8px; padding-top:6px; border-top:1px solid #e5e7eb; font-size:11px; }
    .sources a { display:block; color:#2563eb; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
    const tools = [el('button', { 'data-tool': 'rect', class: 'active', onclick: () => setTool('rect') }, ['▭ Box'])];
    if (!RECT_ONLY) {
      tools.push(el('button', { 'data-tool': 'circle', onclick: () => setTool('circle') }, ['◯ Circle']));
      tools.push(el('button', { 'data-tool': 'pen', onclick: () => setTool('pen') }, ['✎ Pen']));
    }
    toolbar = el('div', { class: 'toolbar' }, [
      ...tools, el('span', { class: 'sep' }),
      el('button', { onclick: () => { state.marks = []; while (svg.firstChild) svg.removeChild(svg.firstChild); if (panel) { panel.remove(); panel = null; } } }, ['Clear']),
      el('button', { onclick: close }, ['Done (Esc)']),
    ]);
    hint = el('div', { style: 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:rgba(17,24,39,.9);color:#fff;padding:8px 14px;border-radius:10px;font:13px/1.3 system-ui;z-index:2147483647' },
      ['Drag a box around the code or text you are confused about']);
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
    const shape = svgNode('rect', { fill: 'none', stroke: STROKE, 'stroke-width': 4, rx: 6 });
    svg.append(shape);
    state.drawing = { start, points: [start], shape };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onMove(event) {
    const d = state.drawing; if (!d) return;
    const point = [event.clientX, event.clientY];
    const box = G.shapeToMark('rectangle', d.start, point);
    d.shape.setAttribute('x', box.x); d.shape.setAttribute('y', box.y);
    d.shape.setAttribute('width', box.width); d.shape.setAttribute('height', box.height);
    d.end = point;
  }

  function onUp(event) {
    const d = state.drawing; if (!d) return;
    state.drawing = null;
    const end = d.end || [event.clientX, event.clientY];
    const mark = G.shapeToMark('rectangle', d.start, end, 'reference');
    if (mark.width < 6 && mark.height < 6) { d.shape.remove(); return; }
    mark.scrollX = window.scrollX; mark.scrollY = window.scrollY;
    state.marks.push(mark);
    hint.style.display = 'none';
    resolveAndShow(mark);
  }

  /* ---- Phase 3: candidate discovery (DOM objects under the mark) ---- */
  function elementText(element) {
    if (element.matches('img,svg,canvas,video,picture')) return (element.getAttribute('alt') || element.getAttribute('aria-label') || element.getAttribute('title') || '').trim();
    if (element.matches('input,textarea,select')) return (element.value || element.placeholder || '').trim();
    return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function collectCandidates(mark) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const seen = new Map();
    host.style.pointerEvents = 'none';
    try {
      for (const [x, y] of G.samplePoints(mark, 6)) {
        if (x < 0 || y < 0 || x > viewport.width || y > viewport.height) continue;
        for (const element of document.elementsFromPoint(x, y).slice(0, 6)) {
          if (element === host || element === document.documentElement || element === document.body || seen.has(element)) continue;
          const rect = element.getBoundingClientRect();
          const bbox = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
          if (!G.anchorFilter(bbox, mark, viewport)) continue;
          const text = elementText(element).slice(0, 600);
          if (!text && !element.matches('img,svg,canvas,video')) continue;
          seen.set(element, {
            id: 'el-' + seen.size,
            source: 'dom',
            type: element.tagName.toLowerCase(),
            label: G.nearestHeading(element) || elementText(element).slice(0, 40),
            text,
            bbox,
            href: element.closest('a[href]')?.href || '',
            src: element.currentSrc || element.src || '',
            __element: element,
          });
        }
      }
    } finally { host.style.pointerEvents = ''; }
    return [...seen.values()];
  }

  /* ---- Phase 4 (client mirror) + Phase 5/6: resolve, chip, ambiguity ---- */
  function resolveAndShow(mark) {
    const candidates = collectCandidates(mark);
    const { target } = G.resolveBest(mark, candidates);
    showPanel(mark, candidates, target);
  }

  function highlightElement(candidate) {
    if (!candidate || !candidate.__element) return;
    const old = document.querySelector('.studyos-spatial-glow');
    if (old) old.remove();
    const elNode = candidate.__element;
    const rect = elNode.getBoundingClientRect();
    const glow = document.createElement('div');
    glow.className = 'studyos-spatial-glow';
    glow.style.cssText = `position:fixed;left:${rect.left - 4}px;top:${rect.top - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px;` +
      'border:3px solid #16a34a;border-radius:6px;z-index:2147483646;pointer-events:none;animation:studyosPulse 1.2s ease-out infinite;';
    const style = document.createElement('style');
    style.textContent = '@keyframes studyosPulse{0%{opacity:.9}100%{opacity:.15}}';
    document.documentElement.appendChild(style);
    document.documentElement.appendChild(glow);
    setTimeout(() => glow.remove(), 4000);
  }

  function chipLabel(candidate) {
    return candidate ? (candidate.label || candidate.type || 'object') : 'unknown object';
  }

  function showPanel(mark, candidates, target) {
    let chosen = target.candidateId
      ? candidates.find((c) => c.id === target.candidateId) || candidates[0]
      : null;
    let resolvedConfidence = target.confidence || 'low';
    if (!panel) {
      panel = el('div', { class: 'panel' });
      const chip = el('div', { class: 'chip', onclick: () => highlightElement(chosen) });
      const ambiguousBox = el('div', { class: 'ambiguous', style: 'display:none' });
      const thread = el('div', { class: 'thread' });
      const input = el('textarea', { placeholder: 'Ask about what you boxed… (Enter to send)', rows: 1 });
      const sendButton = el('button', { class: 'send', onclick: () => submit(input, thread, sendButton) }, ['Ask']);
      const privacy = el('div', { class: 'privacy' }, [
        el('span', { class: 'y' }, ['✓ Resolved DOM object']),
        el('span', { class: 'y' }, ['✓ Nearby text']),
        el('span', { class: 'n' }, ['✕ Full page']),
        el('span', { class: 'n' }, ['✕ Full screenshot']),
      ]);
      const researchInput = el('input', { type: 'checkbox', onchange: (event) => { state.research = event.target.checked; } });
      privacy.append(
        el('label', { class: 'research-control' }, [researchInput, ' Search the public web with sources']),
        el('span', { class: 'research-disclosure' }, ['Selected text and your question may be sent to web-research providers.']),
      );
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input, thread, sendButton); } e.stopPropagation(); });
      input.addEventListener('keyup', e => e.stopPropagation());
      panel.append(
        el('header', {}, [el('b', {}, ['STUDYOS · POINT & ASK']), el('button', { class: 'close', title: 'Close', onclick: close }, ['✕'])]),
        chip, ambiguousBox, thread,
        el('div', { class: 'ask' }, [input, sendButton]),
        privacy,
      );
      panel.addEventListener('pointerdown', e => e.stopPropagation());
      root.append(panel);
      setTimeout(() => input.focus(), 0);
    }
    const chip = panel.querySelector('.chip');
    const ambiguousBox = panel.querySelector('.ambiguous');

    const renderChip = () => {
      chip.innerHTML = '';
      if (chosen) {
        const conf = el('span', { class: 'conf ' + resolvedConfidence }, [resolvedConfidence]);
        chip.append('🎯 ', chipLabel(chosen), conf);
        chip.style.cursor = 'pointer';
      } else {
        chip.textContent = 'No object resolved — ask about this region';
        chip.style.cursor = 'default';
      }
    };
    renderChip();

    // Ambiguity chooser
    ambiguousBox.innerHTML = '';
    if (resolvedConfidence === 'low' && (target.alternatives || []).length) {
      ambiguousBox.style.display = '';
      ambiguousBox.append(el('div', {}, ['Did you mean:']));
      const ids = [chosen && chosen.id, ...(target.alternatives || [])].filter(Boolean);
      ids.forEach((id) => {
        const c = candidates.find((x) => x.id === id);
        if (!c) return;
        const labelEl = el('label', {}, [
          el('input', {
            type: 'radio', name: 'studyos-chosen', value: id,
            checked: selected(chosen && chosen.id === id),
            onchange: (e) => {
              if (e.target.checked) {
                chosen = c;
                resolvedConfidence = 'medium';
                renderChip();
                highlightElement(c);
                for (const l of ambiguousBox.querySelectorAll('label')) l.classList.toggle('chosen', l === labelEl);
              }
            },
          }),
          ' ' + chipLabel(c),
        ]);
        if (chosen && c.id === chosen.id) labelEl.classList.add('chosen');
        ambiguousBox.append(labelEl);
      });
    } else {
      ambiguousBox.style.display = 'none';
    }
    // position panel
    const margin = 12, width = Math.min(360, window.innerWidth - 24);
    let left = mark.x + mark.width + margin;
    if (left + width > window.innerWidth - margin) left = Math.max(margin, mark.x - width - margin);
    panel.style.left = left + 'px';
    panel.style.top = Math.max(margin, Math.min(mark.y, window.innerHeight - 260)) + 'px';
    // Keep handles for submit
    panel.__chip = chip;
    panel.__ambiguous = ambiguousBox;
    panel.__candidates = candidates;
    panel.__getChosen = () => ({ chosen, confidence: resolvedConfidence });
    highlightElement(chosen);
    setTimeout(() => input.focus(), 0);
  }

  function selected(bool) { return bool ? 'checked' : '' }

  async function submit(input, thread, sendButton, chipEl, ambiguousEl) {
    const question = input.value.trim();
    if (!question || state.busy || !state.marks.length) return;
    state.busy = true; sendButton.disabled = true;
    thread.append(el('div', { class: 'q' }, [question]));
    input.value = '';
    const idempotencyKey = crypto.randomUUID();
    const answerNode = el('div', { class: 'a' }, ['Looking at what you boxed…']);
    thread.append(answerNode); thread.scrollTop = thread.scrollHeight;
    try {
      const marks = state.marks.map((m) => ({ ...m }));
      const candidates = (panel && panel.__candidates) || collectCandidates(marks[0]);
      const picked = (panel && panel.__getChosen) ? panel.__getChosen() : { chosen: candidates[0] || null, confidence: 'medium' };
      const chosen = picked.chosen;
      // Send the raw candidates + the resolved target; the server re-resolves authoritatively.
      const viewer = window.__studyosPdfViewer || null;
      const result = await send({
        type: 'spatial:ask',
        payload: {
          question,
          marks,
          anchors: candidates.map(({ __element, ...c }) => c),
          canvas: { width: window.innerWidth, height: window.innerHeight },
          page: {
            url: viewer ? viewer.fileUrl : location.href,
            title: (viewer ? viewer.title : document.title || location.hostname).slice(0, 500),
            surface: viewer ? 'pdf' : 'web',
          },
          resolved_target: chosen ? { candidateId: chosen.id, confidence: picked.confidence || 'medium' } : undefined,
          research: state.research === true,
          idempotency_key: idempotencyKey,
        },
      });
      if (!result.ok) throw result;
      answerNode.textContent = '';
      answerNode.append(document.createTextNode(result.answer));
      const rt = result.resolved_target;
      const confNote = rt ? rt.confidence + ' confidence' : '';
      answerNode.append(el('small', {}, [
        result.provider && result.provider !== 'none' ? result.provider + '/' + result.model : 'no model',
        confNote ? ' · ' + confNote : '',
        (result.anchors_used && result.anchors_used.length) ? ' · ' + result.anchors_used.length + ' anchor(s)' : '',
      ].join('')));
      appendResearchSources(answerNode, result);
      const actions = el('div', { class: 'actions' });
      answerNode.append(actions);
      const helpful = el('button', { onclick: async () => { await send({ type: 'spatial:feedback', askId: result.id, helpful: true }); helpful.classList.add('on'); helpful.textContent = '✓ Helpful'; } }, ['👍 Helpful']);
      const save = el('button', { onclick: async () => { const r = await send({ type: 'spatial:save-review', askId: result.id }); save.textContent = r.ok ? '✓ Saved to Review' : '✗ ' + (r.error || 'failed'); } }, ['📚 Save to Review']);
      actions.append(helpful, save);
    } catch (error) {
      answerNode.textContent = error.code === 'INSUFFICIENT_EVIDENCE'
        ? 'I could not find enough reliable sourced evidence to answer this.'
        : error.code === 'RATE_LIMITED'
          ? (error.error || 'Your daily Research Mode limit has been reached.')
          : (error.error || 'Something went wrong sending your question.');
      answerNode.append(el('small', {}, [error.code || 'ERROR']));
    } finally {
      state.busy = false; sendButton.disabled = false; thread.scrollTop = thread.scrollHeight; input.focus();
    }
  }

  function appendResearchSources(answerNode, result) {
    if (!Array.isArray(result.sources) || result.sources.length === 0) return;
    const sources = result.sources.filter((source) => {
      try { return new URL(source && source.url).protocol === 'https:'; } catch { return false; }
    });
    if (!sources.length) return;
    const box = el('div', { class: 'sources' }, [result.provider === 'groq-compound' ? 'Groq Compound sources' : 'Bedrock Web Search sources']);
    sources.forEach((source, index) => {
      box.append(el('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer', title: source.title || source.url }, [`${index + 1}. ${source.title || source.url}`]));
    });
    answerNode.append(box);
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
