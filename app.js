/* ================================================================
   FUT Team Builder – app.js
   ================================================================ */

'use strict';

// ────────────────────────────────────────────────────────────────
// CONFIG  (config.js is loaded before this file)
// ────────────────────────────────────────────────────────────────
let apiKey =
  (typeof RAPIDAPI_CONFIG !== 'undefined' &&
   RAPIDAPI_CONFIG.RAPIDAPI_KEY !== 'YOUR_RAPIDAPI_KEY_HERE')
    ? RAPIDAPI_CONFIG.RAPIDAPI_KEY
    : (localStorage.getItem('fut_api_key') || '');

const API_HOST = 'api-football-v1.p.rapidapi.com';
const API_BASE = 'https://api-football-v1.p.rapidapi.com/v3';

// ────────────────────────────────────────────────────────────────
// FORMATIONS  –  x/y as % of pitch width/height (0,0 = top-left)
//               Attack is towards y=0, GK at y≈88
// ────────────────────────────────────────────────────────────────
const FORMATIONS = {
  '4-3-3': [
    { pos: 'GK',  x: 50, y: 88 },
    { pos: 'LB',  x: 15, y: 70 }, { pos: 'CB', x: 36, y: 70 },
    { pos: 'CB',  x: 64, y: 70 }, { pos: 'RB', x: 85, y: 70 },
    { pos: 'LM',  x: 22, y: 50 }, { pos: 'CM', x: 50, y: 50 }, { pos: 'RM', x: 78, y: 50 },
    { pos: 'LW',  x: 18, y: 23 }, { pos: 'ST', x: 50, y: 16 }, { pos: 'RW', x: 82, y: 23 },
  ],
  '4-4-2': [
    { pos: 'GK',  x: 50, y: 88 },
    { pos: 'LB',  x: 14, y: 70 }, { pos: 'CB', x: 36, y: 70 },
    { pos: 'CB',  x: 64, y: 70 }, { pos: 'RB', x: 86, y: 70 },
    { pos: 'LM',  x: 14, y: 50 }, { pos: 'CM', x: 38, y: 50 },
    { pos: 'CM',  x: 62, y: 50 }, { pos: 'RM', x: 86, y: 50 },
    { pos: 'ST',  x: 36, y: 22 }, { pos: 'ST', x: 64, y: 22 },
  ],
  '3-5-2': [
    { pos: 'GK',  x: 50, y: 88 },
    { pos: 'CB',  x: 25, y: 70 }, { pos: 'CB', x: 50, y: 68 }, { pos: 'CB', x: 75, y: 70 },
    { pos: 'LM',  x: 10, y: 50 }, { pos: 'CM', x: 30, y: 50 }, { pos: 'CM', x: 50, y: 50 },
    { pos: 'CM',  x: 70, y: 50 }, { pos: 'RM', x: 90, y: 50 },
    { pos: 'ST',  x: 36, y: 22 }, { pos: 'ST', x: 64, y: 22 },
  ],
  '4-2-3-1': [
    { pos: 'GK',  x: 50, y: 88 },
    { pos: 'LB',  x: 14, y: 72 }, { pos: 'CB', x: 36, y: 72 },
    { pos: 'CB',  x: 64, y: 72 }, { pos: 'RB', x: 86, y: 72 },
    { pos: 'CDM', x: 35, y: 57 }, { pos: 'CDM', x: 65, y: 57 },
    { pos: 'LW',  x: 18, y: 37 }, { pos: 'CAM', x: 50, y: 37 }, { pos: 'RW', x: 82, y: 37 },
    { pos: 'ST',  x: 50, y: 16 },
  ],
  '5-3-2': [
    { pos: 'GK',  x: 50, y: 88 },
    { pos: 'LWB', x: 10, y: 70 }, { pos: 'CB', x: 28, y: 70 },
    { pos: 'CB',  x: 50, y: 70 }, { pos: 'CB', x: 72, y: 70 }, { pos: 'RWB', x: 90, y: 70 },
    { pos: 'LM',  x: 22, y: 49 }, { pos: 'CM', x: 50, y: 49 }, { pos: 'RM', x: 78, y: 49 },
    { pos: 'ST',  x: 36, y: 22 }, { pos: 'ST', x: 64, y: 22 },
  ],
};

// ────────────────────────────────────────────────────────────────
// TEAM STATE
// ────────────────────────────────────────────────────────────────
const team = new Array(11).fill(null);   // each slot: null or PlayerInfo
let currentFormation = '4-3-3';
let selectedSlot     = null;             // index or null
let searchType       = 'name';
let isSearching      = false;

// ────────────────────────────────────────────────────────────────
// STAT CALCULATION
// ────────────────────────────────────────────────────────────────

/** Cheap deterministic variation per player id + salt — avoids Math.random() */
function pseudoVar(playerId, salt, range = 10) {
  const n = (Math.abs(playerId * 2654435761 + salt * 1234567891)) & 0x7fffffff;
  return (n % (range * 2 + 1)) - range;
}

function calcStats(player, stats) {
  const pid          = player.id || 0;
  const pos          = (stats.games?.position || 'Midfielder').toLowerCase();
  const appearances  = Math.max(stats.games?.appearences || 1, 1);
  const ratingRaw    = parseFloat(stats.games?.rating);

  // Overall: map API rating (~5–9.5) → FUT range (50–99)
  const overall = ratingRaw && ratingRaw > 0
    ? Math.round(Math.max(50, Math.min(99, ((ratingRaw - 5.0) / 4.5) * 49 + 50)))
    : 63;

  const goalsPerGame   = (stats.goals?.total   || 0) / appearances;
  const assistsPerGame = (stats.goals?.assists  || 0) / appearances;
  const passAcc        = parseFloat(stats.passes?.accuracy) || 58;
  const keyPassPG      = (stats.passes?.key     || 0) / appearances;
  const dribAttempts   = Math.max(stats.dribbles?.attempts || 1, 1);
  const dribRate       = (stats.dribbles?.success || 0) / dribAttempts;
  const shotTotal      = Math.max(stats.shots?.total || 1, 1);
  const shotOnRate     = (stats.shots?.on || 0) / shotTotal;
  const tacklesPG      = (stats.tackles?.total  || 0) / appearances;

  const isGK  = pos.includes('goal') || pos.includes('keeper');
  const isATT = pos.includes('attack') || pos.includes('forward') || pos.includes('winger');
  const isDEF = pos.includes('defend') || pos.includes('back');
  // Midfielder is the default

  let pace, shooting, passing, dribbling, defending, physicality;

  if (isGK) {
    pace        = Math.round(42 + overall * 0.08 + pseudoVar(pid, 1, 6));
    shooting    = Math.round(14 + pseudoVar(pid, 2, 5));
    passing     = Math.round(passAcc * 0.68 + pseudoVar(pid, 3, 5));
    dribbling   = Math.round(42 + pseudoVar(pid, 4, 6));
    defending   = Math.round(overall * 0.93 + pseudoVar(pid, 5, 5));
    physicality = Math.round(overall * 0.82 + pseudoVar(pid, 6, 5));
  } else if (isATT) {
    pace        = Math.round(55 + dribRate * 22 + pseudoVar(pid, 1, 8));
    shooting    = Math.round(50 + goalsPerGame * 55 + shotOnRate * 13 + pseudoVar(pid, 2, 8));
    passing     = Math.round(passAcc * 0.78 + assistsPerGame * 18 + pseudoVar(pid, 3, 7));
    dribbling   = Math.round(55 + dribRate * 33 + pseudoVar(pid, 4, 8));
    defending   = Math.round(overall * 0.32 + 20 + pseudoVar(pid, 5, 6));
    physicality = Math.round(50 + overall * 0.28 + pseudoVar(pid, 6, 7));
  } else if (isDEF) {
    pace        = Math.round(50 + dribRate * 14 + pseudoVar(pid, 1, 8));
    shooting    = Math.round(28 + goalsPerGame * 28 + pseudoVar(pid, 2, 7));
    passing     = Math.round(passAcc * 0.76 + pseudoVar(pid, 3, 7));
    dribbling   = Math.round(43 + dribRate * 20 + pseudoVar(pid, 4, 7));
    defending   = Math.round(58 + tacklesPG * 7 + overall * 0.28 + pseudoVar(pid, 5, 7));
    physicality = Math.round(56 + overall * 0.3 + pseudoVar(pid, 6, 7));
  } else {
    // Midfielder
    pace        = Math.round(52 + dribRate * 17 + pseudoVar(pid, 1, 8));
    shooting    = Math.round(40 + goalsPerGame * 43 + pseudoVar(pid, 2, 8));
    passing     = Math.round(passAcc * 0.83 + keyPassPG * 11 + pseudoVar(pid, 3, 7));
    dribbling   = Math.round(50 + dribRate * 26 + pseudoVar(pid, 4, 8));
    defending   = Math.round(43 + tacklesPG * 7 + overall * 0.24 + pseudoVar(pid, 5, 7));
    physicality = Math.round(50 + overall * 0.29 + pseudoVar(pid, 6, 7));
  }

  const clamp = (v, lo = 40, hi = 99) => Math.max(lo, Math.min(hi, v));
  return {
    overall:     clamp(overall, 50, 99),
    pace:        clamp(pace),
    shooting:    clamp(shooting),
    passing:     clamp(passing),
    dribbling:   clamp(dribbling),
    defending:   clamp(defending),
    physicality: clamp(physicality),
  };
}

function cardRarity(overall) {
  if (overall >= 85) return 'special';
  if (overall >= 75) return 'gold';
  if (overall >= 65) return 'silver';
  return 'bronze';
}

function posShort(posStr) {
  const p = (posStr || '').toLowerCase();
  if (p.includes('goal') || p.includes('keeper')) return 'GK';
  if (p.includes('attack') || p.includes('forward')) return 'ST';
  if (p.includes('defend') || p.includes('back')) return 'CB';
  return 'CM';
}

function shortName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return parts.length === 1 ? fullName : parts[parts.length - 1];
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ────────────────────────────────────────────────────────────────
// API HELPERS
// ────────────────────────────────────────────────────────────────

async function apiFetch(path) {
  if (!apiKey) throw new Error('No API key set. Click "🔑 API Key" to add yours.');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'X-RapidAPI-Key':  apiKey,
      'X-RapidAPI-Host': API_HOST,
    },
  });
  if (res.status === 403) throw new Error('Invalid API key or subscription. Check your RapidAPI dashboard.');
  if (res.status === 429) throw new Error('Rate limit hit. Please wait a moment then try again.');
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

const searchPlayers = (query, league, season) =>
  apiFetch(`/players?search=${encodeURIComponent(query)}&league=${league}&season=${season}`);

const searchTeams = (query) =>
  apiFetch(`/teams?search=${encodeURIComponent(query)}`);

const getTeamPlayers = (teamId, season) =>
  apiFetch(`/players?team=${teamId}&season=${season}`);

// ────────────────────────────────────────────────────────────────
// RENDER: PLAYER CARD
// ────────────────────────────────────────────────────────────────

function buildPlayerCard(playerData, inTeam = false) {
  const { player, statistics } = playerData;
  const s0       = statistics?.[0] || {};
  const computed = calcStats(player, s0);
  const rarity   = cardRarity(computed.overall);
  const position = posShort(s0.games?.position);
  const teamName = s0.team?.name   || '';
  const league   = s0.league?.name || '';

  const accentColors = { gold: '#d4af37', silver: '#9baab5', bronze: '#c87f3c', special: '#4a90d9' };
  const accent = accentColors[rarity];

  const photoHtml = player.photo
    ? `<img class="player-photo" src="${esc(player.photo)}" alt="${esc(player.name)}"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';

  const card = document.createElement('div');
  card.className = `player-card card-${rarity}`;
  card.dataset.playerId = player.id;

  card.innerHTML = `
    ${inTeam ? '<div class="card-in-team-badge">✓ In Team</div>' : ''}
    <div class="card-img-col">
      <div class="card-ovr-block">
        <span class="card-ovr">${computed.overall}</span>
        <span class="card-pos">${esc(position)}</span>
      </div>
      ${photoHtml}
      <div class="player-photo-placeholder" style="${player.photo ? 'display:none' : ''}">👤</div>
    </div>
    <div class="card-info-col">
      <div>
        <div class="card-name" title="${esc(player.name)}">${esc(player.name)}</div>
        <div class="card-meta">${esc(teamName)}${teamName && league ? ' · ' : ''}${esc(league)}</div>
      </div>
      <div class="card-stats-grid">
        <div class="cstat"><span class="cstat-val">${computed.pace}</span><span class="cstat-lbl"> PAC</span></div>
        <div class="cstat"><span class="cstat-val">${computed.shooting}</span><span class="cstat-lbl"> SHO</span></div>
        <div class="cstat"><span class="cstat-val">${computed.passing}</span><span class="cstat-lbl"> PAS</span></div>
        <div class="cstat"><span class="cstat-val">${computed.dribbling}</span><span class="cstat-lbl"> DRI</span></div>
        <div class="cstat"><span class="cstat-val">${computed.defending}</span><span class="cstat-lbl"> DEF</span></div>
        <div class="cstat"><span class="cstat-val">${computed.physicality}</span><span class="cstat-lbl"> PHY</span></div>
      </div>
    </div>
    <button class="card-add-btn${inTeam ? ' added' : ''}" title="${inTeam ? 'Already in team' : 'Add to team'}"
            aria-label="${inTeam ? 'Player already in team' : 'Add ' + player.name + ' to team'}">
      ${inTeam ? '✓' : '+'}
    </button>`;

  // Store data directly on element for retrieval
  card._futData = { player, statistics: statistics || [], computed, position };

  if (!inTeam) {
    const addFn = (e) => { e.stopPropagation(); addToTeam(card._futData); };
    card.querySelector('.card-add-btn').addEventListener('click', addFn);
    card.addEventListener('click', addFn);
  }

  return card;
}

// ────────────────────────────────────────────────────────────────
// RENDER: PITCH
// ────────────────────────────────────────────────────────────────

function renderPitch() {
  const container = document.getElementById('slotsContainer');
  const formation  = FORMATIONS[currentFormation];
  container.innerHTML = '';

  formation.forEach((slotDef, idx) => {
    const player = team[idx];
    const isFilled   = !!player;
    const isSelected = selectedSlot === idx;

    const slotEl = document.createElement('div');
    slotEl.className = `pitch-slot${isFilled ? ' filled' : ''}${isSelected ? ' selected' : ''}`;
    slotEl.style.left = `${slotDef.x}%`;
    slotEl.style.top  = `${slotDef.y}%`;
    slotEl.dataset.idx = idx;

    if (isFilled) {
      const { computed, player: p } = player;
      const accent = { gold: '#d4af37', silver: '#9baab5', bronze: '#c87f3c', special: '#4a90d9' }[cardRarity(computed.overall)];
      slotEl.style.setProperty('--slot-accent', accent + '99');

      const photoHtml = p.photo
        ? `<img class="slot-photo" src="${esc(p.photo)}" alt="${esc(p.name)}"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';

      slotEl.innerHTML = `
        <div class="slot-ring" style="border-color:${accent}88; position:relative">
          ${photoHtml}
          <div class="slot-photo-placeholder" style="${p.photo ? 'display:none' : ''}">👤</div>
          <div class="slot-rating" style="background:${accent};color:${accent === '#4a90d9' ? '#fff' : '#1a1200'}">${computed.overall}</div>
          <button class="slot-remove-btn" data-idx="${idx}" aria-label="Remove ${esc(p.name)}">✕</button>
        </div>
        <div class="slot-name">${esc(shortName(p.name))}</div>
        <div class="slot-pos-label" style="color:${accent}">${esc(slotDef.pos)}</div>`;
    } else {
      slotEl.innerHTML = `
        <div class="slot-ring">
          <span class="slot-pos-empty">${esc(slotDef.pos)}</span>
        </div>
        <div class="slot-label-empty">Empty</div>`;
    }

    slotEl.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.slot-remove-btn');
      if (removeBtn) {
        e.stopPropagation();
        removeFromTeam(parseInt(removeBtn.dataset.idx));
        return;
      }
      toggleSelectSlot(idx);
    });

    container.appendChild(slotEl);
  });
}

// ────────────────────────────────────────────────────────────────
// TEAM MANAGEMENT
// ────────────────────────────────────────────────────────────────

const POS_GROUP = {
  GK:  'GK',
  LB:  'DEF', RB: 'DEF', CB: 'DEF', LWB: 'DEF', RWB: 'DEF', SW: 'DEF',
  LM:  'MID', RM: 'MID', CM: 'MID', CDM: 'MID', CAM: 'MID', DM: 'MID', AM: 'MID',
  LW:  'FWD', RW: 'FWD', ST: 'FWD', CF: 'FWD', SS: 'FWD',
};

function slotGroup(slotPos) { return POS_GROUP[slotPos] || 'MID'; }
function playerGroup(posShortStr) { return POS_GROUP[posShortStr] || 'MID'; }

function addToTeam(playerInfo) {
  // If a slot is manually selected, assign there
  if (selectedSlot !== null) {
    team[selectedSlot] = playerInfo;
    const pos = FORMATIONS[currentFormation][selectedSlot].pos;
    showToast(`${playerInfo.player.name} → ${pos}`);
    selectedSlot = null;
    afterTeamChange();
    return;
  }

  // Auto-assign: prefer matching position group
  const group = playerGroup(playerInfo.position);
  const formation = FORMATIONS[currentFormation];
  let target = -1;

  for (let i = 0; i < 11; i++) {
    if (!team[i] && slotGroup(formation[i].pos) === group) { target = i; break; }
  }
  // Fallback: first empty slot
  if (target === -1) {
    for (let i = 0; i < 11; i++) {
      if (!team[i]) { target = i; break; }
    }
  }
  if (target === -1) {
    showToast('Team is full! Remove a player first.', 'error');
    return;
  }

  team[target] = playerInfo;
  showToast(`${playerInfo.player.name} → ${formation[target].pos}`);
  afterTeamChange();
}

function removeFromTeam(idx) {
  if (team[idx]) {
    showToast(`${team[idx].player.name} removed`);
    team[idx] = null;
    afterTeamChange();
  }
}

function toggleSelectSlot(idx) {
  selectedSlot = (selectedSlot === idx) ? null : idx;
  renderPitch();
  renderSlotHint();
}

function afterTeamChange() {
  renderPitch();
  updateTeamStats();
  refreshCardStates();
  renderSlotHint();
}

// ────────────────────────────────────────────────────────────────
// SLOT HINT  (injected between search bar and status)
// ────────────────────────────────────────────────────────────────
function renderSlotHint() {
  let hint = document.getElementById('slotHint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'slotHint';
    hint.className = 'slot-hint';
    document.getElementById('searchStatus').after(hint);
  }
  if (selectedSlot !== null) {
    const pos = FORMATIONS[currentFormation][selectedSlot].pos;
    hint.textContent = `📍 Slot selected: ${pos} — now click a player to assign`;
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
}

// ────────────────────────────────────────────────────────────────
// TEAM STATS BAR
// ────────────────────────────────────────────────────────────────
function updateTeamStats() {
  const players = team.filter(Boolean);
  const n = players.length;
  document.getElementById('statPlayers').textContent = `${n}/11`;

  const avg = (key) => n ? Math.round(players.reduce((s, p) => s + p.computed[key], 0) / n) : '—';
  document.getElementById('statRating').textContent     = avg('overall');
  document.getElementById('statPace').textContent       = avg('pace');
  document.getElementById('statShooting').textContent   = avg('shooting');
  document.getElementById('statPassing').textContent    = avg('passing');
  document.getElementById('statDribbling').textContent  = avg('dribbling');
  document.getElementById('statDefending').textContent  = avg('defending');
  document.getElementById('statPhysicality').textContent = avg('physicality');
}

// ────────────────────────────────────────────────────────────────
// CARD STATE REFRESH  (in-team badges & button state)
// ────────────────────────────────────────────────────────────────
function refreshCardStates() {
  const inTeamIds = new Set(team.filter(Boolean).map(p => p.player.id));

  document.querySelectorAll('.player-card').forEach(card => {
    const pid = parseInt(card.dataset.playerId);
    const addBtn = card.querySelector('.card-add-btn');
    const alreadyIn = inTeamIds.has(pid);

    if (alreadyIn) {
      if (!card.querySelector('.card-in-team-badge')) {
        const badge = document.createElement('div');
        badge.className = 'card-in-team-badge';
        badge.textContent = '✓ In Team';
        card.prepend(badge);
      }
      if (addBtn) { addBtn.classList.add('added'); addBtn.textContent = '✓'; }
    } else {
      card.querySelector('.card-in-team-badge')?.remove();
      if (addBtn) { addBtn.classList.remove('added'); addBtn.textContent = '+'; }
    }
  });
}

// ────────────────────────────────────────────────────────────────
// SEARCH
// ────────────────────────────────────────────────────────────────

async function doSearch() {
  const query  = document.getElementById('searchInput').value.trim();
  const season = document.getElementById('seasonSelect').value;
  const league = document.getElementById('leagueSelect').value;

  if (!apiKey) {
    document.getElementById('apiKeyModal').hidden = false;
    return;
  }
  if (query.length < 3) {
    document.getElementById('searchStatus').textContent = '⚠️ Enter at least 3 characters';
    return;
  }
  if (isSearching) return;
  isSearching = true;

  const resultsEl = document.getElementById('searchResults');
  const statusEl  = document.getElementById('searchStatus');

  resultsEl.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Searching…</p></div>`;
  statusEl.textContent = '';

  try {
    if (searchType === 'name') {
      const data = await searchPlayers(query, league, season);
      renderPlayerResults(data);
    } else {
      const data = await searchTeams(query);
      renderTeamResults(data, season);
    }
  } catch (err) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p style="color:#e06060">${esc(err.message)}</p>
      </div>`;
    statusEl.textContent = '';
  } finally {
    isSearching = false;
  }
}

function renderPlayerResults(data) {
  const resultsEl = document.getElementById('searchResults');
  const statusEl  = document.getElementById('searchStatus');
  const results   = data?.response || [];

  if (!results.length) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😕</div>
        <p>No players found.<br>Try a different name or season.</p>
      </div>`;
    statusEl.textContent = '';
    return;
  }

  // Filter out entries without statistics (can't compute meaningful card)
  const withStats = results.filter(r => r.statistics?.length);

  statusEl.textContent = `${withStats.length} player${withStats.length !== 1 ? 's' : ''} found`;
  resultsEl.innerHTML = '';

  const inTeamIds = new Set(team.filter(Boolean).map(p => p.player.id));
  withStats.forEach(pd => resultsEl.appendChild(buildPlayerCard(pd, inTeamIds.has(pd.player.id))));

  if (!resultsEl.children.length) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😕</div>
        <p>No stats available for this season.<br>Try a different season.</p>
      </div>`;
  }
}

function renderTeamResults(data, season) {
  const resultsEl = document.getElementById('searchResults');
  const statusEl  = document.getElementById('searchStatus');
  const teams     = data?.response || [];

  if (!teams.length) {
    resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">😕</div><p>No teams found.</p></div>`;
    return;
  }

  statusEl.textContent = `${teams.length} team${teams.length !== 1 ? 's' : ''} found — click to load players`;
  resultsEl.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'team-list';

  teams.forEach(({ team: t }) => {
    const item = document.createElement('div');
    item.className = 'team-item';
    item.innerHTML = `
      ${t.logo
        ? `<img class="team-logo" src="${esc(t.logo)}" alt="${esc(t.name)}" onerror="this.outerHTML='<span class=team-logo-placeholder>⚽</span>'">`
        : '<span class="team-logo-placeholder">⚽</span>'}
      <div>
        <div class="team-item-name">${esc(t.name)}</div>
        <div class="team-item-country">${esc(t.country || '')}</div>
      </div>
      <span class="team-item-arrow">→</span>`;

    item.addEventListener('click', async () => {
      statusEl.textContent = `Loading ${t.name}…`;
      resultsEl.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Loading players…</p></div>`;
      try {
        const pData = await getTeamPlayers(t.id, season);
        renderPlayerResults(pData);
      } catch (err) {
        resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p style="color:#e06060">${esc(err.message)}</p></div>`;
      }
    });

    list.appendChild(item);
  });

  resultsEl.appendChild(list);
}

// ────────────────────────────────────────────────────────────────
// TOAST
// ────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = `toast${type === 'error' ? ' error' : ''}`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ────────────────────────────────────────────────────────────────
// API KEY UI
// ────────────────────────────────────────────────────────────────
function updateBanner() {
  document.getElementById('apiBanner').classList.toggle('hidden', !!apiKey);
}

// ────────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderPitch();
  updateTeamStats();
  updateBanner();

  // Search
  document.getElementById('searchBtn').addEventListener('click', doSearch);
  document.getElementById('searchInput').addEventListener('keydown', e => e.key === 'Enter' && doSearch());

  // Search type tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      searchType = btn.dataset.type;
      const isByName = searchType === 'name';
      document.getElementById('searchInput').placeholder =
        isByName ? 'Search players (min 3 chars)…' : 'Search teams…';
      // League selector is only relevant for name searches (team search uses /players?team=id)
      document.getElementById('leagueSelect').style.display = isByName ? '' : 'none';
      document.getElementById('leagueNote').style.display   = isByName ? '' : 'none';
    });
  });

  // Formation
  document.getElementById('formationSelect').addEventListener('change', e => {
    currentFormation = e.target.value;
    selectedSlot = null;
    renderPitch();
    renderSlotHint();
  });

  // Clear team
  document.getElementById('clearTeamBtn').addEventListener('click', () => {
    if (!team.some(Boolean) || confirm('Clear all players from the team?')) {
      team.fill(null);
      selectedSlot = null;
      afterTeamChange();
    }
  });

  // API Key modal – open
  document.getElementById('apiKeyBtn').addEventListener('click', () => {
    document.getElementById('apiKeyInput').value = apiKey;
    document.getElementById('apiKeyModal').hidden = false;
  });
  document.getElementById('setBannerKeyBtn')?.addEventListener('click', () => {
    document.getElementById('apiKeyInput').value = apiKey;
    document.getElementById('apiKeyModal').hidden = false;
  });

  // API Key modal – save
  document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key) {
      apiKey = key;
      localStorage.setItem('fut_api_key', key);
      document.getElementById('apiKeyModal').hidden = true;
      updateBanner();
      showToast('API key saved ✓');
    }
  });

  // API Key modal – close
  document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('apiKeyModal').hidden = true;
  });
  document.getElementById('apiKeyModal').addEventListener('click', e => {
    if (e.target === document.getElementById('apiKeyModal'))
      document.getElementById('apiKeyModal').hidden = true;
  });

  // Allow Enter in API key input
  document.getElementById('apiKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('saveApiKeyBtn').click();
  });
});
