/* ================================================================
   FC26 Team Builder – app.js (shared core)
   API: https://api.msmc.cc/api/eafc  (no auth required)
   ================================================================ */

'use strict';

// ────────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.msmc.cc/api/eafc';

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

const fetchByName      = (name) => apiFetch(`/players?name=${encodeURIComponent(name)}&game=fc26`);
const fetchByTeam      = (team) => apiFetch(`/players?team=${encodeURIComponent(team)}&game=fc26`);
const fetchByRankRange = (from, to) => {
  let qs = `game=fc26`;
  if (from > 1) qs += `&rank%3E${from - 1}`;
  qs += `&rank%3C${to + 1}`;
  return apiFetch(`/players?${qs}`);
};
const fetchRandomPlayer = () => apiFetch(`/random?game=fc26`);

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
const team = new Array(11).fill(null);
let currentFormation = '4-3-3';
let selectedSlot     = null;
let gameMode         = null; // 'free' or 'game'

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
// RENDER: RESULT CARD (shared between free-build and game)
// ────────────────────────────────────────────────────────────────
function buildResultCard(player, inTeam = false, onClick = null) {
  const card = document.createElement('div');
  card.className = `result-card${inTeam ? ' in-team' : ''}`;
  card.dataset.playerId = player.id;

  const STAT_LABELS = { pac:'Pace', sho:'Shooting', pas:'Passing', dri:'Dribbling', def:'Defense', phy:'Physicality' };
  const stats = ['pac','sho','pas','dri','def','phy']
    .map(k => `<div class="rs-stat"><span class="rs-val">${esc(player[k] ?? '—')}</span><span class="rs-lbl">${STAT_LABELS[k]}</span></div>`)
    .join('');

  card.innerHTML = `
    ${inTeam ? '<div class="result-in-team-badge">✓ In Team</div>' : ''}
    <div class="result-card-img-wrap">
      <img class="result-card-img" src="${esc(player.card)}" alt="${esc(player.name)} card"
           onerror="this.src='';this.closest('.result-card-img-wrap').innerHTML='<div class=card-img-fallback>${esc(player.ovr)}</div>'">
    </div>
    <div class="result-card-info">
      <div class="rc-name" title="${esc(player.name)}">${esc(player.name)}</div>
      <div class="rc-meta">${esc(player.team)} · ${esc(player.league)}</div>
      <div class="rc-meta">${esc(player.nation)} · Age ${esc(player.age)}</div>
      <div class="rc-stats">${stats}</div>
    </div>
    <button class="rc-add-btn${inTeam ? ' added' : ''}" title="${inTeam ? 'Already in team' : 'Add to team'}">
      ${inTeam ? '✓' : '+'}
    </button>`;

  card._player = player;

  if (!inTeam) {
    const addFn = (e) => {
      e.stopPropagation();
      if (onClick) onClick(player);
      else addToTeam(player);
    };
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
          <img class="slot-card-img" src="${esc(player.card)}" alt="${esc(player.name)}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="slot-card-fallback" style="display:none">${esc(player.ovr)}</div>
          <button class="slot-remove-btn" data-idx="${idx}" aria-label="Remove ${esc(player.name)}">✕</button>
        </div>
        <div class="slot-name">${esc(shortName(player.name))}</div>
        <div class="slot-pos-label">${esc(slotDef.pos)}</div>`;
    } else {
      slotEl.innerHTML = `
        <div class="slot-empty-ring">
          <span class="slot-pos-empty">${esc(slotDef.pos)}</span>
        </div>
        <div class="slot-label-empty">Empty</div>`;
    }

    // Click: remove, select, or show detail
    slotEl.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.slot-remove-btn');
      if (removeBtn) {
        e.stopPropagation();
        removeFromTeam(parseInt(removeBtn.dataset.idx));
        showPlayerDetail(null);
        return;
      }
      if (isFilled) showPlayerDetail(player);
      else showPlayerDetail(null);
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
    const displaced = team[selectedSlot];
    team[selectedSlot] = player;
    showToast(`${player.name} → ${FORMATIONS[currentFormation][selectedSlot].pos}`);
    selectedSlot = null;
    afterTeamChange();
    // In game mode, return displaced player to their pack
    if (gameMode === 'game' && displaced) {
      returnToPack(displaced);
    }
    return;
  }

  const formation = FORMATIONS[currentFormation];
  const altPositions = Array.isArray(player['alternative positions']) ? player['alternative positions'] : [];
  const group = posGroup(player.position);
  let target = -1;

  for (let i = 0; i < 11; i++) {
    if (!team[i] && formation[i].pos === player.position) { target = i; break; }
  }
  if (target === -1) {
    for (let i = 0; i < 11; i++) {
      if (!team[i] && altPositions.includes(formation[i].pos)) { target = i; break; }
    }
  }
  if (target === -1) {
    for (let i = 0; i < 11; i++) {
      if (!team[i] && posGroup(formation[i].pos) === group) { target = i; break; }
    }
  }
  if (target === -1) {
    for (let i = 0; i < 11; i++) { if (!team[i]) { target = i; break; } }
  }
  if (target === -1) { showToast('Team is full! Remove a player first.', 'error'); return; }

  team[target] = player;
  showToast(`${player.name} → ${formation[target].pos}`);
  afterTeamChange();
}

function removeFromTeam(idx) {
  if (team[idx]) {
    const player = team[idx];
    showToast(`${player.name} removed`);
    team[idx] = null;
    // In game mode, return to pack
    if (gameMode === 'game') {
      returnToPack(player);
    }
    afterTeamChange();
  }
}

// Hook for game.js — overridden when game mode starts
let returnToPack = () => {};

function toggleSelectSlot(idx) {
  selectedSlot = (selectedSlot === idx) ? null : idx;
  renderPitch();
  renderSlotHint();
}

function afterTeamChange() {
  renderPitch();
  updateTeamStats();
  if (typeof refreshCardStates === 'function') refreshCardStates();
  renderSlotHint();
  // Show save button only when team is full
  const saveBtn = document.getElementById('saveTeamBtn');
  if (saveBtn) {
    saveBtn.classList.toggle('hidden', team.filter(Boolean).length < 11);
  }
  // Notify game mode of team changes
  if (gameMode === 'game' && typeof onGameTeamChange === 'function') onGameTeamChange();
}

// Hook for game.js
let onGameTeamChange = null;

// ────────────────────────────────────────────────────────────────
// SLOT HINT
// ────────────────────────────────────────────────────────────────
function renderSlotHint() {
  const anchor = document.getElementById('slotHintAnchor') || document.getElementById('slotHintAnchorGame');
  if (!anchor) return;
  let hint = document.getElementById('slotHint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'slotHint';
    hint.className = 'slot-hint';
    anchor.after(hint);
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
// PLAYER DETAIL PANEL (right of pitch)
// ────────────────────────────────────────────────────────────────
function showPlayerDetail(player) {
  const panel = document.getElementById('playerDetail');
  if (!panel) return;
  if (!player) {
    panel.innerHTML = '<div class="player-detail-empty">Click a player on the pitch to see details</div>';
    return;
  }
  const altPos = Array.isArray(player['alternative positions']) && player['alternative positions'].length
    ? player['alternative positions'].join(', ')
    : null;
  const isGK = player.position === 'GK';

  panel.innerHTML = `
    <div class="pd-card">
      <img class="pd-card-img" src="${esc(player.card)}" alt="${esc(player.name)}"
           onerror="this.style.display='none'">
    </div>
    <div class="pd-name">${esc(player.name)}</div>
    <div class="pd-meta">
      <div class="pd-row"><span class="pd-label">Club</span> ${esc(player.team)}</div>
      <div class="pd-row"><span class="pd-label">Nation</span> ${esc(player.nation)}</div>
      <div class="pd-row"><span class="pd-label">Age</span> ${esc(player.age)}</div>
      <div class="pd-row"><span class="pd-label">Position</span> ${esc(player.position)}${altPos ? ` <span class="pd-alt">(${esc(altPos)})</span>` : ''}</div>
      <div class="pd-row"><span class="pd-label">Foot</span> ${esc(player['preferred foot'])} ⭐${esc(player['weak foot'])}</div>
      <div class="pd-row"><span class="pd-label">Skills</span> ⭐${esc(player['skill moves'])}</div>
    </div>
    <div class="pd-stats">
      ${isGK ? `
        <div class="pd-stat"><span class="pd-stat-label">DIV</span><span class="pd-stat-val">${esc(player.diving)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">HAN</span><span class="pd-stat-val">${esc(player.handling)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">KIC</span><span class="pd-stat-val">${esc(player.kicking)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">REF</span><span class="pd-stat-val">${esc(player.reflexes)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">SPD</span><span class="pd-stat-val">${esc(player.pac)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">POS</span><span class="pd-stat-val">${esc(player.def)}</span></div>
      ` : `
        <div class="pd-stat"><span class="pd-stat-label">PAC</span><span class="pd-stat-val">${esc(player.pac)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">SHO</span><span class="pd-stat-val">${esc(player.sho)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">PAS</span><span class="pd-stat-val">${esc(player.pas)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">DRI</span><span class="pd-stat-val">${esc(player.dri)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">DEF</span><span class="pd-stat-val">${esc(player.def)}</span></div>
        <div class="pd-stat"><span class="pd-stat-label">PHY</span><span class="pd-stat-val">${esc(player.phy)}</span></div>
      `}
    </div>
    ${player['play style'] && player['play style'].length ? `
    <div class="pd-playstyles">
      <span class="pd-label">Play Styles</span>
      <div class="pd-ps-list">${player['play style'].map(ps => `<span class="pd-ps">${esc(ps)}</span>`).join('')}</div>
    </div>` : ''}
  `;
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

  document.getElementById('statRating').textContent     = avg('ovr');
  document.getElementById('statPace').textContent       = avg('pac');
  document.getElementById('statShooting').textContent   = avg('sho');
  document.getElementById('statPassing').textContent    = avg('pas');
  document.getElementById('statDribbling').textContent  = avg('dri');
  document.getElementById('statDefending').textContent  = avg('def');
  document.getElementById('statPhysicality').textContent = avg('phy');
}

// ────────────────────────────────────────────────────────────────
// UI HELPERS
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
// SAVED TEAMS (localStorage)
// ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'fc26_saved_teams';

function loadSavedTeams() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function storeSavedTeams(teams) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
}

function saveCurrentTeam() {
  const filled = team.filter(Boolean).length;
  if (filled === 0) { showToast('No players to save', 'error'); return; }

  const name = prompt('Team name:');
  if (!name || !name.trim()) return;

  const saved = loadSavedTeams();
  saved.push({
    name: name.trim(),
    formation: currentFormation,
    team: team.map(p => p || null),
    savedAt: new Date().toISOString(),
  });
  storeSavedTeams(saved);
  showToast(`"${name.trim()}" saved!`);
}

function deleteSavedTeam(index) {
  const saved = loadSavedTeams();
  if (index < 0 || index >= saved.length) return;
  saved.splice(index, 1);
  storeSavedTeams(saved);
  renderSavedTeamsOnStart();
}

function loadSavedTeamAndChallenge(index) {
  const saved = loadSavedTeams();
  const entry = saved[index];
  if (!entry) return;

  // Restore team state
  currentFormation = entry.formation || '4-3-3';
  document.getElementById('formationSelect').value = currentFormation;
  for (let i = 0; i < 11; i++) team[i] = entry.team[i] || null;

  // Enter game mode and go straight to challenger
  gameMode = 'game';
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('appMain').classList.remove('hidden');
  document.getElementById('searchPanel').classList.add('hidden');
  document.getElementById('gamePanel').classList.add('hidden');
  document.getElementById('clearTeamBtn').classList.add('hidden');
  document.getElementById('saveTeamBtn').classList.add('hidden');

  afterTeamChange();
  initChallenger();
}

function renderSavedTeamsOnStart() {
  const section = document.getElementById('savedTeamsSection');
  const list = document.getElementById('savedTeamsList');
  const saved = loadSavedTeams();

  if (saved.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  list.innerHTML = '';

  saved.forEach((entry, idx) => {
    const filled = (entry.team || []).filter(Boolean).length;
    const avgOvr = filled > 0
      ? Math.round(entry.team.filter(Boolean).reduce((s, p) => s + (parseInt(p.ovr) || 0), 0) / filled)
      : '—';
    const date = new Date(entry.savedAt);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const card = document.createElement('div');
    card.className = 'saved-team-card';
    card.innerHTML = `
      <div class="saved-team-info">
        <div class="saved-team-name">${esc(entry.name)}</div>
        <div class="saved-team-meta">${entry.formation} · ${filled}/11 · OVR ${avgOvr} · ${dateStr}</div>
      </div>
      <div class="saved-team-actions">
        <button class="saved-team-play" title="Challenge with this team">⚔️ Challenge</button>
        <button class="saved-team-delete" title="Delete saved team">🗑️</button>
      </div>`;

    card.querySelector('.saved-team-play').addEventListener('click', () => loadSavedTeamAndChallenge(idx));
    card.querySelector('.saved-team-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${entry.name}"?`)) deleteSavedTeam(idx);
    });
    list.appendChild(card);
  });
}

// ────────────────────────────────────────────────────────────────
// START SCREEN & MODE SELECTION
// ────────────────────────────────────────────────────────────────
function startMode(mode) {
  gameMode = mode;
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('appMain').classList.remove('hidden');

  if (mode === 'free') {
    document.getElementById('searchPanel').classList.remove('hidden');
    document.getElementById('gamePanel').classList.add('hidden');
    document.getElementById('clearTeamBtn').classList.remove('hidden');
    initFreeBuild();
  } else {
    document.getElementById('searchPanel').classList.add('hidden');
    document.getElementById('gamePanel').classList.remove('hidden');
    document.getElementById('clearTeamBtn').classList.add('hidden');
    initGame();
  }
}

// ────────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderPitch();
  updateTeamStats();

  // Start screen buttons
  document.getElementById('btnPlayGame').addEventListener('click', () => startMode('game'));
  document.getElementById('btnFreeBuild').addEventListener('click', () => startMode('free'));

  // Render saved teams on start screen
  renderSavedTeamsOnStart();

  // Save team button
  document.getElementById('saveTeamBtn').addEventListener('click', saveCurrentTeam);

  // Formation
  document.getElementById('formationSelect').addEventListener('change', e => {
    currentFormation = e.target.value;
    selectedSlot = null;
    renderPitch();
    renderSlotHint();
  });

  // Click on pitch background → deselect slot & clear detail
  document.getElementById('pitch').addEventListener('click', (e) => {
    if (!e.target.closest('.pitch-slot')) {
      selectedSlot = null;
      showPlayerDetail(null);
      renderPitch();
      renderSlotHint();
    }
  });

  // Clear team (free-build only)
  document.getElementById('clearTeamBtn').addEventListener('click', () => {
    if (!team.some(Boolean) || confirm('Clear all players from the team?')) {
      team.fill(null);
      selectedSlot = null;
      showPlayerDetail(null);
      afterTeamChange();
    }
  });
});
