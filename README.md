# ⚽ FC26 Team Builder

A football team builder powered by FC26 player data. Search for real EA Sports FC 26 players, see their actual in-game cards, and assemble an 11-player squad on a visual pitch.

**No sign-up or API key required** — just open `index.html` and start building.

---

## Features

- 🃏 **Real EA FC26 card images** for every player
- 🔍 **Three ways to find players** — by exact name, by club, or by global rank
- 🏟️ **Visual pitch** — top-down view with pitch markings
- 📋 **5 formations** — 4-3-3 · 4-4-2 · 3-5-2 · 4-2-3-1 · 5-3-2
- 🎯 **Smart auto-assign** — players are placed in the best-matching position slot
- 📌 **Manual slot selection** — click a slot first, then pick the player you want there
- 📊 **Team averages** bar — OVR, PAC, SHO, PAS, DRI, DEF, PHY

---

## Quick Start

1. Open `index.html` in any modern browser — no server, no setup needed.

> If you see CORS errors (rare), serve with a simple local server:
> ```bash
> npx serve .
> # or
> python -m http.server 8080
> ```

---

## How to use

| Action | How |
|--------|-----|
| Search by player name | Select **By Name** tab → enter the **full name** (e.g. `Erling Haaland`) → press Enter |
| Search by club | Select **By Team** tab → enter the official club name (e.g. `Liverpool`, `Real Madrid`) |
| Browse top-rated players | Select **Top Rated** tab → set a rank range → click **Load** |
| Add player to squad | Click any player card (auto-assigns to the best empty position slot) |
| Assign to a specific slot | Click a position slot on the pitch first (it highlights), then click a player card |
| Remove from squad | Hover over a slot on the pitch → click the red **✕** button |
| Change formation | Use the **Formation** dropdown |
| Clear squad | Click **Clear** (asks for confirmation if squad is non-empty) |

---

## Data source

Player data and card images are served by the FC26 API at `https://api.msmc.cc/api/fc26`.  
Card artwork is © EA Sports / Electronic Arts.

---

## Tech stack

| Layer | Tech |
|-------|------|
| UI | Plain HTML5 + CSS3 + vanilla JS (ES2020) |
| Data | FC26 API (`api.msmc.cc`) |
| Build | None — open `index.html` directly |

---

## File structure

```
.
├── index.html   – app shell
├── style.css    – all styles (dark FC theme)
├── app.js       – all application logic
└── README.md    – this file
```

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| "Player not found" | The name search needs the **exact full name** (e.g. `Kylian Mbappé`, not `Mbappe`). Try the **By Team** tab instead |
| Team returns no results | Use the club's official full name (e.g. `Manchester City`, not `Man City`) |
| Card images not loading | Images are served from EA's CDN — a numbered fallback badge is shown if unavailable |
| CORS error | Serve via `npx serve .` instead of opening `index.html` directly |
