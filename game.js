/* ================================================================
   FC26 Team Builder – game.js
   Pack-opening game mode
   ================================================================ */

'use strict';

// ────────────────────────────────────────────────────────────────
// GAME STATE
// ────────────────────────────────────────────────────────────────
const PACK_COUNT = 5;
const CARDS_PER_PACK = 8;
const ALL_PACKS_IDX = -1; // sentinel for "All" view

let packs = [];           // Array of 5 arrays, each with up to 8 player objects
let packOpened = [];       // Boolean array — which packs have been opened
let currentPackIdx = 0;   // Currently viewed pack index (or ALL_PACKS_IDX)
let playerPackMap = {};   // player.id → pack index (for returning players to packs)
let packPosFilter = '';   // Current position filter for pack view

// ────────────────────────────────────────────────────────────────
// INIT GAME
// ────────────────────────────────────────────────────────────────
async function initGame() {
  const panel = document.getElementById('gamePanel');
  panel.innerHTML = `
    <div class="game-loading">
      <div class="spinner"></div>
      <p>Fetching your packs…</p>
      <div class="pack-progress">
        <div class="pack-progress-bar"><div class="pack-progress-fill" id="packProgressFill"></div></div>
        <span class="pack-progress-text" id="packProgressText">0 / ${PACK_COUNT * CARDS_PER_PACK} cards</span>
      </div>
    </div>`;

  try {
    const allPlayers = [];
    const total = PACK_COUNT * CARDS_PER_PACK;
    const progressFill = document.getElementById('packProgressFill');
    const progressText = document.getElementById('packProgressText');

    // Fetch in small batches to show progress without overwhelming the API
    for (let i = 0; i < total; i++) {
      const result = await fetchRandomPlayer();
      const player = Array.isArray(result) ? result[0] : result;
      if (player) allPlayers.push(player);
      const count = allPlayers.length;
      progressFill.style.width = `${(count / total) * 100}%`;
      progressText.textContent = `${count} / ${total} cards`;
    }

    // Split into packs
    packs = [];
    playerPackMap = {};
    for (let i = 0; i < PACK_COUNT; i++) {
      const packPlayers = allPlayers.slice(i * CARDS_PER_PACK, (i + 1) * CARDS_PER_PACK);
      packs.push(packPlayers);
      packPlayers.forEach(p => { playerPackMap[p.id] = i; });
    }

    packOpened = new Array(PACK_COUNT).fill(false);
    currentPackIdx = 0;

    // Wire up the returnToPack hook
    returnToPack = (player) => {
      // Return displaced player to the currently viewed pack so user can reassign
      if (!packs[currentPackIdx].find(p => p.id === player.id)) {
        packs[currentPackIdx].push(player);
        playerPackMap[player.id] = currentPackIdx;
      }
      renderCurrentPack();
    };

    // Wire up the team-change hook
    onGameTeamChange = () => {
      renderCurrentPack();
      renderGameStatus();
    };

    renderGameUI();
  } catch (err) {
    panel.innerHTML = `
      <div class="game-loading">
        <div class="empty-icon">⚠️</div>
        <p style="color:#e06060">Failed to load packs: ${esc(err.message)}</p>
        <button class="btn-primary" onclick="initGame()">Retry</button>
      </div>`;
  }
}

// ────────────────────────────────────────────────────────────────
// RENDER GAME UI
// ────────────────────────────────────────────────────────────────
function renderGameUI() {
  const panel = document.getElementById('gamePanel');
  panel.innerHTML = `
    <div class="game-header">
      <h2>Card Packs</h2>
      <div class="game-status" id="gameStatus"></div>
    </div>
    <div class="pack-selector" id="packSelector"></div>
    <div class="pack-filter-bar" id="packFilterBar">
      <label class="pos-filter-label" for="packPosFilter">Position:</label>
      <select id="packPosFilter" class="pos-filter-select">
        <option value="">All</option>
        <optgroup label="Groups">
          <option value="GRP_FWD">Forwards</option>
          <option value="GRP_MID">Midfielders</option>
          <option value="GRP_DEF">Defenders</option>
          <option value="GRP_GK">Goalkeepers</option>
        </optgroup>
        <optgroup label="Forwards">
          <option value="LW">LW</option>
          <option value="RW">RW</option>
          <option value="CF">CF</option>
          <option value="ST">ST</option>
        </optgroup>
        <optgroup label="Midfielders">
          <option value="CDM">CDM</option>
          <option value="CM">CM</option>
          <option value="CAM">CAM</option>
          <option value="LM">LM</option>
          <option value="RM">RM</option>
        </optgroup>
        <optgroup label="Defenders">
          <option value="CB">CB</option>
          <option value="LB">LB</option>
          <option value="RB">RB</option>
          <option value="LWB">LWB</option>
          <option value="RWB">RWB</option>
        </optgroup>
        <optgroup label="Goalkeeper">
          <option value="GK">GK</option>
        </optgroup>
      </select>
    </div>
    <div class="pack-content" id="packContent"></div>
    <div class="pack-nav" id="packNav"></div>`;

  document.getElementById('packPosFilter').addEventListener('change', (e) => {
    packPosFilter = e.target.value;
    renderCurrentPack();
  });

  renderPackSelector();
  renderCurrentPack();
  renderGameStatus();
}

function renderPackSelector() {
  const selector = document.getElementById('packSelector');
  selector.innerHTML = '';
  const allOpened = packOpened.every(Boolean);

  for (let i = 0; i < PACK_COUNT; i++) {
    const btn = document.createElement('button');
    btn.className = `pack-btn${i === currentPackIdx ? ' active' : ''}${packOpened[i] ? ' opened' : ''}`;
    btn.textContent = packOpened[i] ? `Pack ${i + 1}` : `📦 ${i + 1}`;
    btn.addEventListener('click', () => {
      currentPackIdx = i;
      renderPackSelector();
      renderCurrentPack();
    });
    selector.appendChild(btn);
  }

  // "All" button — only after all packs are opened
  if (allOpened) {
    const allBtn = document.createElement('button');
    allBtn.className = `pack-btn pack-btn-all${currentPackIdx === ALL_PACKS_IDX ? ' active' : ''}`;
    allBtn.textContent = '⭐ All';
    allBtn.addEventListener('click', () => {
      currentPackIdx = ALL_PACKS_IDX;
      renderPackSelector();
      renderCurrentPack();
    });
    selector.appendChild(allBtn);
  }
}

function renderCurrentPack(animate = false) {
  const content = document.getElementById('packContent');
  if (!content) return;
  const nav = document.getElementById('packNav');

  // "All" view — show cards from all packs combined
  if (currentPackIdx === ALL_PACKS_IDX) {
    const allPlayers = packs.flat();
    renderPackCards(allPlayers, content);
    nav.innerHTML = '';
    return;
  }

  if (!packOpened[currentPackIdx]) {
    // Show "Open Pack" button
    content.innerHTML = `
      <div class="pack-unopened">
        <div class="pack-icon">📦</div>
        <p>Pack ${currentPackIdx + 1} of ${PACK_COUNT}</p>
        <p class="pack-cards-hint">${CARDS_PER_PACK} cards inside</p>
        <button class="btn-primary pack-open-btn" id="openPackBtn">Open Pack</button>
      </div>`;
    document.getElementById('openPackBtn').addEventListener('click', () => {
      packOpened[currentPackIdx] = true;
      renderPackSelector();
      // Animate cards appearing one by one
      renderCurrentPack(true);
      renderGameStatus();
    });
    nav.innerHTML = '';
  } else {
    const packPlayers = packs[currentPackIdx];
    renderPackCards(packPlayers, content, animate);

    // Navigation
    nav.innerHTML = '';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn-nav';
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = currentPackIdx === 0;
    prevBtn.addEventListener('click', () => {
      currentPackIdx--;
      renderPackSelector();
      renderCurrentPack();
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-nav';
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = currentPackIdx === PACK_COUNT - 1;
    nextBtn.addEventListener('click', () => {
      currentPackIdx++;
      renderPackSelector();
      renderCurrentPack();
    });

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
  }
}

// Track whether we're animating a pack open (to avoid re-render interrupts)
let packAnimating = false;

// Filter and render a list of players into the pack content area
function renderPackCards(players, content, animate = false) {
  const filtered = filterByPosition(players, packPosFilter);
  const inTeamIds = new Set(team.filter(Boolean).map(p => p.id));
  content.innerHTML = '';

  if (filtered.length === 0) {
    const msg = packPosFilter
      ? 'No players match this position filter'
      : 'All cards from this pack have been used!';
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✨</div>
        <p>${msg}</p>
      </div>`;
  } else if (animate) {
    // Preload all images, then animate reveal
    content.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Revealing cards…</p></div>`;
    const imageUrls = filtered.map(p => p.card).filter(Boolean);
    preloadImages(imageUrls).then(() => {
      content.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'pack-card-grid';
      filtered.forEach((player, i) => {
        const inTeam = inTeamIds.has(player.id);
        const card = buildPackCard(player, inTeam, i);
        card.style.animationDelay = `${i * 1000}ms`;
        card.classList.add('pack-card-animate');
        grid.appendChild(card);
      });
      content.appendChild(grid);
    });
  } else {
    const grid = document.createElement('div');
    grid.className = 'pack-card-grid';
    filtered.forEach((player, i) => {
      const inTeam = inTeamIds.has(player.id);
      const card = buildPackCard(player, inTeam, i);
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }
}

// Preload an array of image URLs, resolves when all are loaded (or failed)
function preloadImages(urls) {
  return Promise.all(urls.map(url => new Promise(resolve => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = url;
  })));
}

// Build a compact card for the pack view — image only with hover tooltip
function buildPackCard(player, inTeam, colIdx = 0) {
  const card = document.createElement('div');
  // Left column → tooltip on right; right column → tooltip on left
  const tooltipSide = (colIdx % 2 === 0) ? 'tooltip-right' : 'tooltip-left';
  card.className = `pack-card ${tooltipSide}${inTeam ? ' pack-card-in-team' : ''}`;
  card.dataset.playerId = player.id;

  const altPos = Array.isArray(player['alternative positions']) && player['alternative positions'].length
    ? player['alternative positions'].join(', ')
    : null;

  card.innerHTML = `
    ${inTeam ? '<div class="pack-card-badge">✓</div>' : ''}
    <img class="pack-card-img" src="${esc(player.card)}" alt="${esc(player.name)}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="pack-card-fallback" style="display:none">${esc(player.ovr)}</div>
    <div class="pack-card-tooltip">
      <div class="tt-name">${esc(player.name)}</div>
      <div class="tt-row"><span class="tt-label">Club</span> ${esc(player.team)}</div>
      <div class="tt-row"><span class="tt-label">Nation</span> ${esc(player.nation)}</div>
      <div class="tt-row"><span class="tt-label">Age</span> ${esc(player.age)}</div>
      <div class="tt-row"><span class="tt-label">Pos</span> ${esc(player.position)}${altPos ? ` <span class="tt-alt">(${esc(altPos)})</span>` : ''}</div>
    </div>`;

  if (!inTeam) {
    card.addEventListener('click', () => gameAddToTeam(player));
    card.style.cursor = 'pointer';
  }
  return card;
}

// Position filter logic — supports individual positions and group filters
function filterByPosition(players, filter) {
  if (!filter) return players;

  // Group filters (GRP_GK, GRP_DEF, GRP_MID, GRP_FWD)
  if (filter.startsWith('GRP_')) {
    const group = filter.slice(4); // 'GK', 'DEF', 'MID', 'FWD'
    return players.filter(p => {
      const alts = Array.isArray(p['alternative positions']) ? p['alternative positions'] : [];
      const allPos = [p.position, ...alts];
      return allPos.some(pos => posGroup(pos) === group);
    });
  }

  // Individual position filter
  return players.filter(p => {
    const alts = Array.isArray(p['alternative positions']) ? p['alternative positions'] : [];
    return p.position === filter || alts.includes(filter);
  });
}

function renderGameStatus() {
  const statusEl = document.getElementById('gameStatus');
  if (!statusEl) return;

  const filled = team.filter(Boolean).length;
  const allOpened = packOpened.every(Boolean);

  if (filled === 11 && allOpened) {
    statusEl.innerHTML = `
      <span class="status-complete">✓ Team Complete!</span>
      <button class="btn-primary" id="continueBtn">Continue →</button>`;
    document.getElementById('continueBtn').addEventListener('click', () => {
      showToast('Next phase coming soon!');
    });
  } else if (allOpened) {
    statusEl.innerHTML = `<span class="status-progress">${filled}/11 positions filled — revisit packs to fill your team</span>`;
  } else {
    statusEl.innerHTML = `<span class="status-progress">${filled}/11 · ${packOpened.filter(Boolean).length}/${PACK_COUNT} packs opened</span>`;
  }
}

// ────────────────────────────────────────────────────────────────
// GAME: ADD TO TEAM (with swap logic)
// ────────────────────────────────────────────────────────────────
function gameAddToTeam(player) {
  // Remove from pack
  const packIdx = playerPackMap[player.id];
  if (packIdx !== undefined) {
    packs[packIdx] = packs[packIdx].filter(p => p.id !== player.id);
  }

  // Use the shared addToTeam which handles slot assignment.
  // The returnToPack hook (set in initGame) handles displaced players automatically.
  addToTeam(player);
}
