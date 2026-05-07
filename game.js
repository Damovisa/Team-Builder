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

let packs = [];           // Array of 5 arrays, each with up to 8 player objects
let packOpened = [];       // Boolean array — which packs have been opened
let currentPackIdx = 0;   // Currently viewed pack index
let playerPackMap = {};   // player.id → pack index (for returning players to packs)

// ────────────────────────────────────────────────────────────────
// INIT GAME
// ────────────────────────────────────────────────────────────────
async function initGame() {
  const panel = document.getElementById('gamePanel');
  panel.innerHTML = `
    <div class="game-loading">
      <div class="spinner"></div>
      <p>Fetching your packs…</p>
    </div>`;

  try {
    // Fetch 40 random players (one at a time from /random endpoint)
    const allPlayers = [];
    const fetches = [];
    for (let i = 0; i < PACK_COUNT * CARDS_PER_PACK; i++) {
      fetches.push(fetchRandomPlayer());
    }
    const results = await Promise.all(fetches);
    for (const result of results) {
      // /random returns a single player object (or array with one)
      const player = Array.isArray(result) ? result[0] : result;
      if (player) allPlayers.push(player);
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
    <div class="pack-content" id="packContent"></div>
    <div class="pack-nav" id="packNav"></div>`;

  renderPackSelector();
  renderCurrentPack();
  renderGameStatus();
}

function renderPackSelector() {
  const selector = document.getElementById('packSelector');
  selector.innerHTML = '';

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
}

function renderCurrentPack() {
  const content = document.getElementById('packContent');
  if (!content) return;
  const nav = document.getElementById('packNav');

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
      renderCurrentPack();
    });
    nav.innerHTML = '';
  } else {
    // Show cards in this pack
    const packPlayers = packs[currentPackIdx];
    const inTeamIds = new Set(team.filter(Boolean).map(p => p.id));
    content.innerHTML = '';

    if (packPlayers.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✨</div>
          <p>All cards from this pack have been used!</p>
        </div>`;
    } else {
      const list = document.createElement('div');
      list.className = 'pack-card-list';
      packPlayers.forEach(player => {
        const inTeam = inTeamIds.has(player.id);
        const card = buildResultCard(player, inTeam, (p) => gameAddToTeam(p));
        list.appendChild(card);
      });
      content.appendChild(list);
    }

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
