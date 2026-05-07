/* ================================================================
   FC26 Team Builder – app.js
   API: https://api.msmc.cc/api/fc26  (no auth required)
   ================================================================ */

'use strict';

// ────────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.msmc.cc/api/fc26';

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

const fetchByName  = (name)  => apiFetch(`/player/name/${encodeURIComponent(name)}`);
const fetchByTeam  = (team)  => apiFetch(`/team/${encodeURIComponent(team)}`);
const fetchByRank  = (rank)  => apiFetch(`/player/rank/${rank}`);

// ────────────────────────────────────────────────────────────────
// FORMATIONS  –  x/y as % of pitch (0,0 = top-left, attack at top)
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
const team = new Array(11).fill(null);   // each slot: null or player object
let currentFormation = '4-3-3';
let selectedSlot     = null;
let searchType       = 'name';
let isSearching      = false;

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shortName(fullName) {
  const parts = String(fullName).trim().split(/\s+/);
  return parts.length === 1 ? fullName : parts[parts.length - 1];
}

const POS_GROUP = {
  GK: 'GK',
  LB: 'DEF', RB: 'DEF', CB: 'DEF', LWB: 'DEF', RWB: 'DEF', WB: 'DEF',
  LM: 'MID', RM: 'MID', CM: 'MID', CDM: 'MID', CAM: 'MID', DM: 'MID', AM: 'MID',
  LW: 'FWD', RW: 'FWD', ST: 'FWD', CF: 'FWD', SS: 'FWD',
};
function posGroup(pos) { return POS_GROUP[pos] || 'MID'; }

// ────────────────────────────────────────────────────────────────
// RENDER: SEARCH RESULT CARD
// Each card shows the real EA FC26 card image + supplementary info
// ────────────────────────────────────────────────────────────────
function buildResultCard(player, inTeam = false) {
  const card = document.createElement('div');
  card.className = `result-card${inTeam ? ' in-team' : ''}`;
  card.dataset.playerId = player.ID;

  const stats = ['PAC','SHO','PAS','DRI','DEF','PHY']
    .map(k => `<div class="rs-stat"><span class="rs-val">${esc(player[k] ?? '—')}</span><span class="rs-lbl">${k}</span></div>`)
    .join('');

  card.innerHTML = `
    ${inTeam ? '<div class="result-in-team-badge">✓ In Team</div>' : ''}
    <div class="result-card-img-wrap">
      <img class="result-card-img" src="${esc(player.card)}" alt="${esc(player.Name)} card"
           onerror="this.src='';this.closest('.result-card-img-wrap').innerHTML='<div class=card-img-fallback>${esc(player.OVR)}</div>'">
    </div>
    <div class="result-card-info">
      <div class="rc-name" title="${esc(player.Name)}">${esc(player.Name)}</div>
      <div class="rc-meta">${esc(player.Team)} · ${esc(player.League)}</div>
      <div class="rc-meta">${esc(player.Nation)} · Age ${esc(player.Age)}</div>
      <div class="rc-stats">${stats}</div>
    </div>
    <button class="rc-add-btn${inTeam ? ' added' : ''}" title="${inTeam ? 'Already in team' : 'Add to team'}">
      ${inTeam ? '✓' : '+'}
    </button>`;

  card._player = player;

  if (!inTeam) {
    const addFn = (e) => { e.stopPropagation(); addToTeam(card._player); };
    card.querySelector('.rc-add-btn').addEventListener('click', addFn);
    card.addEventListener('click', addFn);
  }
  return card;
}

// ────────────────────────────────────────────────────────────────
// RENDER: PITCH
// ────────────────────────────────────────────────────────────────
let dragSourceIdx = null;

function renderPitch() {
  const container = document.getElementById('slotsContainer');
  container.innerHTML = '';

  FORMATIONS[currentFormation].forEach((slotDef, idx) => {
    const player     = team[idx];
    const isFilled   = !!player;
    const isSelected = selectedSlot === idx;

    const slotEl = document.createElement('div');
    slotEl.className = `pitch-slot${isFilled ? ' filled' : ''}${isSelected ? ' selected' : ''}`;
    slotEl.style.left = `${slotDef.x}%`;
    slotEl.style.top  = `${slotDef.y}%`;
    slotEl.dataset.idx = idx;

    if (isFilled) {
      slotEl.draggable = true;
      slotEl.innerHTML = `
        <div class="slot-card-wrap">
          <img class="slot-card-img" src="${esc(player.card)}" alt="${esc(player.Name)}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="slot-card-fallback" style="display:none">${esc(player.OVR)}</div>
          <button class="slot-remove-btn" data-idx="${idx}" aria-label="Remove ${esc(player.Name)}">✕</button>
        </div>
        <div class="slot-name">${esc(shortName(player.Name))}</div>
        <div class="slot-pos-label">${esc(slotDef.pos)}</div>`;
    } else {
      slotEl.innerHTML = `
        <div class="slot-empty-ring">
          <span class="slot-pos-empty">${esc(slotDef.pos)}</span>
        </div>
        <div class="slot-label-empty">Empty</div>`;
    }

    // Click: remove or select
    slotEl.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.slot-remove-btn');
      if (removeBtn) {
        e.stopPropagation();
        removeFromTeam(parseInt(removeBtn.dataset.idx));
        return;
      }
      toggleSelectSlot(idx);
    });

    // Drag source
    slotEl.addEventListener('dragstart', (e) => {
      if (!isFilled) { e.preventDefault(); return; }
      dragSourceIdx = idx;
      slotEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    slotEl.addEventListener('dragend', () => {
      slotEl.classList.remove('dragging');
      dragSourceIdx = null;
      // Clear any lingering drag-over highlights
      container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    // Drop target
    slotEl.addEventListener('dragover', (e) => {
      if (dragSourceIdx === null || dragSourceIdx === idx) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      slotEl.classList.add('drag-over');
    });
    slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));
    slotEl.addEventListener('drop', (e) => {
      e.preventDefault();
      slotEl.classList.remove('drag-over');
      if (dragSourceIdx === null || dragSourceIdx === idx) return;
      // Swap the two slots
      const tmp = team[dragSourceIdx];
      team[dragSourceIdx] = team[idx];
      team[idx] = tmp;
      dragSourceIdx = null;
      afterTeamChange();
    });

    container.appendChild(slotEl);
  });
}

// ────────────────────────────────────────────────────────────────
// TEAM MANAGEMENT
// ────────────────────────────────────────────────────────────────
function addToTeam(player) {
  if (selectedSlot !== null) {
    team[selectedSlot] = player;
    showToast(`${player.Name} → ${FORMATIONS[currentFormation][selectedSlot].pos}`);
    selectedSlot = null;
    afterTeamChange();
    return;
  }

  // Auto-assign priority:
  //   1. Exact position match (e.g. CM → CM slot)
  //   2. Player's alternative positions match a slot (e.g. RW alt → RW slot)
  //   3. Same position group (e.g. CM → any MID slot)
  //   4. Any empty slot
  const formation = FORMATIONS[currentFormation];
  const altPositions = Array.isArray(player['Alternative positions']) ? player['Alternative positions'] : [];
  const group = posGroup(player.Position);
  let target = -1;

  // Pass 1: exact match
  for (let i = 0; i < 11; i++) {
    if (!team[i] && formation[i].pos === player.Position) { target = i; break; }
  }
  // Pass 2: alternative positions exact match
  if (target === -1) {
    for (let i = 0; i < 11; i++) {
      if (!team[i] && altPositions.includes(formation[i].pos)) { target = i; break; }
    }
  }
  // Pass 3: same group
  if (target === -1) {
    for (let i = 0; i < 11; i++) {
      if (!team[i] && posGroup(formation[i].pos) === group) { target = i; break; }
    }
  }
  // Pass 4: any empty slot
  if (target === -1) {
    for (let i = 0; i < 11; i++) { if (!team[i]) { target = i; break; } }
  }
  if (target === -1) { showToast('Team is full! Remove a player first.', 'error'); return; }

  team[target] = player;
  showToast(`${player.Name} → ${formation[target].pos}`);
  afterTeamChange();
}

function removeFromTeam(idx) {
  if (team[idx]) {
    showToast(`${team[idx].Name} removed`);
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
// SLOT HINT
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
    hint.textContent = `📍 Slot selected: ${pos} — click a player to assign`;
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

  const avg = (key) => n
    ? Math.round(players.reduce((s, p) => s + (parseInt(p[key]) || 0), 0) / n)
    : '—';

  document.getElementById('statRating').textContent     = avg('OVR');
  document.getElementById('statPace').textContent       = avg('PAC');
  document.getElementById('statShooting').textContent   = avg('SHO');
  document.getElementById('statPassing').textContent    = avg('PAS');
  document.getElementById('statDribbling').textContent  = avg('DRI');
  document.getElementById('statDefending').textContent  = avg('DEF');
  document.getElementById('statPhysicality').textContent = avg('PHY');
}

// ────────────────────────────────────────────────────────────────
// REFRESH IN-TEAM BADGES ON RESULT CARDS
// ────────────────────────────────────────────────────────────────
function refreshCardStates() {
  const inTeamIds = new Set(team.filter(Boolean).map(p => p.ID));

  document.querySelectorAll('.result-card').forEach(card => {
    const alreadyIn = inTeamIds.has(card.dataset.playerId);
    const addBtn = card.querySelector('.rc-add-btn');

    if (alreadyIn) {
      if (!card.querySelector('.result-in-team-badge')) {
        const b = document.createElement('div');
        b.className = 'result-in-team-badge';
        b.textContent = '✓ In Team';
        card.prepend(b);
      }
      if (addBtn) { addBtn.classList.add('added'); addBtn.textContent = '✓'; }
    } else {
      card.querySelector('.result-in-team-badge')?.remove();
      if (addBtn) { addBtn.classList.remove('added'); addBtn.textContent = '+'; }
    }
  });
}

// ────────────────────────────────────────────────────────────────
// SEARCH HANDLERS
// ────────────────────────────────────────────────────────────────
async function doNameSearch() {
  const name = document.getElementById('searchInput').value.trim();
  if (!name) { setStatus('⚠️ Enter a player name'); return; }
  if (isSearching) return;
  isSearching = true;

  showLoading();
  try {
    const player = await fetchByName(name);
    renderSinglePlayer(player);
  } catch (err) {
    showError(err.message);
  } finally {
    isSearching = false;
  }
}

async function doTeamSearch() {
  const teamName = document.getElementById('teamInput').value.trim();
  if (!teamName) { setStatus('⚠️ Enter a team name'); return; }
  if (isSearching) return;
  isSearching = true;

  showLoading();
  try {
    const players = await fetchByTeam(teamName);
    if (!Array.isArray(players) || !players.length) throw new Error('No players found for that team');
    renderPlayerList(players);
  } catch (err) {
    showError(err.message);
  } finally {
    isSearching = false;
  }
}

async function doRankSearch() {
  const from = Math.max(1, parseInt(document.getElementById('rankFrom').value) || 1);
  const to   = Math.min(500, parseInt(document.getElementById('rankTo').value)  || 20);
  if (from > to) { setStatus('⚠️ "From" rank must be ≤ "To" rank'); return; }
  if (isSearching) return;
  isSearching = true;

  const count = to - from + 1;
  showLoading(`Loading ${count} player${count !== 1 ? 's' : ''}…`);
  try {
    const ranks   = Array.from({ length: count }, (_, i) => from + i);
    const results = await Promise.all(ranks.map(r => fetchByRank(r).catch(() => null)));
    const players = results.filter(Boolean);
    if (!players.length) throw new Error('No players found in that rank range');
    renderPlayerList(players);
  } catch (err) {
    showError(err.message);
  } finally {
    isSearching = false;
  }
}

// ────────────────────────────────────────────────────────────────
// RENDER RESULTS
// ────────────────────────────────────────────────────────────────
function renderSinglePlayer(player) {
  const resultsEl = document.getElementById('searchResults');
  setStatus('1 player found');
  resultsEl.innerHTML = '';
  const inTeam = team.filter(Boolean).some(p => p.ID === player.ID);
  resultsEl.appendChild(buildResultCard(player, inTeam));
}

function renderPlayerList(players) {
  const resultsEl = document.getElementById('searchResults');
  const inTeamIds = new Set(team.filter(Boolean).map(p => p.ID));
  setStatus(`${players.length} player${players.length !== 1 ? 's' : ''} found`);
  resultsEl.innerHTML = '';
  players.forEach(p => resultsEl.appendChild(buildResultCard(p, inTeamIds.has(p.ID))));
}

// ────────────────────────────────────────────────────────────────
// UI HELPERS
// ────────────────────────────────────────────────────────────────
function showLoading(msg = 'Searching…') {
  document.getElementById('searchResults').innerHTML =
    `<div class="empty-state"><div class="spinner"></div><p>${msg}</p></div>`;
  setStatus('');
}

function showError(msg) {
  document.getElementById('searchResults').innerHTML =
    `<div class="empty-state"><div class="empty-icon">⚠️</div><p style="color:#e06060">${esc(msg)}</p></div>`;
  setStatus('');
}

function setStatus(msg) {
  document.getElementById('searchStatus').textContent = msg;
}

function showToast(message, type = 'success') {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = `toast${type === 'error' ? ' error' : ''}`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ────────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderPitch();
  updateTeamStats();

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      searchType = btn.dataset.type;

      document.getElementById('paneByName').classList.toggle('hidden', searchType !== 'name');
      document.getElementById('paneByTeam').classList.toggle('hidden', searchType !== 'team');
      document.getElementById('paneByRank').classList.toggle('hidden', searchType !== 'rank');
    });
  });

  // Search triggers
  document.getElementById('searchBtn').addEventListener('click', doNameSearch);
  document.getElementById('searchInput').addEventListener('keydown', e => e.key === 'Enter' && doNameSearch());

  document.getElementById('teamSearchBtn').addEventListener('click', doTeamSearch);
  document.getElementById('teamInput').addEventListener('keydown', e => e.key === 'Enter' && doTeamSearch());

  document.getElementById('rankSearchBtn').addEventListener('click', doRankSearch);

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
});
