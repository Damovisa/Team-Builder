/* ================================================================
   FC26 Team Builder – free-build.js
   Search panel logic for unrestricted team building mode
   ================================================================ */

'use strict';

let searchType  = 'name';
let isSearching = false;
let allResults  = [];

// Called by app.js when free-build mode is selected
function initFreeBuild() {
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

  // Position filter
  document.getElementById('posFilter').addEventListener('change', applyPosFilter);
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
    const players = await fetchByName(name);
    if (!Array.isArray(players) || !players.length) throw new Error('No players found');
    renderPlayerList(players);
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
  const from = Math.max(1,   parseInt(document.getElementById('rankFrom').value) || 1);
  const to   = Math.min(500, parseInt(document.getElementById('rankTo').value)   || 20);
  if (from > to) { setStatus('⚠️ "From" rank must be ≤ "To" rank'); return; }
  if (isSearching) return;
  isSearching = true;

  const count = to - from + 1;
  showLoading(`Loading ${count} player${count !== 1 ? 's' : ''}…`);
  try {
    const players = await fetchByRankRange(from, to);
    if (!Array.isArray(players) || !players.length) throw new Error('No players found in that rank range');
    players.sort((a, b) => parseInt(a.rank) - parseInt(b.rank));
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
function renderPlayerList(players) {
  allResults = players;
  applyPosFilter();
}

function applyPosFilter() {
  const pos = document.getElementById('posFilter').value;
  const filtered = pos
    ? allResults.filter(p => {
        const alts = Array.isArray(p['alternative positions']) ? p['alternative positions'] : [];
        return p.position === pos || alts.includes(pos);
      })
    : allResults;

  const resultsEl = document.getElementById('searchResults');
  const inTeamIds = new Set(team.filter(Boolean).map(p => p.id));
  resultsEl.innerHTML = '';

  if (!filtered.length) {
    resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No ${pos} players in these results</p></div>`;
  } else {
    filtered.forEach(p => resultsEl.appendChild(buildResultCard(p, inTeamIds.has(p.id))));
  }

  const total = allResults.length;
  const shown = filtered.length;
  setStatus(pos
    ? `${shown} of ${total} player${total !== 1 ? 's' : ''} · filtered by ${pos}`
    : `${total} player${total !== 1 ? 's' : ''} found`
  );

  document.getElementById('posFilterBar').classList.toggle('hidden', total === 0);
}

// Refresh in-team badges (called by afterTeamChange in app.js)
function refreshCardStates() {
  if (allResults.length) applyPosFilter();
}

// ────────────────────────────────────────────────────────────────
// UI HELPERS
// ────────────────────────────────────────────────────────────────
function showLoading(msg = 'Searching…') {
  allResults = [];
  document.getElementById('posFilterBar').classList.add('hidden');
  document.getElementById('posFilter').value = '';
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
