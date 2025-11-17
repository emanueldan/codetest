const state = {
  filter: 'all',
  query: '',
  boosted: false,
};

const table = document.getElementById('rosterTable');
const rosterBody = table ? table.querySelector('tbody') : null;
const searchInput = document.getElementById('rosterSearch');
const filterButtons = document.querySelectorAll('[data-filter]');
const boostButton = document.getElementById('sparkline-boost');
const chartCanvas = document.getElementById('performanceChart');
const heroForm = document.querySelector('.hero-form');
const loadingOverlay = document.getElementById('loadingOverlay');
const rosterRows = document.querySelectorAll('.roster-row');
const idleEvents = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'];
const IDLE_RELOAD_DELAY = 60 * 1000;
let idleTimer = null;

function ensurePlayerField() {
  if (!heroForm) return null;
  let field = document.getElementById('player');
  if (!field) {
    field = document.createElement('input');
    field.type = 'hidden';
    field.name = 'player';
    field.id = 'player_fallback';
    heroForm.appendChild(field);
  }
  return field;
}

const loading = {
  show() {
    if (loadingOverlay) {
      loadingOverlay.classList.add('is-active');
    }
  },
};

function applyFilters() {
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr');
  const q = state.query.toLowerCase();

  rows.forEach((row) => {
    const matchType = state.filter === 'all' || row.dataset.role === state.filter;
    const matchText = row.innerText.toLowerCase().includes(q);
    row.style.display = matchType && matchText ? '' : 'none';
  });
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    state.filter = button.dataset.filter;
    applyFilters();
  });
});

if (searchInput) {
  searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    applyFilters();
  });
}

function renderChart() {
  if (!chartCanvas || !window.APP_DATA) return;
  const ctx = chartCanvas.getContext('2d');
  const data = [...window.APP_DATA.performance];
  const padding = 24;
  const width = chartCanvas.width - padding * 2;
  const height = chartCanvas.height - padding * 2;
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);

  ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
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
    const x = padding + (width / (data.length - 1)) * index;
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

if (boostButton) {
  boostButton.addEventListener('click', () => {
    state.boosted = !state.boosted;
    boostButton.classList.toggle('active', state.boosted);
    const multiplier = state.boosted ? 1.05 : 1;
    window.APP_DATA.performance = window.APP_DATA.performance.map((value, index) =>
      Math.round(value * (index % 2 === 0 ? multiplier : 1))
    );
    renderChart();
  });
}

renderChart();
applyFilters();

if (heroForm) {
  heroForm.addEventListener('submit', () => {
    loading.show();
  });
}

if (rosterRows.length) {
  rosterRows.forEach((row) => {
    row.addEventListener('click', () => {
      const targetField = ensurePlayerField();
      if (!targetField) return;
      const accountId = row.dataset.accountId;
      if (!accountId || targetField.value === accountId) {
        return;
      }

      targetField.value = accountId;

      rosterRows.forEach((peer) => peer.classList.remove('is-selected'));
      row.classList.add('is-selected');

      if (typeof heroForm.requestSubmit === 'function') {
        heroForm.requestSubmit();
      } else {
        heroForm.submit();
      }
    });
  });
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
    window.location.reload();
  }, IDLE_RELOAD_DELAY);
}

idleEvents.forEach((eventName) => {
  window.addEventListener(eventName, scheduleIdleReload, { passive: true });
});

scheduleIdleReload();
