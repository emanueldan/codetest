const state = {
  filter: 'all',
  query: '',
  boosted: false,
  basePerformance: [],
  performance: [],
  filterInitialized: false,
};

const SECTION_SELECTORS = [
  '[data-section="hero"]',
  '[data-section="garage"]',
  '[data-section="metrics"]',
  '[data-section="roster"]',
];
const REFRESH_INTERVAL = 60 * 1000;
const idleEvents = ['click'];
const IDLE_RELOAD_DELAY = 5 * 60 * 1000;

let idleTimer = null;
let refreshTimer = null;
let isRefreshingSections = false;

const elements = {
  table: null,
  rosterBody: null,
  searchInput: null,
  filterButtons: null,
  boostButton: null,
  chartCanvas: null,
  heroForm: null,
  loadingOverlay: null,
  rosterRows: null,
};

function cacheDom() {
  elements.table = document.getElementById('rosterTable');
  elements.rosterBody = elements.table ? elements.table.querySelector('tbody') : null;
  elements.searchInput = document.getElementById('rosterSearch');
  elements.filterButtons = document.querySelectorAll('[data-filter]');
  elements.boostButton = document.getElementById('sparkline-boost');
  elements.chartCanvas = document.getElementById('performanceChart');
  elements.heroForm = document.querySelector('.hero-form');
  elements.loadingOverlay = document.getElementById('loadingOverlay');
  elements.rosterRows = document.querySelectorAll('.roster-row');
}

function ensurePlayerField() {
  if (!elements.heroForm) return null;
  let field = document.getElementById('player');
  if (!field) {
    field = document.createElement('input');
    field.type = 'hidden';
    field.name = 'player';
    field.id = 'player_fallback';
    elements.heroForm.appendChild(field);
  }
  return field;
}

const loading = {
  show() {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.add('is-active');
    }
  },
};

function applyFilters() {
  if (!elements.table) return;
  const rows = elements.table.querySelectorAll('tbody tr');
  const q = state.query.toLowerCase();

  rows.forEach((row) => {
    const matchType = state.filter === 'all' || row.dataset.role === state.filter;
    const matchText = row.innerText.toLowerCase().includes(q);
    row.style.display = matchType && matchText ? '' : 'none';
  });
}

function syncFilterUI() {
  if (!elements.filterButtons || !elements.filterButtons.length) {
    return;
  }
  const buttons = Array.from(elements.filterButtons);
  if (!state.filterInitialized) {
    const active = buttons.find((button) => button.classList.contains('active'));
    if (active) {
      state.filter = active.dataset.filter || 'all';
    }
    state.filterInitialized = true;
  }

  const hasMatch = buttons.some((button) => button.dataset.filter === state.filter);
  if (!hasMatch) {
    state.filter = 'all';
  }

  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === state.filter);
  });

  if (elements.searchInput) {
    elements.searchInput.value = state.query;
  }
}

function bindFilterButtons() {
  if (!elements.filterButtons) return;
  elements.filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter || 'all';
      syncFilterUI();
      applyFilters();
    });
  });
}

function bindSearchInput() {
  if (!elements.searchInput) return;
  elements.searchInput.value = state.query;
  elements.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    applyFilters();
  });
}

function getPerformanceDataFromCanvas(canvas) {
  if (!canvas) return null;
  const { performance } = canvas.dataset;
  if (!performance) return null;
  try {
    const parsed = JSON.parse(performance);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error('Unable to parse performance data', error);
    return null;
  }
}

function boostData(data, boosted) {
  return data.map((value, index) => {
    const multiplier = boosted && index % 2 === 0 ? 1.05 : 1;
    return Math.round(value * multiplier);
  });
}

function updatePerformanceState() {
  const base = getPerformanceDataFromCanvas(elements.chartCanvas);
  if (!base || !base.length) {
    state.basePerformance = [];
    state.performance = [];
    return;
  }
  state.basePerformance = base;
  state.performance = boostData(base, state.boosted);
}

function renderChart() {
  if (!elements.chartCanvas || !state.performance.length) return;
  const ctx = elements.chartCanvas.getContext('2d');
  const data = [...state.performance];
  const padding = 24;
  const width = elements.chartCanvas.width - padding * 2;
  const height = elements.chartCanvas.height - padding * 2;
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);

  ctx.clearRect(0, 0, elements.chartCanvas.width, elements.chartCanvas.height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i <= 4; i++) {
    const y = padding + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + width, y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.lineWidth = 3;
  const gradient = ctx.createLinearGradient(padding, padding, padding + width, padding);
  gradient.addColorStop(0, '#34d399');
  gradient.addColorStop(1, '#7c3aed');
  ctx.strokeStyle = gradient;
  ctx.fillStyle = 'rgba(124, 58, 237, 0.12)';

  ctx.beginPath();
  data.forEach((value, index) => {
    const x = padding + (width / (data.length - 1 || 1)) * index;
    const normalized = (value - minVal) / (maxVal - minVal || 1);
    const y = padding + height - normalized * height;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.lineTo(padding + width, padding + height);
  ctx.lineTo(padding, padding + height);
  ctx.closePath();
  ctx.fill();
}

function bindBoostButton() {
  if (!elements.boostButton) return;
  elements.boostButton.classList.toggle('active', state.boosted);
  elements.boostButton.addEventListener('click', () => {
    state.boosted = !state.boosted;
    elements.boostButton.classList.toggle('active', state.boosted);
    state.performance = boostData(state.basePerformance, state.boosted);
    renderChart();
  });
}

function bindHeroForm() {
  if (!elements.heroForm) return;
  elements.heroForm.addEventListener('submit', () => {
    loading.show();
  });
}

function bindRosterRowClicks() {
  if (!elements.rosterRows || !elements.rosterRows.length || !elements.heroForm) {
    return;
  }
  elements.rosterRows.forEach((row) => {
    row.addEventListener('click', () => {
      const targetField = ensurePlayerField();
      if (!targetField) return;
      const accountId = row.dataset.accountId;
      if (!accountId || targetField.value === accountId) {
        return;
      }

      targetField.value = accountId;
      elements.rosterRows.forEach((peer) => peer.classList.remove('is-selected'));
      row.classList.add('is-selected');

      if (typeof elements.heroForm.requestSubmit === 'function') {
        elements.heroForm.requestSubmit();
      } else {
        elements.heroForm.submit();
      }
    });
  });
}

function initializeBindings() {
  bindHeroForm();
  bindRosterRowClicks();
  bindFilterButtons();
  bindSearchInput();
  syncFilterUI();
  bindBoostButton();
  renderChart();
  applyFilters();
}

function scheduleIdleReload() {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    if (document.hidden) {
      scheduleIdleReload();
      return;
    }
    refreshSections();
  }, IDLE_RELOAD_DELAY);
}

function attachIdleListeners() {
  idleEvents.forEach((eventName) => {
    window.addEventListener(eventName, scheduleIdleReload, { passive: true });
  });
}

async function refreshSections() {
  if (isRefreshingSections) return;
  const hasSections = SECTION_SELECTORS.some((selector) => document.querySelector(selector));
  if (!hasSections) return;

  isRefreshingSections = true;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_ts', Date.now().toString());
    const response = await fetch(url.toString(), {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let updated = false;

    SECTION_SELECTORS.forEach((selector) => {
      const fresh = doc.querySelector(selector);
      const current = document.querySelector(selector);
      if (fresh && current) {
        current.replaceWith(fresh);
        updated = true;
      }
    });

    if (updated) {
      cacheDom();
      updatePerformanceState();
      initializeBindings();
      scheduleIdleReload();
    }
  } catch (error) {
    console.error('Unable to refresh dashboard', error);
  } finally {
    isRefreshingSections = false;
  }
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  const hasSections = SECTION_SELECTORS.some((selector) => document.querySelector(selector));
  if (!hasSections) return;
  refreshTimer = setInterval(() => {
    if (!document.hidden) {
      refreshSections();
    }
  }, REFRESH_INTERVAL);
}

function bootstrap() {
  cacheDom();
  updatePerformanceState();
  initializeBindings();
  attachIdleListeners();
  scheduleIdleReload();
  startAutoRefresh();
}

bootstrap();
