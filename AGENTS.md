# AGENTS.md — FC26 Team Builder

Reference for AI coding sessions. Covers project structure, API details, and conventions.
Skip to the relevant section rather than re-discovering these from scratch.

---

## Project structure

```
index.html   — app shell: all HTML, layout, search panes, pitch container, stats bar
style.css    — all styles (no preprocessor, plain CSS with custom properties)
app.js       — all application logic (no build step, no framework, vanilla ES2020)
README.md    — user-facing setup and usage docs
AGENTS.md    — this file
```

No `package.json`, no build step, no `node_modules`. Open `index.html` directly in a browser
or serve with `npx serve .` / `python -m http.server 8080` if CORS issues arise.

---

## API

**Base URL:** `https://api.msmc.cc/api/eafc`

No authentication required. No headers needed.

### Endpoints

| Endpoint | Description |
|---|---|
| `GET /players?name=X&game=fc26` | Partial-name search — returns array |
| `GET /players?team=X&game=fc26` | Team search — returns array (up to ~50) |
| `GET /players?game=fc26&rank%3CN&rank%3EM` | Rank range — `%3C` = `<`, `%3E` = `>` |
| `GET /players?game=fc26&position=cm` | Filter by position (lowercase) |
| `GET /random?game=fc26` | Random player |
| `GET /clubs?game=fc26` | List of clubs |
| `GET /leagues?game=fc26` | List of leagues |
| `GET /nations?game=fc26` | List of nations |

Numeric filters use operators in the key: `ovr%3E85` means `ovr>85`.
String filters are partial matches: `name=salah` matches all Salahs.

### Response shape (all fields are strings)

```json
{
  "id": "209331",
  "rank": "1",
  "name": "Mohamed Salah",
  "gender": "M",
  "ovr": "91",
  "pac": "89", "sho": "88", "pas": "86", "dri": "90", "def": "45", "phy": "76",
  "position": "RM",
  "alternative positions": ["RW"],
  "play style": ["Finesse Shot+", "First Touch", ...],
  "nation": "Egypt", "league": "Premier League", "team": "Liverpool",
  "age": "33", "height": "175", "weight": "72",
  "preferred foot": "Left", "weak foot": "3", "skill moves": "4",
  "card": "https://ratings-images-prod.pulse.ea.com/FC26/components/items/209331_en.webp",
  "url": "https://www.ea.com/games/ea-sports-fc/...",
  "game": "FC26",
  "acceleration": "88", "sprint speed": "89", "finishing": "94",
  "shot power": "83", "long shots": "78", "volleys": "83", "penalties": "88",
  "vision": "86", "crossing": "89", "free kick accuracy": "69",
  "short passing": "88", "long passing": "81", "curve": "88",
  "dribbling": "90", "agility": "86", "balance": "91", "reactions": "94",
  "ball control": "90", "composure": "93",
  "interceptions": "55", "heading accuracy": "59", "def awareness": "38",
  "standing tackle": "43", "sliding tackle": "41",
  "jumping": "79", "stamina": "88", "strength": "75", "aggression": "63",
  "diving": "", "handling": "", "kicking": "", "reflexes": ""
}
```

- All numeric values are **strings** — use `parseInt()` before arithmetic.
- `alternative positions` is an **array** (may be empty).
- `play style` is an **array**.
- GK-specific fields (`diving`, `handling`, `kicking`, `reflexes`) are populated for GK players
  and empty strings for outfield players.
- `card` is the full URL to the real EA FC26 card webp on EA's CDN — confirmed live.
- Responses are arrays even for single-result queries.

---

## App architecture (app.js)

### Key globals

| Variable | Purpose |
|---|---|
| `team` | `Array(11)` — each element is a player object or `null` |
| `currentFormation` | String key into `FORMATIONS` (e.g. `'4-3-3'`) |
| `selectedSlot` | Index (0–10) of the currently selected pitch slot, or `null` |
| `allResults` | Full unfiltered array from the last search — used by position filter |
| `dragSourceIdx` | Index of the slot being dragged, or `null` |

### Key functions

| Function | What it does |
|---|---|
| `renderPitch()` | Rebuilds all 11 pitch slots from `team[]` and `FORMATIONS` |
| `addToTeam(player)` | 4-pass position matching then places player; handles selected slot override |
| `applyPosFilter()` | Filters `allResults` by the position dropdown; re-renders result cards |
| `renderPlayerList(players)` | Stores into `allResults`, calls `applyPosFilter()` |
| `refreshCardStates()` | Re-runs `applyPosFilter()` so in-team badges stay accurate |
| `afterTeamChange()` | Call after any team mutation: re-renders pitch, stats, card states |
| `fetchByRankRange(from, to)` | Single API call using rank `<`/`>` operators |

### Position auto-assign priority (in `addToTeam`)

1. Exact position match (e.g. CM player → CM slot)
2. Player's `alternative positions` match a slot
3. Same position group (GK / DEF / MID / FWD)
4. Any empty slot

### Position groups (`POS_GROUP` map)

```
GK            → 'GK'
LB RB CB LWB RWB WB    → 'DEF'
LM RM CM CDM CAM DM AM → 'MID'
LW RW ST CF SS         → 'FWD'
```

### Formations

Defined in `FORMATIONS` as arrays of `{ pos, x, y }` where `x`/`y` are percentages of pitch
size (0,0 = top-left, attack at top). Five formations: `4-3-3`, `4-4-2`, `3-5-2`, `4-2-3-1`,
`5-3-2`.

---

## CSS conventions

- CSS custom properties defined in `:root` in `style.css` — use these rather than hardcoding
  colours. Key ones: `--gold`, `--gold-light`, `--gold-dark`, `--bg-dark`, `--bg-panel`,
  `--pitch-green`.
- Pitch slots use `position: absolute; transform: translate(-50%, -50%)` for centering on x/y %.
- Hover/selected pitch slots scale to 1.55x and raise z-index to 50.
- Card images on the pitch: `.slot-card-wrap` / `.slot-card-img` (82px wide).
- Card images in search results: `.result-card-img` (76px wide).

---

## Known API quirks

- Rank range query: operators must be URL-encoded in the key itself — `rank%3C11` not
  `rank<11`. The `fetchByRankRange` helper in `app.js` handles this.
- Team search uses partial matching — `"city"` matches "Manchester City". Official names work
  best for precise results.
- The `/players` endpoint always returns an **array**, even for zero results (returns `[]`).
- There is no pagination — all matching players are returned in one response.
- GK `pac`/`sho`/`pas`/`dri`/`def`/`phy` fields are populated (not the same meaning as
  outfield stats), and GK-specific fields (`diving` etc.) are also present and non-empty.
