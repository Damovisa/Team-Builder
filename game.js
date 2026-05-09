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
let packTierFilter = '';  // Current tier filter: '', 'gold', 'silver', 'bronze'
let platinumPackIdx = -1; // Which pack is the platinum pack

// ── Challenger phase state ──
let challengerTeam = new Array(11).fill(null);

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
    // Total cards: 4 normal packs × 8 cards + 1 platinum pack × 8 cards = 40
    // Normal packs: 7 random + 1 from top 200 each = 28 random + 4 elite
    // Platinum pack: 8 from top 200
    // Elite cards needed: 4 (one per normal pack) + 8 (platinum) = 12
    const RANDOM_NEEDED = 4 * 7; // 28
    const ELITE_NEEDED = 4 + CARDS_PER_PACK; // 12
    const total = RANDOM_NEEDED + ELITE_NEEDED; // 40

    const progressFill = document.getElementById('packProgressFill');
    const progressText = document.getElementById('packProgressText');
    let fetched = 0;

    const updateProgress = () => {
      fetched++;
      progressFill.style.width = `${(fetched / total) * 100}%`;
      progressText.textContent = `${fetched} / ${total} cards`;
    };

    // Fetch top 200 players, then pick 12 random from them
    progressText.textContent = `0 / ${total} cards`;
    const top200 = await fetchByRankRange(1, 200);
    // Shuffle and pick ELITE_NEEDED unique elite players
    const shuffledElite = top200.sort(() => Math.random() - 0.5);
    const elitePicks = shuffledElite.slice(0, ELITE_NEEDED);
    for (let i = 0; i < elitePicks.length; i++) updateProgress();

    // Fetch 28 random players
    const randomPlayers = [];
    for (let i = 0; i < RANDOM_NEEDED; i++) {
      const result = await fetchRandomPlayer();
      const player = Array.isArray(result) ? result[0] : result;
      if (player) randomPlayers.push(player);
      updateProgress();
    }

    // Build packs — pick which one is platinum
    platinumPackIdx = Math.floor(Math.random() * PACK_COUNT);
    packs = [];
    playerPackMap = {};

    let randomIdx = 0;
    let eliteIdx = 0;
    for (let i = 0; i < PACK_COUNT; i++) {
      let packPlayers;
      if (i === platinumPackIdx) {
        // Platinum pack: 8 elite cards
        packPlayers = elitePicks.slice(eliteIdx, eliteIdx + CARDS_PER_PACK);
        eliteIdx += CARDS_PER_PACK;
      } else {
        // Normal pack: 7 random + 1 elite
        packPlayers = randomPlayers.slice(randomIdx, randomIdx + 7);
        randomIdx += 7;
        packPlayers.push(elitePicks[eliteIdx]);
        eliteIdx++;
        // Shuffle so elite card isn't always last
        packPlayers.sort(() => Math.random() - 0.5);
      }
      packs.push(packPlayers);
      packPlayers.forEach(p => { playerPackMap[p.id] = i; });
    }

    packOpened = new Array(PACK_COUNT).fill(false);
    currentPackIdx = 0;

    // Wire up the returnToPack hook
    returnToPack = (player) => {
      // Return to original pack, or current pack, avoiding the ALL sentinel
      let targetPack = playerPackMap[player.id];
      if (targetPack === undefined || targetPack < 0) {
        targetPack = currentPackIdx >= 0 ? currentPackIdx : 0;
      }
      if (!packs[targetPack].find(p => p.id === player.id)) {
        packs[targetPack].push(player);
        playerPackMap[player.id] = targetPack;
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
      <label class="pos-filter-label" for="packTierFilter">Tier:</label>
      <select id="packTierFilter" class="pos-filter-select">
        <option value="">All</option>
        <option value="gold">🥇 Gold (75+)</option>
        <option value="silver">🥈 Silver (65–74)</option>
        <option value="bronze">🥉 Bronze (&lt;65)</option>
      </select>
    </div>
    <div class="pack-content" id="packContent"></div>
    <div class="pack-nav" id="packNav"></div>`;

  document.getElementById('packPosFilter').addEventListener('change', (e) => {
    packPosFilter = e.target.value;
    renderCurrentPack();
  });

  document.getElementById('packTierFilter').addEventListener('change', (e) => {
    packTierFilter = e.target.value;
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
    const isPlatinum = i === platinumPackIdx;
    const btn = document.createElement('button');
    btn.className = `pack-btn${i === currentPackIdx ? ' active' : ''}${packOpened[i] ? ' opened' : ''}${isPlatinum ? ' pack-btn-platinum' : ''}`;
    btn.textContent = packOpened[i]
      ? (isPlatinum ? '💎 Platinum' : `Pack ${i + 1}`)
      : (isPlatinum ? '💎' : `📦 ${i + 1}`);
    btn.addEventListener('click', () => {
      currentPackIdx = i;
      renderPackSelector();
      renderCurrentPack();
    });
    selector.appendChild(btn);
  }

  // "Open All" button — visible when any packs are still unopened
  if (!allOpened) {
    const openAllBtn = document.createElement('button');
    openAllBtn.className = 'pack-btn pack-btn-open-all';
    openAllBtn.textContent = '📦 Open All';
    openAllBtn.addEventListener('click', () => {
      packOpened.fill(true);
      currentPackIdx = ALL_PACKS_IDX;
      renderPackSelector();
      renderCurrentPack();
      renderGameStatus();
    });
    selector.appendChild(openAllBtn);
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
    const isPlatinum = currentPackIdx === platinumPackIdx;
    content.innerHTML = `
      <div class="pack-unopened">
        <div class="pack-icon">${isPlatinum ? '💎' : '📦'}</div>
        <p>${isPlatinum ? 'Platinum Pack' : `Pack ${currentPackIdx + 1} of ${PACK_COUNT}`}</p>
        <p class="pack-cards-hint">${isPlatinum ? '8 elite cards inside' : `${CARDS_PER_PACK} cards inside`}</p>
        <button class="btn-primary pack-open-btn${isPlatinum ? ' pack-open-btn-platinum' : ''}" id="openPackBtn">Open Pack</button>
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
  const posFiltered = filterByPosition(players, packPosFilter);
  const filtered = filterByTier(posFiltered, packTierFilter);
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

// Tier filter: gold (75+), silver (65–74), bronze (<65)
function filterByTier(players, tier) {
  if (!tier) return players;
  return players.filter(p => {
    const ovr = parseInt(p.ovr) || 0;
    if (tier === 'gold')   return ovr >= 75;
    if (tier === 'silver') return ovr >= 65 && ovr <= 74;
    if (tier === 'bronze') return ovr < 65;
    return true;
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
      if (!isCurrentTeamSaved()) {
        if (!confirm('You haven\'t saved your team. Continue without saving?')) return;
      }
      initChallenger();
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

// ────────────────────────────────────────────────────────────────
// CHALLENGER PHASE
// ────────────────────────────────────────────────────────────────

async function initChallenger() {
  // Transition: hide game panel, go full width
  document.getElementById('gamePanel').classList.add('hidden');
  document.getElementById('appMain').classList.add('challenger-phase');

  // Disable team mutations: clear hook, block formation changes, hide controls
  returnToPack = () => {};
  onGameTeamChange = null;
  document.querySelector('.team-controls').classList.add('hidden');

  const teamPanel = document.querySelector('.team-panel');
  teamPanel.innerHTML = `
    <div class="challenger-loading">
      <div class="spinner"></div>
      <p>Finding your opponents…</p>
    </div>`;

  try {
    const pool = await fetchChallengerPool();
    challengerTeam = buildChallengerTeam(pool, currentFormation);
    renderChallengerPhase();
  } catch (err) {
    teamPanel.innerHTML = `
      <div class="challenger-loading">
        <div class="empty-icon">⚠️</div>
        <p style="color:#e06060">Failed to find opponents: ${esc(err.message)}</p>
        <button class="btn-primary" onclick="initChallenger()">Retry</button>
      </div>`;
  }
}

// Fetch a diverse pool of players in the OVR 65–80 range.
// Pulls from several spread-out rank windows for OVR variety.
async function fetchChallengerPool() {
  const windows = [];
  for (let i = 0; i < 4; i++) {
    const rankStart = 800 + Math.floor(Math.random() * 7200);
    windows.push(fetchByRankRange(rankStart, rankStart + 19));
  }
  const results = await Promise.all(windows);
  const pool = results.flat();
  if (pool.length >= 11) return pool;
  // Fallback: one more fetch
  const extra = await fetchByRankRange(2000, 2059);
  return [...pool, ...extra];
}

function buildChallengerTeam(pool, formation) {
  const slots = FORMATIONS[formation];
  const result = new Array(11).fill(null);
  const used = new Set();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Pass 1: exact position match
  for (let i = 0; i < 11; i++) {
    const slotPos = slots[i].pos;
    const player = shuffled.find(p => !used.has(p.id) && p.position === slotPos);
    if (player) { result[i] = player; used.add(player.id); }
  }

  // Pass 2: alternative position match
  for (let i = 0; i < 11; i++) {
    if (result[i]) continue;
    const slotPos = slots[i].pos;
    const player = shuffled.find(p => {
      if (used.has(p.id)) return false;
      const alts = Array.isArray(p['alternative positions']) ? p['alternative positions'] : [];
      return alts.includes(slotPos);
    });
    if (player) { result[i] = player; used.add(player.id); }
  }

  // Pass 3: same position group
  for (let i = 0; i < 11; i++) {
    if (result[i]) continue;
    const slotGroup = posGroup(slots[i].pos);
    const player = shuffled.find(p => !used.has(p.id) && posGroup(p.position) === slotGroup);
    if (player) { result[i] = player; used.add(player.id); }
  }

  // Pass 4: any remaining
  for (let i = 0; i < 11; i++) {
    if (result[i]) continue;
    const player = shuffled.find(p => !used.has(p.id));
    if (player) { result[i] = player; used.add(player.id); }
  }

  return result;
}

function renderChallengerPhase() {
  const teamPanel = document.querySelector('.team-panel');

  // Compute average stats for both teams
  const userStats = calcTeamAvgStats(team);
  const challStats = calcTeamAvgStats(challengerTeam);

  teamPanel.innerHTML = `
    <div class="match-header">
      <div class="match-team-name">
        <span class="match-team-icon">⚽</span> Your Team
        <span class="match-ovr">${userStats.ovr}</span>
      </div>
      <div class="match-vs">VS</div>
      <div class="match-team-name">
        <span class="match-team-icon">🎯</span> Challenger
        <span class="match-ovr">${challStats.ovr}</span>
      </div>
    </div>

    <div class="match-body">
      <div class="match-pitches">
        <div class="match-pitch-col">
          <div class="pitch-wrapper">
            <div class="pitch match-pitch" id="userMatchPitch">
              <div class="pitch-markings" aria-hidden="true">
                <div class="halfway-line"></div>
                <div class="center-circle"></div>
                <div class="center-dot"></div>
                <div class="penalty-area penalty-top"></div>
                <div class="penalty-area penalty-bottom"></div>
                <div class="goal-area goal-top"></div>
                <div class="goal-area goal-bottom"></div>
                <div class="corner corner-tl"></div>
                <div class="corner corner-tr"></div>
                <div class="corner corner-bl"></div>
                <div class="corner corner-br"></div>
              </div>
              <div class="slots-container" id="userMatchSlots"></div>
            </div>
          </div>
          ${buildStatsBarHTML(userStats)}
        </div>

        <div class="match-pitch-col">
          <div class="pitch-wrapper">
            <div class="pitch match-pitch" id="challengerMatchPitch">
              <div class="pitch-markings" aria-hidden="true">
                <div class="halfway-line"></div>
                <div class="center-circle"></div>
                <div class="center-dot"></div>
                <div class="penalty-area penalty-top"></div>
                <div class="penalty-area penalty-bottom"></div>
                <div class="goal-area goal-top"></div>
                <div class="goal-area goal-bottom"></div>
                <div class="corner corner-tl"></div>
                <div class="corner corner-tr"></div>
                <div class="corner corner-bl"></div>
                <div class="corner corner-br"></div>
              </div>
              <div class="slots-container" id="challengerMatchSlots"></div>
            </div>
          </div>
          ${buildStatsBarHTML(challStats)}
        </div>
      </div>

      <div class="match-detail" id="matchPlayerDetail">
        <div class="player-detail-empty">Click a player on either pitch to see details</div>
      </div>
    </div>

    <div class="match-actions">
      <button class="btn-primary match-play-btn" id="playGameBtn">⚽ Play Game</button>
    </div>`;

  renderMatchPitch('userMatchSlots', team, currentFormation);
  renderMatchPitch('challengerMatchSlots', challengerTeam, currentFormation);

  document.getElementById('playGameBtn').addEventListener('click', () => {
    const result = simulateMatch(team, challengerTeam, currentFormation);
    renderMatchResult(result);
  });
}

function renderMatchPitch(containerId, teamArr, formation) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  FORMATIONS[formation].forEach((slotDef, idx) => {
    const player = teamArr[idx];
    const isFilled = !!player;

    const slotEl = document.createElement('div');
    slotEl.className = `pitch-slot${isFilled ? ' filled' : ''}`;
    slotEl.style.left = `${slotDef.x}%`;
    slotEl.style.top = `${slotDef.y}%`;

    if (isFilled) {
      slotEl.innerHTML = `
        <div class="slot-card-wrap">
          <img class="slot-card-img" src="${esc(player.card)}" alt="${esc(player.name)}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="slot-card-fallback" style="display:none">${esc(player.ovr)}</div>
        </div>
        <div class="slot-name">${esc(shortName(player.name))}</div>
        <div class="slot-pos-label">${esc(slotDef.pos)}</div>`;
      slotEl.addEventListener('click', () => showMatchPlayerDetail(player));
      slotEl.style.cursor = 'pointer';
    } else {
      slotEl.innerHTML = `
        <div class="slot-empty-ring">
          <span class="slot-pos-empty">${esc(slotDef.pos)}</span>
        </div>
        <div class="slot-label-empty">Empty</div>`;
    }

    container.appendChild(slotEl);
  });
}

function showMatchPlayerDetail(player) {
  const panel = document.getElementById('matchPlayerDetail');
  if (!panel || !player) return;

  const altPos = Array.isArray(player['alternative positions']) && player['alternative positions'].length
    ? player['alternative positions'].join(', ')
    : null;
  const isGK = player.position === 'GK';

  panel.innerHTML = `
    <div class="match-detail-inner">
      <div class="pd-card">
        <img class="pd-card-img" src="${esc(player.card)}" alt="${esc(player.name)}"
             onerror="this.style.display='none'">
      </div>
      <div class="match-detail-info">
        <div class="pd-name">${esc(player.name)}</div>
        <div class="pd-meta">
          <div class="pd-row"><span class="pd-label">Club</span> ${esc(player.team)}</div>
          <div class="pd-row"><span class="pd-label">Nation</span> ${esc(player.nation)}</div>
          <div class="pd-row"><span class="pd-label">Position</span> ${esc(player.position)}${altPos ? ` <span class="pd-alt">(${esc(altPos)})</span>` : ''}</div>
          <div class="pd-row"><span class="pd-label">Foot</span> ${esc(player['preferred foot'])} ⭐${esc(player['weak foot'])}</div>
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
      </div>
    </div>`;
}

function calcTeamAvgStats(teamArr) {
  const players = teamArr.filter(Boolean);
  const n = players.length;
  const avg = (key) => n ? Math.round(players.reduce((s, p) => s + (parseInt(p[key]) || 0), 0) / n) : '—';
  return {
    ovr: avg('ovr'), pac: avg('pac'), sho: avg('sho'),
    pas: avg('pas'), dri: avg('dri'), def: avg('def'), phy: avg('phy'),
  };
}

// ────────────────────────────────────────────────────────────────
// MATCH SIMULATION
// ────────────────────────────────────────────────────────────────

/**
 * Categorise team slots into positional groups based on formation slot position.
 * Returns { gk: [...], def: [...], mid: [...], fwd: [...] }
 * Each entry is { player, slotPos }.
 */
function categoriseBySlot(teamArr, formation) {
  const groups = { gk: [], def: [], mid: [], fwd: [] };
  const slots = FORMATIONS[formation];
  for (let i = 0; i < 11; i++) {
    const player = teamArr[i];
    if (!player) continue;
    const slotPos = slots[i].pos;
    const group = posGroup(slotPos);
    const key = group === 'GK' ? 'gk' : group === 'DEF' ? 'def' : group === 'FWD' ? 'fwd' : 'mid';
    groups[key].push({ player, slotPos });
  }
  return groups;
}

/**
 * Check whether a player is in their preferred position, an alternate, or out of position.
 * Returns 'preferred' | 'alternate' | 'out'
 */
function positionFit(player, slotPos) {
  if (player.position === slotPos) return 'preferred';
  const alts = Array.isArray(player['alternative positions']) ? player['alternative positions'] : [];
  if (alts.includes(slotPos)) return 'alternate';
  return 'out';
}

function stat(player, key) { return parseInt(player[key]) || 0; }

function avgStat(entries, fn) {
  if (!entries.length) return 50;
  return entries.reduce((sum, e) => sum + fn(e), 0) / entries.length;
}

/**
 * Calculate how many goals a team scores.
 * attackTeam attacks, defenseTeam defends.
 */
function calcGoalsForTeam(attackGroups, defenseGroups) {
  // ── Attack strength (from attacking team) ──
  // Forwards: shooting, with position-fit adjustment
  const fwdShooting = avgStat(attackGroups.fwd, ({ player, slotPos }) => {
    let sho = stat(player, 'sho');
    const fit = positionFit(player, slotPos);
    if (fit === 'preferred') sho += 3;
    else if (fit === 'out') sho -= 5;
    return sho;
  });

  // Midfielders: passing, dribbling, pace
  const midCreativity = avgStat(attackGroups.mid, ({ player }) => {
    return (stat(player, 'pas') + stat(player, 'dri') + stat(player, 'pac')) / 3;
  });

  // Weighted attack score (0–100 scale)
  const attackScore = fwdShooting * 0.6 + midCreativity * 0.4;

  // ── Defense strength (from defending team) ──
  // Defenders: defensive stat with position-fit adjustment
  const defRating = avgStat(defenseGroups.def, ({ player, slotPos }) => {
    let d = stat(player, 'def');
    const fit = positionFit(player, slotPos);
    if (fit === 'out') d -= 5;
    return d;
  });

  // Midfield defense
  const midDefense = avgStat(defenseGroups.mid, ({ player }) => stat(player, 'def'));

  // Goalkeeper
  const gkRating = avgStat(defenseGroups.gk, ({ player }) => {
    return (stat(player, 'diving') + stat(player, 'handling') + stat(player, 'reflexes')) / 3;
  });

  // Weighted defense score (0–100 scale)
  const defenseScore = defRating * 0.40 + midDefense * 0.25 + gkRating * 0.35;

  // ── Net advantage → expected goals ──
  const advantage = attackScore - defenseScore;
  // Base ~1.5 goals; scale advantage so ±40 diff → ±8 goals swing
  const expectedGoals = Math.max(0.2, 1.5 + advantage * 0.18);

  // ── Poisson-ish random goal generation ──
  return poissonRandom(expectedGoals);
}

/** Generate a Poisson-distributed random integer. */
function poissonRandom(lambda) {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/**
 * Simulate a full match between two teams.
 * Returns { userGoals, challGoals }
 */
function simulateMatch(userTeam, challTeam, formation) {
  const userGroups = categoriseBySlot(userTeam, formation);
  const challGroups = categoriseBySlot(challTeam, formation);

  const userGoals = calcGoalsForTeam(userGroups, challGroups);
  const challGoals = calcGoalsForTeam(challGroups, userGroups);

  return { userGoals, challGoals };
}

// ────────────────────────────────────────────────────────────────
// MATCH RESULT UI
// ────────────────────────────────────────────────────────────────

function renderMatchResult({ userGoals, challGoals }) {
  const teamPanel = document.querySelector('.team-panel');
  const userStats = calcTeamAvgStats(team);
  const challStats = calcTeamAvgStats(challengerTeam);

  let resultLabel, resultClass;
  if (userGoals > challGoals) {
    resultLabel = 'Victory!';
    resultClass = 'result-win';
  } else if (userGoals < challGoals) {
    resultLabel = 'Defeat';
    resultClass = 'result-loss';
  } else {
    resultLabel = 'Draw';
    resultClass = 'result-draw';
  }

  teamPanel.innerHTML = `
    <div class="match-result-screen">
      <div class="result-banner ${resultClass}">
        <div class="result-label">${resultLabel}</div>
      </div>

      <div class="result-scoreboard">
        <div class="result-side">
          <span class="result-team-icon">⚽</span>
          <span class="result-team-label">Your Team</span>
          <span class="result-ovr-badge">${userStats.ovr}</span>
        </div>
        <div class="result-score">
          <span class="result-goals">${userGoals}</span>
          <span class="result-dash">–</span>
          <span class="result-goals">${challGoals}</span>
        </div>
        <div class="result-side">
          <span class="result-team-icon">🎯</span>
          <span class="result-team-label">Challenger</span>
          <span class="result-ovr-badge">${challStats.ovr}</span>
        </div>
      </div>

      <div class="result-pitches">
        <div class="match-pitch-col">
          <div class="pitch-wrapper">
            <div class="pitch match-pitch" id="resultUserPitch">
              <div class="pitch-markings" aria-hidden="true">
                <div class="halfway-line"></div><div class="center-circle"></div>
                <div class="center-dot"></div>
                <div class="penalty-area penalty-top"></div><div class="penalty-area penalty-bottom"></div>
                <div class="goal-area goal-top"></div><div class="goal-area goal-bottom"></div>
                <div class="corner corner-tl"></div><div class="corner corner-tr"></div>
                <div class="corner corner-bl"></div><div class="corner corner-br"></div>
              </div>
              <div class="slots-container" id="resultUserSlots"></div>
            </div>
          </div>
          ${buildStatsBarHTML(userStats)}
        </div>
        <div class="match-pitch-col">
          <div class="pitch-wrapper">
            <div class="pitch match-pitch" id="resultChallPitch">
              <div class="pitch-markings" aria-hidden="true">
                <div class="halfway-line"></div><div class="center-circle"></div>
                <div class="center-dot"></div>
                <div class="penalty-area penalty-top"></div><div class="penalty-area penalty-bottom"></div>
                <div class="goal-area goal-top"></div><div class="goal-area goal-bottom"></div>
                <div class="corner corner-tl"></div><div class="corner corner-tr"></div>
                <div class="corner corner-bl"></div><div class="corner corner-br"></div>
              </div>
              <div class="slots-container" id="resultChallSlots"></div>
            </div>
          </div>
          ${buildStatsBarHTML(challStats)}
        </div>
      </div>

      <div class="match-actions">
        <button class="btn-primary match-play-btn" id="playAgainBtn">🔄 Play Again</button>
        <button class="btn-secondary match-play-btn" id="backToStartBtn">🏠 Back to Start</button>
      </div>
    </div>`;

  renderMatchPitch('resultUserSlots', team, currentFormation);
  renderMatchPitch('resultChallSlots', challengerTeam, currentFormation);

  document.getElementById('playAgainBtn').addEventListener('click', () => {
    initChallenger();
  });
  document.getElementById('backToStartBtn').addEventListener('click', () => {
    location.reload();
  });
}

function buildStatsBarHTML(stats) {
  return `
    <div class="match-stats-bar">
      <div class="team-stat"><span class="tstat-label">OVR</span><span class="tstat-value">${stats.ovr}</span></div>
      <div class="team-stat"><span class="tstat-label">PAC</span><span class="tstat-value">${stats.pac}</span></div>
      <div class="team-stat"><span class="tstat-label">SHO</span><span class="tstat-value">${stats.sho}</span></div>
      <div class="team-stat"><span class="tstat-label">PAS</span><span class="tstat-value">${stats.pas}</span></div>
      <div class="team-stat"><span class="tstat-label">DRI</span><span class="tstat-value">${stats.dri}</span></div>
      <div class="team-stat"><span class="tstat-label">DEF</span><span class="tstat-value">${stats.def}</span></div>
      <div class="team-stat"><span class="tstat-label">PHY</span><span class="tstat-value">${stats.phy}</span></div>
    </div>`;
}
