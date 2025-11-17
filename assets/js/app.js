const state = {
  filter: 'all',
  query: '',
  boosted: false,
  isFetching: false,
};

const heroForm = document.querySelector('.hero-form');
const loadingOverlay = document.getElementById('loadingOverlay');
const idleEvents = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'];
const IDLE_RELOAD_DELAY = 60 * 1000;
let idleTimer = null;
let lastQuery = new URLSearchParams(window.location.search);

const numberFormatter = new Intl.NumberFormat('en-US');
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
const idleEvents = ['click']; /*'click', 'mousemove', 'keydown', 'scroll', 'touchstart'*/
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
  hide() {
    if (loadingOverlay) {
      loadingOverlay.classList.remove('is-active');
    }
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(value) {
  const num = Number(value ?? 0);
  return numberFormatter.format(Number.isFinite(num) ? num : 0);
}

function formatPercentValue(value, digits = 2) {
  const num = Number(value ?? 0);
  return `${Number.isFinite(num) ? num.toFixed(digits) : '0.00'}%`;
}

function getRosterTable() {
  return document.getElementById('rosterTable');
}

function applyFilters() {
  const table = getRosterTable();
};

function applyFilters() {
  if (!table) return;
  const rows = table.querySelectorAll('tbody tr');
  const q = state.query.toLowerCase();

  rows.forEach((row) => {
    const matchesFilter = state.filter === 'all' || row.dataset.role === state.filter;
    const matchesQuery = row.innerText.toLowerCase().includes(q);
    row.style.display = matchesFilter && matchesQuery ? '' : 'none';
  });
}

document.addEventListener('input', (event) => {
  if (event.target && event.target.id === 'rosterSearch') {
    state.query = event.target.value || '';
    applyFilters();
  }
});

document.addEventListener('click', (event) => {
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton && filterButton.closest('.filter-group')) {
    const group = filterButton.closest('.filter-group');
    if (group) {
      const filter = filterButton.dataset.filter || 'all';
      state.filter = filter;
      group.querySelectorAll('[data-filter]').forEach((btn) => btn.classList.remove('active'));
      filterButton.classList.add('active');
      applyFilters();
    }
    return;
  }

  const rosterRow = event.target.closest('.roster-row');
  if (rosterRow) {
    const targetField = ensurePlayerField();
    if (!targetField) return;
    const accountId = rosterRow.dataset.accountId;
    if (!accountId || targetField.value === accountId) {
      return;
    }
    targetField.value = accountId;
    const selectField = document.getElementById('player');
    if (selectField) {
      selectField.value = accountId;
    }
    if (typeof heroForm?.requestSubmit === 'function') {
      heroForm.requestSubmit();
    } else {
      heroForm?.submit();
    }
  }
});

const boostButton = document.getElementById('sparkline-boost');
if (boostButton) {
  boostButton.addEventListener('click', () => {
    state.boosted = !state.boosted;
    boostButton.classList.toggle('active', state.boosted);
    renderChart();
  });
}

function getPerformanceValues() {
  const values = window.APP_DATA?.performance?.values || [];
  if (!values.length) {
    return values;
  }
  if (!state.boosted) {
    return [...values];
  }
  return values.map((value, index) =>
    Math.round(Number(value) * (index % 2 === 0 ? 1.05 : 1))
  );
}

function renderChart() {
  const chartCanvas = document.getElementById('performanceChart');
  const data = getPerformanceValues();
  if (!chartCanvas || !data.length) return;
  const ctx = chartCanvas.getContext('2d');
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

renderChart();
applyFilters();

if (heroForm) {
  heroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    fetchDashboardData(null, { showLoading: true });
  });
}

function getCurrentQuery() {
  if (!heroForm) {
    return lastQuery ? new URLSearchParams(lastQuery) : new URLSearchParams();
  }
  const formData = new FormData(heroForm);
  const params = new URLSearchParams();
  formData.forEach((value, key) => {
    if (value !== null && value !== undefined) {
      params.set(key, value);
    }
  });
  return params;
}

if (heroForm) {
  lastQuery = getCurrentQuery();
}

async function fetchDashboardData(customParams, options = {}) {
  if (!heroForm || state.isFetching) return;
  const { showLoading = true } = options;
  const params = customParams ? new URLSearchParams(customParams) : getCurrentQuery();
  const storedParams = new URLSearchParams(params);
  storedParams.delete('format');
  lastQuery = storedParams;
  params.set('format', 'json');
  const url = `${window.location.pathname}?${params.toString()}`;
  state.isFetching = true;
  if (showLoading) {
    loading.show();
  }
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error);
    }
    const data = payload.data || payload;
    updateDashboard(data);
  } catch (error) {
    console.error('Unable to refresh dashboard', error);
  } finally {
    state.isFetching = false;
    if (showLoading) {
      loading.hide();
    }
    scheduleIdleReload();
  }
}

function updateHistory() {
  if (!lastQuery) return;
  const queryString = lastQuery.toString();
  const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

function updateHero(data) {
  if (!data?.player) return;
  const heroName = document.getElementById('heroName');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const heroEyebrow = document.getElementById('heroEyebrow');
  const avatar = document.getElementById('heroAvatar');
  const heroMetrics = document.getElementById('heroMetrics');

  if (heroName) {
    heroName.textContent = data.player.nickname;
  }
  if (heroSubtitle) {
    heroSubtitle.textContent = `${data.player.roleLabel} · ${data.clan.tag} / ${data.clan.name}`;
  }
  if (heroEyebrow) {
    heroEyebrow.textContent = `World of Tanks · ${data.meta.realmLabel} realm`;
  }
  if (avatar) {
    avatar.textContent = data.player.initials || data.player.nickname.slice(0, 2).toUpperCase();
  }
  if (heroMetrics) {
    heroMetrics.innerHTML = `
      <article>
        <p class="label">Global rating</p>
        <h2>${formatNumber(data.player.globalRating)}</h2>
        <span class="badge positive">${escapeHtml(data.player.roleLabel)}</span>
      </article>
      <article>
        <p class="label">Win rate</p>
        <h2>${formatPercentValue(data.player.winRate)}</h2>
        <span class="muted">${formatNumber(data.player.battles)} battles</span>
      </article>
      <article>
        <p class="label">Service time</p>
        <h2>${formatNumber(data.player.serviceDays)} days</h2>
        <span class="muted">${escapeHtml(data.player.joinedLabel)}</span>
      </article>
    `;
  }
}

function updateHeroTags(data) {
  const heroTags = document.getElementById('heroTags');
  if (!heroTags) return;
  heroTags.innerHTML = `
    <span class="chip">Clan · ${escapeHtml(data.clan.tag)}</span>
    <span class="chip">Leader · ${escapeHtml(data.clan.leader ?? 'Unknown')}</span>
    <span class="chip">Members · ${formatNumber(data.clan.members)}</span>
    <span class="chip">Created · ${escapeHtml(data.clan.created)}</span>
    <span class="chip">Last update · ${escapeHtml(data.meta.updatedLabel)}</span>
  `;
}

function updateHeroForm(data) {
  if (!heroForm || !data?.selectors) return;
  const clanField = heroForm.querySelector('#clan_id');
  if (clanField) {
    clanField.value = data.selectors.clanId;
  }
  const realmField = heroForm.querySelector('#realm');
  if (realmField) {
    realmField.value = data.selectors.realm;
  }
  const playerField = heroForm.querySelector('#player');
  if (playerField && Array.isArray(data.selectors.players)) {
    playerField.innerHTML = data.selectors.players
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      .join('');
    playerField.value = data.selectors.playerId;
  }
  const fallback = document.getElementById('player_fallback');
  if (fallback) {
    fallback.value = data.selectors.playerId;
  }
}

function updateReadiness(data) {
  const readinessCard = document.getElementById('readinessCard');
  if (!readinessCard || !data?.readiness) return;
  const badge = document.getElementById('readinessActive');
  const winRate = document.getElementById('readinessWinRate');
  const description = document.getElementById('readinessDescription');
  const progress = document.getElementById('readinessProgress');
  const battles = document.getElementById('readinessBattles');

  if (badge) {
    badge.textContent = `${formatNumber(data.readiness.activeMembers)} active this week`;
  }
  if (winRate) {
    winRate.textContent = formatPercentValue(data.readiness.averageWinRate);
  }
  if (description) {
    description.textContent = `Average win rate across ${formatNumber(data.readiness.memberCount)} members.`;
  }
  if (progress) {
    const width = Math.min(100, Math.max(0, Number(data.readiness.averageWinRate || 0)));
    progress.style.width = `${width}%`;
  }
  if (battles) {
    battles.textContent = `Total battles ${formatNumber(data.readiness.totalBattles)}`;
  }
}

function updatePerformanceCard(data) {
  const legend = document.getElementById('performanceLegend');
  if (legend && data?.performance?.labels) {
    const colors = data.performance.colors || [];
    legend.innerHTML = data.performance.labels
      .map((label, index) => `<li><span style="--color: ${escapeHtml(colors[index % colors.length] || '#34d399')}"></span>${escapeHtml(label)}</li>`)
      .join('');
  }
}

function updateTimeline(data) {
  const timelineList = document.getElementById('timelineList');
  if (!timelineList || !Array.isArray(data?.timeline)) return;
  timelineList.innerHTML = data.timeline
    .map(
      (member) => `
        <li>
          <div class="timeline-point" style="--color: ${escapeHtml(member.color)}"></div>
          <div>
            <strong>${escapeHtml(member.nickname)}</strong>
            <p class="muted small">${escapeHtml(member.joinedLabel)} · ${escapeHtml(member.roleLabel)}</p>
          </div>
          <span class="badge neutral">${formatNumber(member.battles)} battles</span>
        </li>
      `
    )
    .join('');
}

function updateTanks(data) {
  const tankBody = document.getElementById('tankBody');
  if (!tankBody) return;
  const tiers = data?.tanks?.tiers;
  if (data?.tanks?.error) {
    tankBody.innerHTML = `<p class="muted">${escapeHtml(data.tanks.error)}</p>`;
    return;
  }
  if (!Array.isArray(tiers) || !tiers.length) {
    tankBody.innerHTML = '<p class="muted">Tank dossier unavailable for this player.</p>';
    return;
  }
  tankBody.innerHTML = `
    <div class="tank-grid">
      ${tiers
        .map(
          (tier) => `
            <div class="tank-column">
              <h4>Tier ${escapeHtml(tier.tier)} tanks</h4>
              <table>
                <thead>
                  <tr>
                    <th>Config tank</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${tier.tanks
                    .map(
                      (tank) => `
                        <tr>
                          <td>
                            <div class="tank-info">
                              ${tank.image ? `<img src="${escapeHtml(tank.image)}" alt="${escapeHtml(tank.name)}" loading="lazy" />` : ''}
                              <div>
                                <strong>${escapeHtml(tank.name)}</strong>
                                <p class="muted small">${formatNumber(tank.battles)} battles · ${formatPercentValue(tank.winRate, 1)} WR</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span class="status-chip ${tank.status ? 'online' : 'offline'}" title="${tank.status ? 'Win rate above 50%' : 'Win rate below 50%'}">${tank.status ? '✔' : '✕'}</span>
                          </td>
                        </tr>
                      `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function updateRoster(data) {
  const filterGroup = document.querySelector('.filter-group');
  if (filterGroup && Array.isArray(data?.roster?.roleFilters)) {
    const availableFilters = data.roster.roleFilters.map((filter) => filter.key);
    if (state.filter !== 'all' && !availableFilters.includes(state.filter)) {
      state.filter = 'all';
    }
    filterGroup.innerHTML = [
      { key: 'all', label: 'All' },
      ...data.roster.roleFilters,
    ]
      .map((filter) =>
        `<button class="chip ${state.filter === filter.key ? 'active' : ''}" data-filter="${escapeHtml(filter.key)}" type="button">${escapeHtml(filter.label)}</button>`
      )
      .join('');
  }

  const table = getRosterTable();
  if (table && Array.isArray(data?.roster?.members)) {
    const tbody = table.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = data.roster.members
        .map((member) => {
          const isSelected = data.player && member.accountId === data.player.accountId;
          return `
            <tr class="roster-row${isSelected ? ' is-selected' : ''}" data-role="${escapeHtml(member.roleKey)}" data-account-id="${escapeHtml(member.accountId)}">
              <td>
                <strong>${escapeHtml(member.nickname)}</strong>
                <p class="muted small">${escapeHtml(member.joinedLabel)} · Rating ${formatNumber(member.globalRating)}</p>
              </td>
              <td><span class="pill" style="--color: ${escapeHtml(member.color)}">${escapeHtml(member.roleLabel)}</span></td>
              <td>${formatNumber(member.battles)}</td>
              <td>${formatNumber(member.wins)}</td>
              <td>${formatPercentValue(member.winRate)}</td>
              <td>${formatNumber(member.avgXp)}</td>
              <td>${escapeHtml(member.lastBattleLabel)}</td>
            </tr>
          `;
        })
        .join('');
    }
  }
  const searchInput = document.getElementById('rosterSearch');
  if (searchInput && searchInput.value !== state.query) {
    searchInput.value = state.query;
  }
}

function updateDashboard(data) {
  window.APP_DATA = data;
  state.boosted = false;
  if (boostButton) {
    boostButton.classList.remove('active');
  }
  updateHero(data);
  updateHeroTags(data);
  updateHeroForm(data);
  updateReadiness(data);
  updatePerformanceCard(data);
  updateTimeline(data);
  updateTanks(data);
  updateRoster(data);
  applyFilters();
  renderChart();
  updateHistory();
}

function scheduleIdleReload() {
  if (!heroForm) return;
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
    fetchDashboardData(lastQuery, { showLoading: false });
  }, IDLE_RELOAD_DELAY);
}

idleEvents.forEach((eventName) => {
  window.addEventListener(eventName, scheduleIdleReload, { passive: true });
});

scheduleIdleReload();
