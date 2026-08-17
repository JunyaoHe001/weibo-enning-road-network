(() => {
  'use strict';

  const els = {
    body: document.body,
    sidebar: document.getElementById('sidebar'),
    scrim: document.getElementById('sidebar-scrim'),
    mobileToggle: document.getElementById('mobile-toggle'),
    errorBox: document.getElementById('error-box'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loading-text'),
    canvas: document.getElementById('network-canvas'),
    activityCanvas: document.getElementById('activity-canvas'),
    tooltip: document.getElementById('tooltip'),
    summary: document.getElementById('network-summary'),
    legend: document.getElementById('graph-legend'),
    recordScope: document.getElementById('record-scope'),
    viewMode: document.getElementById('view-mode'),
    playSpeed: document.getElementById('play-speed'),
    timeSlider: document.getElementById('time-slider'),
    timeIndex: document.getElementById('time-index'),
    timeLabel: document.getElementById('time-label'),
    timeStatus: document.getElementById('time-status'),
    intervalEdges: document.getElementById('interval-edges'),
    startButton: document.getElementById('start-button'),
    playButton: document.getElementById('play-button'),
    nextButton: document.getElementById('next-button'),
    endButton: document.getElementById('end-button'),
    actorFocus: document.getElementById('actor-focus'),
    componentScope: document.getElementById('component-scope'),
    nodeShare: document.getElementById('node-share'),
    nodeShareValue: document.getElementById('node-share-value'),
    filterSummary: document.getElementById('filter-summary'),
    nodeSize: document.getElementById('node-size'),
    nodeColour: document.getElementById('node-colour'),
    showLabels: document.getElementById('show-labels'),
    showArrows: document.getElementById('show-arrows'),
    displayStatus: document.getElementById('display-status'),
    fitButton: document.getElementById('fit-button'),
    clearButton: document.getElementById('clear-button'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    zoomFit: document.getElementById('zoom-fit'),
    statNodes: document.getElementById('stat-nodes'),
    statEdges: document.getElementById('stat-edges'),
    statInteractions: document.getElementById('stat-interactions'),
    statCommunities: document.getElementById('stat-communities'),
    selectedLabel: document.getElementById('selected-label'),
    backupNote: document.getElementById('backup-note')
  };

  const ctx = els.canvas.getContext('2d', { alpha: true });
  const activityCtx = els.activityCanvas.getContext('2d', { alpha: true });
  const fmt = new Intl.NumberFormat('en-GB');

  const communityPalette = [
    '#1a9db0', '#e98268', '#d7ad2f', '#4f9c65', '#b767a6',
    '#517ec1', '#c77d35', '#6e9d98', '#9376bd', '#e05d82',
    '#79a843', '#4aa0d0', '#b78c4d', '#8b91a9', '#45ad92',
    '#d06d4e', '#6e88cf', '#bc6a89', '#8ca13f', '#738a93'
  ];

  const state = {
    meta: null,
    timeline: [],
    nodes: [],
    edges: [],
    nodeByRole: new Map(),
    currentBin: 0,
    maxBin: 0,
    playing: false,
    timer: null,
    recordScope: 'core',
    viewMode: 'cumulative',
    actorFocus: 'all',
    componentScope: 'all',
    nodeShare: 100,
    sizeMetric: 'degree',
    colourMode: 'community',
    showLabels: true,
    showArrows: false,
    visibleNodes: [],
    visibleEdges: [],
    visibleNodeSet: new Set(),
    selected: null,
    hovered: null,
    selectedNeighbours: new Set(),
    width: 0,
    height: 0,
    dpr: 1,
    activityWidth: 0,
    activityHeight: 0,
    activityDpr: 1,
    scale: 420,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragMoved: false,
    dragStartX: 0,
    dragStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    pointerDownNode: null,
    screenNodes: [],
    needsFit: true
  };

  function showError(error) {
    const message = error instanceof Error ? error.message : String(error);
    els.errorBox.style.display = 'block';
    els.errorBox.textContent = `The atlas could not be loaded.\n${message}`;
    els.loading.style.display = 'none';
    console.error(error);
  }

  function setLoading(text) {
    els.loadingText.textContent = text;
  }

  async function loadJSON(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  async function initialise() {
    try {
      setLoading('Loading public metadata…');
      const [metaPayload, nodes, edges] = await Promise.all([
        loadJSON('./data/meta.json'),
        loadJSON('./data/nodes.json'),
        loadJSON('./data/edges.json')
      ]);

      state.meta = metaPayload.meta;
      state.timeline = metaPayload.timeline;
      state.nodes = nodes.map((node, index) => ({ ...node, index }));
      state.edges = edges.map((edge, index) => ({ ...edge, index }));

      if (!state.timeline.length || !state.nodes.length || !state.edges.length) {
        throw new Error('The public network files are empty.');
      }

      for (const node of state.nodes) {
        if (node.role && node.role !== 'anonymous') state.nodeByRole.set(node.role, node.index);
      }

      const coreLast = Number(state.meta.available_backup.core_last_bin);
      state.maxBin = Number.isFinite(coreLast) ? coreLast : state.timeline.length - 1;
      state.currentBin = state.maxBin;
      els.timeSlider.max = String(state.maxBin);
      els.timeSlider.value = String(state.currentBin);

      state.recordScope = els.recordScope.value;
      state.viewMode = els.viewMode.value;
      state.actorFocus = els.actorFocus.value;
      state.componentScope = els.componentScope.value;
      state.nodeShare = Number(els.nodeShare.value);
      state.sizeMetric = els.nodeSize.value;
      state.colourMode = els.nodeColour.value;
      state.showLabels = els.showLabels.checked;
      state.showArrows = els.showArrows.checked;

      const backup = state.meta.available_backup;
      const reported = state.meta.paper_reported_collection;
      els.backupNote.textContent = `Analysis backup: ${fmt.format(backup.directed_edge_records)} directed records and ${fmt.format(backup.nodes)} anonymised nodes. The article reports the initial collection (${fmt.format(reported.retweets)} retweets; ${fmt.format(reported.users)} users).`;

      bindEvents();
      resizeAll();
      recomputeVisible({ fit: true });
      updateControls();
      els.loading.style.display = 'none';
    } catch (error) {
      showError(error);
    }
  }

  function scopeMaxBin() {
    return state.recordScope === 'core'
      ? Number(state.meta.available_backup.core_last_bin)
      : state.timeline.length - 1;
  }

  function updateScope({ fit = true } = {}) {
    stopPlayback();
    state.maxBin = scopeMaxBin();
    if (state.currentBin > state.maxBin || state.recordScope === 'core') {
      state.currentBin = state.maxBin;
    }
    els.timeSlider.max = String(state.maxBin);
    els.timeSlider.value = String(state.currentBin);
    recomputeVisible({ fit });
    updateControls();
  }

  function temporalEdges() {
    const current = state.currentBin;
    const cumulative = state.viewMode === 'cumulative';
    const coreOnly = state.recordScope === 'core';
    return state.edges.filter((edge) => {
      if (coreOnly && !edge.core) return false;
      return cumulative ? edge.bin <= current : edge.bin === current;
    });
  }

  function buildTemporalNodeSet(edges) {
    const set = new Set();
    for (const edge of edges) {
      set.add(edge.source);
      set.add(edge.target);
    }
    return set;
  }

  function focusCandidateSet(temporalSet, edges) {
    if (state.actorFocus === 'all') return temporalSet;
    const keyIndex = state.nodeByRole.get(state.actorFocus);
    if (keyIndex == null || !temporalSet.has(keyIndex)) return new Set();
    const result = new Set([keyIndex]);
    for (const edge of edges) {
      if (edge.source === keyIndex) result.add(edge.target);
      if (edge.target === keyIndex) result.add(edge.source);
    }
    return result;
  }

  function recomputeVisible({ fit = false } = {}) {
    const temporal = temporalEdges();
    const temporalSet = buildTemporalNodeSet(temporal);
    let candidateSet = focusCandidateSet(temporalSet, temporal);

    if (state.componentScope === 'largest') {
      candidateSet = new Set([...candidateSet].filter((index) => state.nodes[index].component === 0));
    }

    const candidates = [...candidateSet].map((index) => state.nodes[index]);
    const retainCount = Math.max(1, Math.ceil(candidates.length * state.nodeShare / 100));
    candidates.sort((a, b) => {
      if (a.role !== 'anonymous' && b.role === 'anonymous') return -1;
      if (b.role !== 'anonymous' && a.role === 'anonymous') return 1;
      return b.degree - a.degree || b.weighted_degree - a.weighted_degree || a.id.localeCompare(b.id);
    });

    let retained = candidates.slice(0, retainCount);
    for (const node of candidates) {
      if (node.role !== 'anonymous' && !retained.includes(node)) retained.push(node);
    }

    state.visibleNodes = retained;
    state.visibleNodeSet = new Set(retained.map((node) => node.index));
    state.visibleEdges = temporal.filter((edge) => state.visibleNodeSet.has(edge.source) && state.visibleNodeSet.has(edge.target));

    if (state.selected != null && !state.visibleNodeSet.has(state.selected)) clearSelection(false);
    rebuildSelectedNeighbours();
    updateStats();
    updateTimelineUI();
    updateLegend();
    if (fit) fitView();
    draw();
    drawActivity();
  }

  function updateStats() {
    const communities = new Set(state.visibleNodes.map((node) => node.community));
    const interactions = state.visibleEdges.reduce((sum, edge) => sum + Number(edge.weight || 1), 0);
    els.statNodes.textContent = fmt.format(state.visibleNodes.length);
    els.statEdges.textContent = fmt.format(state.visibleEdges.length);
    els.statInteractions.textContent = fmt.format(interactions);
    els.statCommunities.textContent = fmt.format(communities.size);

    const focusLabels = {
      all: 'All actors',
      media: 'Media-1 ego',
      cso: 'CSO-1 ego'
    };
    const componentText = state.componentScope === 'largest' ? ' · largest component' : '';
    els.filterSummary.textContent = `${focusLabels[state.actorFocus]}${componentText}`;

    const viewText = state.viewMode === 'cumulative' ? 'Cumulative to' : 'Interval at';
    const scopeText = state.recordScope === 'core' ? 'Core movement' : 'Extended records';
    const timelineItem = state.timeline[state.currentBin];
    els.summary.textContent = `${scopeText} · ${viewText} ${timelineItem.label} · ${fmt.format(state.visibleNodes.length)} nodes · ${fmt.format(state.visibleEdges.length)} directed edges`;
  }

  function updateTimelineUI() {
    const item = state.timeline[state.currentBin];
    if (!item) return;
    els.timeSlider.value = String(state.currentBin);
    els.timeIndex.textContent = `${state.currentBin + 1}/${state.maxBin + 1}`;
    els.timeLabel.textContent = `${item.label} · China Standard Time`;
    els.intervalEdges.textContent = `${fmt.format(item.edge_count)} new edges`;
    els.timeStatus.textContent = state.recordScope === 'core' ? 'Core movement' : 'Extended records';
    els.startButton.disabled = state.currentBin <= 0;
    els.nextButton.disabled = state.currentBin >= state.maxBin;
    els.endButton.disabled = state.currentBin >= state.maxBin;
  }

  function updateControls() {
    els.nodeShareValue.textContent = `${state.nodeShare}%`;
    const displayNames = {
      community: 'Communities',
      time: 'First appearance',
      role: 'Actor roles'
    };
    els.displayStatus.textContent = displayNames[state.colourMode];
    els.playButton.textContent = state.playing ? 'Pause' : 'Play';
    els.playButton.classList.toggle('primary', !state.playing);
    if (state.playing) els.playButton.classList.add('primary');
    updateTimelineUI();
  }

  function setCurrentBin(bin, { fit = false } = {}) {
    const next = Math.max(0, Math.min(state.maxBin, Math.round(bin)));
    state.currentBin = next;
    recomputeVisible({ fit });
    updateControls();
  }

  function startPlayback() {
    if (state.currentBin >= state.maxBin) setCurrentBin(0, { fit: true });
    state.playing = true;
    updateControls();
    restartPlaybackTimer();
  }

  function restartPlaybackTimer() {
    if (state.timer) clearInterval(state.timer);
    if (!state.playing) return;
    const speed = Math.max(1, Number(els.playSpeed.value) || 6);
    state.timer = window.setInterval(() => {
      if (state.currentBin >= state.maxBin) {
        stopPlayback();
        return;
      }
      setCurrentBin(state.currentBin + 1);
    }, 1000 / speed);
  }

  function stopPlayback() {
    state.playing = false;
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    updateControls();
  }

  function togglePlayback() {
    state.playing ? stopPlayback() : startPlayback();
  }

  function rebuildSelectedNeighbours() {
    state.selectedNeighbours = new Set();
    if (state.selected == null) return;
    state.selectedNeighbours.add(state.selected);
    for (const edge of state.visibleEdges) {
      if (edge.source === state.selected) state.selectedNeighbours.add(edge.target);
      if (edge.target === state.selected) state.selectedNeighbours.add(edge.source);
    }
  }

  function clearSelection(redraw = true) {
    state.selected = null;
    state.selectedNeighbours.clear();
    els.selectedLabel.textContent = '—';
    if (redraw) draw();
  }

  function selectNode(index) {
    if (index == null) {
      clearSelection();
      return;
    }
    state.selected = state.selected === index ? null : index;
    rebuildSelectedNeighbours();
    if (state.selected == null) {
      els.selectedLabel.textContent = '—';
    } else {
      const node = state.nodes[state.selected];
      els.selectedLabel.textContent = node.role === 'anonymous' ? node.id : node.role_label;
    }
    draw();
  }

  function radiusFor(node) {
    if (state.sizeMetric === 'uniform') return node.role === 'anonymous' ? 2.4 : 4.8;
    const field = {
      degree: 'size_degree',
      weighted: 'size_weighted',
      hub: 'size_hub',
      authority: 'size_authority',
      betweenness: 'size_betweenness',
      pagerank: 'size_pagerank'
    }[state.sizeMetric] || 'size_degree';
    const value = Math.max(0, Math.min(1, Number(node[field]) || 0));
    let radius = 1.65 + 9.4 * Math.pow(value, 0.54);
    if (node.role !== 'anonymous') radius += 1.6;
    if (state.selected === node.index) radius += 1.2;
    return radius;
  }

  function colourFor(node) {
    if (state.colourMode === 'role') {
      if (node.role === 'media') return '#dd765c';
      if (node.role === 'cso') return '#119a99';
      return '#63839b';
    }
    if (state.colourMode === 'time') {
      const denom = Math.max(1, state.maxBin);
      const t = Math.max(0, Math.min(1, node.first_bin / denom));
      const hue = 205 - 165 * t;
      return `hsl(${hue.toFixed(1)} 58% 52%)`;
    }
    if (node.community_display == null || node.community_display < 0) return '#98a2b3';
    return communityPalette[node.community_display % communityPalette.length];
  }

  function colourWithAlpha(colour, alpha) {
    if (colour.startsWith('#')) {
      const hex = colour.slice(1);
      const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return colour;
  }

  function screenPoint(node) {
    return {
      x: node.x * state.scale + state.offsetX,
      y: node.y * state.scale + state.offsetY
    };
  }

  function resizeCanvas() {
    const rect = els.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    state.width = Math.max(1, rect.width);
    state.height = Math.max(1, rect.height);
    state.dpr = dpr;
    els.canvas.width = Math.round(state.width * dpr);
    els.canvas.height = Math.round(state.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resizeActivityCanvas() {
    const rect = els.activityCanvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    state.activityWidth = Math.max(1, rect.width);
    state.activityHeight = Math.max(1, rect.height);
    state.activityDpr = dpr;
    els.activityCanvas.width = Math.round(state.activityWidth * dpr);
    els.activityCanvas.height = Math.round(state.activityHeight * dpr);
    activityCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resizeAll() {
    const oldWidth = state.width;
    const oldHeight = state.height;
    resizeCanvas();
    resizeActivityCanvas();
    if (oldWidth && oldHeight) {
      state.offsetX += (state.width - oldWidth) / 2;
      state.offsetY += (state.height - oldHeight) / 2;
    }
    if (state.needsFit) fitView();
    draw();
    drawActivity();
  }

  function fitView() {
    const nodes = state.visibleNodes;
    if (!nodes.length || !state.width || !state.height) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }
    const dx = Math.max(0.12, maxX - minX);
    const dy = Math.max(0.12, maxY - minY);
    const usableW = Math.max(180, state.width - 130);
    const usableH = Math.max(180, state.height - 150);
    state.scale = Math.max(65, Math.min(940, Math.min(usableW / dx, usableH / dy) * 0.88));
    state.offsetX = state.width / 2 - ((minX + maxX) / 2) * state.scale;
    state.offsetY = state.height / 2 - ((minY + maxY) / 2) * state.scale + 8;
    state.needsFit = false;
    draw();
  }

  function zoomAt(factor, x = state.width / 2, y = state.height / 2) {
    const oldScale = state.scale;
    const nextScale = Math.max(35, Math.min(2600, oldScale * factor));
    const worldX = (x - state.offsetX) / oldScale;
    const worldY = (y - state.offsetY) / oldScale;
    state.scale = nextScale;
    state.offsetX = x - worldX * nextScale;
    state.offsetY = y - worldY * nextScale;
    draw();
  }

  function edgeCurve(edge, sourcePoint, targetPoint) {
    const dx = targetPoint.x - sourcePoint.x;
    const dy = targetPoint.y - sourcePoint.y;
    const length = Math.hypot(dx, dy) || 1;
    const sign = ((edge.source * 31 + edge.target * 17) & 1) === 0 ? 1 : -1;
    const bend = sign * Math.min(20, Math.max(2.5, length * 0.075));
    return {
      x: (sourcePoint.x + targetPoint.x) / 2 - (dy / length) * bend,
      y: (sourcePoint.y + targetPoint.y) / 2 + (dx / length) * bend
    };
  }

  function quadraticPoint(p0, p1, p2, t) {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    };
  }

  function quadraticTangent(p0, p1, p2, t) {
    return {
      x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
      y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
    };
  }

  function drawArrow(edge, sourcePoint, controlPoint, targetPoint, colour, alpha) {
    const source = state.nodes[edge.source];
    const target = state.nodes[edge.target];
    const length = Math.hypot(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y);
    if (length < radiusFor(source) + radiusFor(target) + 13) return;
    const t = 0.82;
    const point = quadraticPoint(sourcePoint, controlPoint, targetPoint, t);
    const tangent = quadraticTangent(sourcePoint, controlPoint, targetPoint, t);
    const angle = Math.atan2(tangent.y, tangent.x);
    const size = 4.2;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    ctx.fillStyle = colourWithAlpha(colour, Math.min(0.88, alpha + 0.28));
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size, -size * 0.72);
    ctx.lineTo(-size, size * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    if (!state.width || !state.height) return;
    ctx.clearRect(0, 0, state.width, state.height);
    state.screenNodes = [];

    const selectionActive = state.selected != null;

    for (const edge of state.visibleEdges) {
      const source = state.nodes[edge.source];
      const target = state.nodes[edge.target];
      const p0 = screenPoint(source);
      const p2 = screenPoint(target);
      if ((p0.x < -50 && p2.x < -50) || (p0.x > state.width + 50 && p2.x > state.width + 50) ||
          (p0.y < -50 && p2.y < -50) || (p0.y > state.height + 50 && p2.y > state.height + 50)) continue;
      const p1 = edgeCurve(edge, p0, p2);
      const touchesSelection = selectionActive && (edge.source === state.selected || edge.target === state.selected);
      const bothNearSelection = selectionActive && state.selectedNeighbours.has(edge.source) && state.selectedNeighbours.has(edge.target);
      const alpha = selectionActive ? (touchesSelection ? 0.78 : (bothNearSelection ? 0.28 : 0.025)) : 0.20;
      const colour = state.colourMode === 'community' ? colourFor(source) : '#728797';
      ctx.strokeStyle = colourWithAlpha(colour, alpha);
      ctx.lineWidth = 0.62 + Math.log2(1 + Number(edge.weight || 1)) * 0.36 + (touchesSelection ? 0.65 : 0);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      ctx.stroke();
      if (state.showArrows) drawArrow(edge, p0, p1, p2, colour, alpha);
    }

    const visibleSorted = [...state.visibleNodes].sort((a, b) => radiusFor(a) - radiusFor(b));
    for (const node of visibleSorted) {
      const point = screenPoint(node);
      const radius = radiusFor(node);
      const inSelection = !selectionActive || state.selectedNeighbours.has(node.index);
      const alpha = inSelection ? 0.94 : 0.12;
      if (point.x < -radius - 10 || point.x > state.width + radius + 10 || point.y < -radius - 10 || point.y > state.height + radius + 10) continue;

      if (node.role !== 'anonymous' || state.selected === node.index || state.hovered === node.index) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + (node.role !== 'anonymous' ? 3.2 : 2.3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${inSelection ? 0.93 : 0.16})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colourWithAlpha(colourFor(node), alpha);
      ctx.fill();
      ctx.strokeStyle = state.selected === node.index
        ? 'rgba(23,33,43,0.95)'
        : (node.role !== 'anonymous' ? 'rgba(23,33,43,0.70)' : `rgba(46,64,79,${inSelection ? 0.46 : 0.08})`);
      ctx.lineWidth = state.selected === node.index ? 1.65 : (node.role !== 'anonymous' ? 1.15 : 0.48);
      ctx.stroke();
      state.screenNodes.push({ index: node.index, x: point.x, y: point.y, radius: Math.max(radius, 3.0) });
    }

    if (state.showLabels) drawLabels(visibleSorted, selectionActive);
  }

  function metricValue(node) {
    return {
      degree: node.degree,
      weighted: node.weighted_degree,
      hub: node.hub,
      authority: node.authority,
      betweenness: node.betweenness,
      pagerank: node.pagerank,
      uniform: node.degree
    }[state.sizeMetric] || node.degree;
  }

  function drawLabels(nodes, selectionActive) {
    const keyNodes = nodes.filter((node) => node.role !== 'anonymous');
    const topNodes = nodes
      .filter((node) => node.role === 'anonymous')
      .sort((a, b) => metricValue(b) - metricValue(a))
      .slice(0, state.visibleNodes.length > 500 ? 6 : 8);
    const labels = [...keyNodes, ...topNodes];
    ctx.save();
    ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const node of labels) {
      if (selectionActive && !state.selectedNeighbours.has(node.index) && node.role === 'anonymous') continue;
      const point = screenPoint(node);
      const radius = radiusFor(node);
      const text = node.role === 'anonymous' ? node.id : node.role_label;
      const x = point.x + radius + 4;
      const y = point.y;
      ctx.lineWidth = 3.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = node.role === 'anonymous' ? 'rgba(52,64,84,0.80)' : '#17212b';
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  function drawActivity() {
    if (!state.activityWidth || !state.activityHeight || !state.timeline.length) return;
    const width = state.activityWidth;
    const height = state.activityHeight;
    activityCtx.clearRect(0, 0, width, height);
    activityCtx.fillStyle = '#f8fafc';
    activityCtx.fillRect(0, 0, width, height);

    const count = state.maxBin + 1;
    const values = state.timeline.slice(0, count).map((item) => Math.log1p(item.edge_count));
    const maxValue = Math.max(1, ...values);
    const barWidth = width / count;

    activityCtx.fillStyle = 'rgba(31,95,139,0.08)';
    activityCtx.fillRect(0, 0, Math.min(width, (state.currentBin + 1) * barWidth), height);

    for (let i = 0; i < count; i += 1) {
      const h = Math.max(1.4, (values[i] / maxValue) * (height - 12));
      const x = i * barWidth;
      const isCurrent = i === state.currentBin;
      const isExtended = !state.timeline[i].core;
      activityCtx.fillStyle = isCurrent ? '#dd765c' : (isExtended ? '#9aa8b4' : '#4f86aa');
      activityCtx.fillRect(x + 0.15, height - h - 4, Math.max(0.7, barWidth - 0.3), h);
    }

    const markerX = (state.currentBin + 0.5) * barWidth;
    activityCtx.strokeStyle = 'rgba(23,33,43,0.78)';
    activityCtx.lineWidth = 1;
    activityCtx.beginPath();
    activityCtx.moveTo(markerX, 2);
    activityCtx.lineTo(markerX, height - 2);
    activityCtx.stroke();
  }

  function updateLegend() {
    if (state.colourMode === 'role') {
      els.legend.innerHTML = `
        <div class="legend-title">Published actor role</div>
        <div class="legend-items">
          <div class="legend-item"><span class="legend-dot" style="background:#dd765c"></span>Media-1</div>
          <div class="legend-item"><span class="legend-dot" style="background:#119a99"></span>CSO-1</div>
          <div class="legend-item"><span class="legend-dot" style="background:#63839b"></span>Anonymous actors</div>
        </div>`;
      return;
    }
    if (state.colourMode === 'time') {
      const first = state.timeline[0]?.short_label || 'Earlier';
      const last = state.timeline[state.maxBin]?.short_label || 'Later';
      els.legend.innerHTML = `
        <div class="legend-title">First appearance</div>
        <div class="legend-gradient" style="background:linear-gradient(90deg,hsl(205 58% 52%),hsl(40 58% 52%))"></div>
        <div class="legend-labels"><span>${first}</span><span>${last}</span></div>`;
      return;
    }
    const items = communityPalette.slice(0, 6).map((colour, index) =>
      `<div class="legend-item"><span class="legend-dot" style="background:${colour}"></span>C${index + 1}</div>`
    ).join('');
    els.legend.innerHTML = `
      <div class="legend-title">Structural communities</div>
      <div class="legend-items">${items}<div class="legend-item"><span class="legend-dot" style="background:#98a2b3"></span>Other</div></div>`;
  }

  function nodeAt(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (let i = state.screenNodes.length - 1; i >= 0; i -= 1) {
      const item = state.screenNodes[i];
      const distance = Math.hypot(x - item.x, y - item.y);
      if (distance <= item.radius + 4 && distance < bestDistance) {
        best = item.index;
        bestDistance = distance;
      }
    }
    return best;
  }

  function formatMetric(value) {
    const number = Number(value || 0);
    if (number === 0) return '0';
    if (Math.abs(number) < 0.001) return number.toExponential(2);
    return number.toFixed(3);
  }

  function showTooltip(index, clientX, clientY) {
    if (index == null) {
      els.tooltip.style.display = 'none';
      return;
    }
    const node = state.nodes[index];
    const firstSeen = state.timeline[node.first_bin]?.label || '—';
    const title = node.role === 'anonymous' ? node.id : node.role_label;
    const subtitle = node.role === 'anonymous' ? 'Anonymised actor' : 'Role retained from the published analysis';
    els.tooltip.innerHTML = `
      <div class="tooltip-title">${title}</div>
      <div class="tooltip-subtitle">${subtitle}</div>
      <div class="tooltip-grid">
        <span>Public ID</span><span>${node.id}</span>
        <span>Degree</span><span>${fmt.format(node.degree)}</span>
        <span>In / out</span><span>${fmt.format(node.in_degree)} / ${fmt.format(node.out_degree)}</span>
        <span>HITS hub</span><span>${formatMetric(node.hub)}</span>
        <span>HITS authority</span><span>${formatMetric(node.authority)}</span>
        <span>Betweenness</span><span>${formatMetric(node.betweenness)}</span>
        <span>First seen</span><span>${firstSeen}</span>
      </div>`;
    const wrapRect = els.canvas.getBoundingClientRect();
    const left = Math.min(state.width - 275, Math.max(8, clientX - wrapRect.left + 14));
    const top = Math.min(state.height - 245, Math.max(8, clientY - wrapRect.top + 14));
    els.tooltip.style.left = `${left}px`;
    els.tooltip.style.top = `${top}px`;
    els.tooltip.style.display = 'block';
  }

  function pointerPosition(event) {
    const rect = els.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function bindEvents() {
    els.recordScope.addEventListener('change', () => {
      state.recordScope = els.recordScope.value;
      updateScope({ fit: true });
    });
    els.viewMode.addEventListener('change', () => {
      stopPlayback();
      state.viewMode = els.viewMode.value;
      recomputeVisible({ fit: true });
    });
    els.playSpeed.addEventListener('change', restartPlaybackTimer);
    els.timeSlider.addEventListener('input', () => {
      const requestedBin = Number(els.timeSlider.value);
      stopPlayback();
      setCurrentBin(requestedBin);
    });
    els.startButton.addEventListener('click', () => { stopPlayback(); setCurrentBin(0, { fit: true }); });
    els.playButton.addEventListener('click', togglePlayback);
    els.nextButton.addEventListener('click', () => { stopPlayback(); setCurrentBin(state.currentBin + 1); });
    els.endButton.addEventListener('click', () => { stopPlayback(); setCurrentBin(state.maxBin, { fit: true }); });

    els.actorFocus.addEventListener('change', () => {
      state.actorFocus = els.actorFocus.value;
      clearSelection(false);
      recomputeVisible({ fit: true });
    });
    els.componentScope.addEventListener('change', () => {
      state.componentScope = els.componentScope.value;
      clearSelection(false);
      recomputeVisible({ fit: true });
    });
    els.nodeShare.addEventListener('input', () => {
      state.nodeShare = Number(els.nodeShare.value);
      els.nodeShareValue.textContent = `${state.nodeShare}%`;
      recomputeVisible();
    });
    els.nodeShare.addEventListener('change', fitView);

    els.nodeSize.addEventListener('change', () => {
      state.sizeMetric = els.nodeSize.value;
      draw();
    });
    els.nodeColour.addEventListener('change', () => {
      state.colourMode = els.nodeColour.value;
      updateControls();
      updateLegend();
      draw();
    });
    els.showLabels.addEventListener('change', () => { state.showLabels = els.showLabels.checked; draw(); });
    els.showArrows.addEventListener('change', () => { state.showArrows = els.showArrows.checked; draw(); });
    els.fitButton.addEventListener('click', fitView);
    els.zoomFit.addEventListener('click', fitView);
    els.clearButton.addEventListener('click', () => { clearSelection(); els.actorFocus.value = 'all'; state.actorFocus = 'all'; recomputeVisible(); });
    els.zoomIn.addEventListener('click', () => zoomAt(1.22));
    els.zoomOut.addEventListener('click', () => zoomAt(1 / 1.22));

    els.mobileToggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    els.scrim.addEventListener('click', () => document.body.classList.remove('sidebar-open'));

    els.activityCanvas.addEventListener('click', (event) => {
      const rect = els.activityCanvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const index = Math.floor((x / Math.max(1, rect.width)) * (state.maxBin + 1));
      stopPlayback();
      setCurrentBin(index);
    });

    els.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const point = pointerPosition(event);
      zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, point.x, point.y);
    }, { passive: false });

    els.canvas.addEventListener('pointerdown', (event) => {
      els.canvas.setPointerCapture(event.pointerId);
      const point = pointerPosition(event);
      state.dragging = true;
      state.dragMoved = false;
      state.dragStartX = point.x;
      state.dragStartY = point.y;
      state.startOffsetX = state.offsetX;
      state.startOffsetY = state.offsetY;
      state.pointerDownNode = nodeAt(point.x, point.y);
      els.canvas.classList.add('dragging');
    });

    els.canvas.addEventListener('pointermove', (event) => {
      const point = pointerPosition(event);
      if (state.dragging) {
        const dx = point.x - state.dragStartX;
        const dy = point.y - state.dragStartY;
        if (Math.hypot(dx, dy) > 3) state.dragMoved = true;
        if (state.dragMoved) {
          state.offsetX = state.startOffsetX + dx;
          state.offsetY = state.startOffsetY + dy;
          draw();
        }
        return;
      }
      const hit = nodeAt(point.x, point.y);
      if (hit !== state.hovered) {
        state.hovered = hit;
        els.canvas.classList.toggle('node-hover', hit != null);
        draw();
      }
      showTooltip(hit, event.clientX, event.clientY);
    });

    const finishPointer = (event) => {
      if (!state.dragging) return;
      const point = pointerPosition(event);
      state.dragging = false;
      els.canvas.classList.remove('dragging');
      try { els.canvas.releasePointerCapture(event.pointerId); } catch (_) { /* no-op */ }
      if (!state.dragMoved) {
        const hit = nodeAt(point.x, point.y);
        selectNode(hit);
      }
    };
    els.canvas.addEventListener('pointerup', finishPointer);
    els.canvas.addEventListener('pointercancel', finishPointer);
    els.canvas.addEventListener('pointerleave', (event) => {
      if (!state.dragging) {
        state.hovered = null;
        els.tooltip.style.display = 'none';
        els.canvas.classList.remove('node-hover');
        draw();
      }
    });

    window.addEventListener('resize', resizeAll);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        clearSelection();
        document.body.classList.remove('sidebar-open');
      }
      if (event.code === 'Space' && !['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        togglePlayback();
      }
    });
  }

  initialise();
})();
