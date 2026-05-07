# ⚽ FUT Team Builder

A FIFA FUT-style football team builder powered by the [API-Football](https://www.api-football.com/) free tier via RapidAPI. Search for real players, view them as FUT-style cards, and assemble an 11-player squad on a visual pitch.

---

## Features

- 🔍 **Search** players by name or by team
- 🃏 **FUT-style cards** — gold / silver / bronze / special — with photo, overall rating, and six stats: PAC · SHO · PAS · DRI · DEF · PHY
- 🏟️ **Visual pitch** — top-down view with pitch markings
- 📋 **5 formations** — 4-3-3 · 4-4-2 · 3-5-2 · 4-2-3-1 · 5-3-2
- 🎯 **Smart auto-assign** — players are placed in the best-matching position slot
- 📌 **Manual slot selection** — click a slot first, then pick the player you want there
- 📊 **Team averages** bar — OVR, PAC, SHO, PAS, DRI, DEF, PHY

---

## Quick Start

### 1 · Get a free RapidAPI key for API-Football

1. Sign up (free) at [https://rapidapi.com](https://rapidapi.com)
2. Search for **API-Football** and subscribe to the **Basic (free) plan**
   - Direct link: <https://rapidapi.com/api-sports/api/api-football>
3. Copy your `X-RapidAPI-Key` from the **API** → **Authorization** tab

> The free tier gives you **100 requests / day**, which is plenty for browsing.

---

### 2 · Add your API key

**Option A – edit `config.js`** *(recommended for repeated use)*

```js
// config.js
const RAPIDAPI_CONFIG = {
  RAPIDAPI_KEY: 'paste_your_key_here',   // ← replace this
  RAPIDAPI_HOST: 'api-football-v1.p.rapidapi.com',
};
```

**Option B – enter it in the UI**

Click the **🔑 API Key** button in the top-right corner and paste your key. It is stored in `localStorage` and survives page refreshes.

---

### 3 · Open the app

Just open `index.html` in any modern browser — no build step, no server needed.

```
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

> **CORS note**: The RapidAPI calls are made directly from the browser. If you run into CORS issues (rare), serve the files with a local dev server:
>
> ```bash
> npx serve .
> # or
> python -m http.server 8080
> ```

---

## How to use

| Action | How |
|--------|-----|
| Search by player name | Select **By Name** tab → choose a league → type ≥ 3 characters → press Enter or click Search |
| Search by team roster | Select **By Team** tab → type a team name → click the team in results |
| Add player to squad | Click any player card (auto-assigns to the best empty slot) |
| Assign to a specific slot | Click a position slot on the pitch first (it highlights), then click a player card |
| Remove from squad | Hover over a slot on the pitch → click the red **✕** button |
| Change formation | Use the **Formation** dropdown — existing players stay in their slot indices |
| Clear squad | Click **Clear** (will ask for confirmation) |

---

## Stat derivation

API-Football does not expose FUT-style attributes directly, so the app derives them from match statistics:

| FUT Stat | Derived from |
|----------|-------------|
| **PAC** | Dribble success rate + position bias |
| **SHO** | Goals/game + shot-on-target rate |
| **PAS** | Pass accuracy + key passes/game |
| **DRI** | Dribble success rate |
| **DEF** | Tackles/game + position bias |
| **PHY** | Overall rating + position bias |
| **OVR** | `games.rating` (API scale ~5–9.5 mapped to 50–99) |

Card rarity follows overall rating: **Bronze** < 65 · **Silver** 65–74 · **Gold** 75–84 · **Special** 85+

---

## Tech stack

| Layer | Tech |
|-------|------|
| UI | Plain HTML5 + CSS3 + vanilla JS (ES2020) |
| Data | [API-Football v3](https://www.api-football.com/) via RapidAPI |
| Storage | `localStorage` (API key only) |
| Build | None — open `index.html` directly |

---

## File structure

```
.
├── index.html   – app shell
├── style.css    – all styles (dark FUT theme)
├── app.js       – all application logic
├── config.js    – API key (edit this)
└── README.md    – this file
```

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| "No players found" | Make sure you've selected the **correct league** for the player — the API free tier **requires a league** for name searches |
| Player not in listed league | Use **By Team** search instead: find their club, then browse its full roster |
| "Invalid API key" | Check your key in `config.js` or via the 🔑 button; make sure you subscribed on RapidAPI |
| "Rate limit hit" | Free tier = 100 req/day. Wait until tomorrow or upgrade your plan |
| Images not loading | Player photos come from `media.api-sports.io` — a fallback silhouette is shown if unavailable |
| CORS error | Serve via `npx serve .` instead of opening `index.html` directly |
