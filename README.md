# VGC Companion

A mobile-first, offline-capable **Pokémon Champions VGC (doubles)** companion. It helps a
competitive ladder player build teams, study the live meta, analyze opponent matchups at
team preview, get in-battle move suggestions, and log battles to improve over time.

- **Local-first & private.** No accounts, no backend server. All your data lives on your
  device in IndexedDB.
- **Installable PWA.** Built on a PC, published once to a free static host, then installed
  on an Android phone where it runs fully offline after the first load.
- **Real usage data.** Powered by the [Champions Battle Data API](https://championsbattledata.com)
  — actual in-game Champions usage, fetched directly from the browser (CORS-enabled).

> ⚠️ **Champions ≠ Scarlet/Violet.** Champions maxes all EVs and uses **Stat Points**
> (0–32 per stat) and **Stat Alignments** (nature-equivalent). The tool is being made
> Champions-aware and must **not** silently apply S/V EV/IV assumptions. See
> [Domain rules](#domain-rules-important) below.

---

## Table of Contents

- [Status](#status)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Features & App Navigation](#features--app-navigation)
- [Data Source & Attribution](#data-source--attribution)
- [Domain Rules (Important)](#domain-rules-important)
- [Deployment](#deployment)
- [Testing](#testing)
- [Known Weak Spots / Roadmap](#known-weak-spots--roadmap)
- [Continuing Work with Kiro](#continuing-work-with-kiro)
- [Reference Documents](#reference-documents)

---

## Status

- Build passes (`tsc -b && vite build`) — verified 104 modules transformed.
- **137 unit tests pass across 21 files** (Vitest). Pure engines are well tested;
  UI/stores/adapters are less covered.
- lint clean (oxlint) aside from some pre-existing warnings.
- Scope right now: **Champions Doubles only.** Showdown support is deferred — the code
  leaves seams (`data/sources/showdown-mapping.ts`) but there is no Showdown adapter.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 + TypeScript (strict-ish: `verbatimModuleSyntax`, `noUnusedLocals`) |
| Build tool | Vite 8 |
| Styling | Tailwind CSS 3 (dark theme) |
| State | Zustand 5 |
| Persistence | Dexie.js / IndexedDB |
| Routing | React Router v6 (base-path aware for root or GitHub-Pages subpath) |
| Testing | Vitest 2 + React Testing Library + fake-indexeddb |
| Linting | oxlint |
| PWA | Custom service worker (`public/sw.js`) + web manifest + generated icons |

No external validation library — normalization is hand-rolled in the API adapter.

---

## Quick Start

Prerequisites: **Node.js 18+** (Node 20 LTS recommended) and npm.

```bash
# install dependencies (first time only)
npm install

# start the dev server (http://localhost:5173)
npm run dev
```

On first run, open the **Data** tab (behind the "More" menu) and tap **Sync usage data**
while online to pull the Champions dex + usage into IndexedDB. After that the app works
offline.

---

## Available Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run build:pages` | Build + write `dist/404.html` + `.nojekyll` for GitHub Pages |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | Run oxlint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run icons` | Regenerate PWA PNG icons (192 / 512 / maskable) |

---

## Project Structure

```
PokemonVGC/
├── public/                  # static assets, PWA manifest, service worker (sw.js), icons/
├── scripts/                 # build helpers (spa-fallback.mjs, generate-icons.mjs)
├── src/
│   ├── app/                 # App shell — Layout.tsx (nav), Router.tsx (lazy routes)
│   ├── engine/              # PURE TS, no React, unit-tested computation
│   │   ├── type-chart.ts            # 18-type effectiveness
│   │   ├── damage-calc.ts           # Gen-9 damage formula (see weak spot #1)
│   │   ├── speed-calc.ts            # effective speed w/ modifiers
│   │   ├── champions-stat.ts        # Champions Stat Point / alignment math
│   │   ├── synergy-analyzer.ts      # defensive/offensive team synergy
│   │   ├── role-checker (team-analysis.ts) # role coverage
│   │   ├── move-advisor.ts          # single-turn heuristic move suggestions
│   │   ├── matchup-lab.ts           # opponent set/archetype/lead inference
│   │   ├── meta-aggregator.ts       # teammate-cooccurrence meta ranking
│   │   ├── team-recommend.ts        # team generation/recommendation
│   │   ├── team-score.ts / team-compare.ts / meta-team.ts / off-meta.ts
│   │   ├── game-plan.ts             # auto game plan generation
│   │   ├── personal-stats.ts        # personal battle-log stats
│   │   ├── improvement-notes.ts     # learning-loop note aggregation
│   │   ├── confidence.ts            # data confidence scoring
│   │   └── __tests__/               # engine unit tests
│   ├── data/
│   │   ├── sources/                 # champions-battle-data.ts (adapter), showdown-mapping.ts
│   │   ├── regulations/             # reg-m-a.json, reg-m-b.json
│   │   ├── glossary.json            # VGC fundamentals glossary
│   │   ├── spread-presets.json
│   │   ├── common-items.json
│   │   ├── pokemon-notes.(ts|json)  # per-mon playstyle notes
│   │   └── regulation-loader.ts
│   ├── db/                  # Dexie schema (database.ts), pokemon-cache.ts, usage-cache.ts
│   ├── stores/             # Zustand: team, matchup, battle-log, settings, usage, live-match
│   │   └── team-migration.ts        # team schema migration (S/V EVs -> Champions)
│   ├── modules/            # feature UIs (each: pages/, components/, hooks/)
│   │   ├── team-builder/            # /teams
│   │   ├── matchup-tool/            # /matchup (Damage Calc, Threat Report, Move Advisor, Scouting Log, Matchup Lab)
│   │   ├── meta-dashboard/          # /meta
│   │   ├── team-intelligence/       # /lab  (LabPage, MetaTeamsView)
│   │   ├── live-match/              # /live (LiveTurnTracker)
│   │   ├── battle-guides/           # /guides (TeamGuide, BattleLogForm, PatternTracker, Glossary, PersonalStats)
│   │   └── data-manager/            # /data (sync + attribution)
│   ├── hooks/              # useDataInit.ts
│   ├── shared/            # shared React components (DataSeeder.tsx)
│   ├── types/             # shared interfaces (pokemon, team, regulation, matchup, battle-log, usage, live-match)
│   └── scripts/           # seed-champions-dex.ts
├── requirements.md          # product requirements (v1.0)
├── design.md                # architecture/design doc
├── tasks.md                 # implementation task breakdown
├── DEPLOY.md                # phone deployment guide
└── COPILOT_REVIEW_HANDOFF.md # code-review handoff brief
```

---

## Architecture

Three layers, strictly separated:

1. **UI Layer (`modules/`, `shared/`, `app/`)** — thin React components that call engine
   functions and render results. Feature-sliced: each module owns its `pages/`,
   `components/`, and `hooks/`.
2. **Engine Layer (`engine/`)** — pure TypeScript, **no React imports**, fully unit
   testable in isolation. All the math and heuristics live here (type chart, damage,
   speed, synergy, move advisor, meta aggregation, etc.). Modules share engines so logic
   is never duplicated.
3. **Data Layer (`db/`, `data/`, `stores/`)** — Dexie/IndexedDB persistence,
   Zustand stores that hydrate from IndexedDB on start, and the Champions API adapter that
   fetches + normalizes + attaches provenance.

Design principles: engine is pure and testable; UI is a thin renderer; data flows down
(stores hold state → engines compute → UI renders). See `design.md` for the full
rationale and diagrams.

---

## Features & App Navigation

Bottom tab bar (mobile-first). Primary tabs are always visible; secondary tabs live behind
a **"More" (⋯)** menu.

| Route | Tab | What it does |
|-------|-----|--------------|
| `/teams` | ⚔️ Teams (primary) | Team Builder — species search, ability/item/nature/tera/moves, synergy / speed / role views, real usage hints, Champions-aware editor (hides S/V EV/IV, item picker from real usage) |
| `/live` | 🔴 Live (primary) | Live turn tracker for an in-progress battle |
| `/matchup` | 🎯 Matchup (primary) | Damage Calc, Threat Report, Move Advisor, Scouting Log, Matchup Lab |
| `/lab` | 🧪 Lab (primary) | Team Intelligence — meta teams view, team generation/recommendation |
| `/meta` | 📊 Meta (more) | Meta Dashboard — teammate-cooccurrence ranking, cores, item/move/ability leaders |
| `/guides` | 📖 Guides (more) | Battle Guides + learning loop — team guide, post-battle log, pattern tracker, personal stats, glossary |
| `/data` | ⚙️ Data (more) | Sync Champions usage into IndexedDB (with progress + attribution) |

`/` redirects to `/teams`.

---

## Data Source & Attribution

- **Champions Battle Data API** — `https://championsbattledata.com`
  (docs `/api_guide`, terms `/api-rules/`).
- Endpoints used: `/api` (index: ~237 mons — base stats, types, abilities, movepool,
  sprites, per-mon battle summary) and `/api/battle/Doubles/:showdownId` (usage rows:
  move, held_item, teammate, ability, stat_alignment, stat_points; daily snapshots via
  `days=`).
- CORS is enabled, so the browser calls it directly — **no proxy/backend needed**.
- **Known limitation:** the API exposes **no** global per-mon usage %/ranking. The app
  derives a popularity ranking from **teammate co-occurrence** and labels it as such.

**Attribution is required and must stay visible in-app:**

> *"Battle data provided by Pokémon Champions Battle Data"* — linked to
> championsbattledata.com, per their API terms. Personal/commercial use is allowed with
> attribution; re-hosting as a competing data service is not.

Every usage datapoint carries provenance (source, format, season, retrieval time) and a
computed confidence — never present derived/usage data as certainty.

---

## Domain Rules (Important)

These are the rules the tool must respect. Getting them wrong produces confidently-wrong
advice, which is the worst failure mode for this app.

1. **Champions ≠ Scarlet/Violet.** Champions maxes all EVs. It uses **Stat Points**
   (0–32 per stat) and **Stat Alignments** (nature-equivalent). Do **not** apply S/V EV/IV
   assumptions to Champions stats. (`engine/champions-stat.ts`, `stores/team-migration.ts`.)
2. **Never present derived data as certainty.** Show provenance + confidence. Unknown
   opponent sets are **probabilities**, not facts.
3. **Legality/uncertainty.** Matchup features must not claim a Pokémon runs a move that
   isn't in observed usage.

---

## Deployment

The app is a **static PWA**. Build it once, publish the `dist/` folder to a free static
host, then install it on your phone. Nothing is hosted on the build machine. Full details
(with Windows PowerShell commands) are in **`DEPLOY.md`**. Summary:

- **Netlify Drop** (fastest, root domain): `npm run build` → drag `dist/` to
  https://app.netlify.com/drop → install from the `*.netlify.app` URL on your phone.
- **Cloudflare Pages** (root domain, account): upload `dist/` or connect the repo.
- **GitHub Pages** (project subpath): set `VITE_BASE="/<repo>/"`, run `npm run build:pages`,
  publish `dist/` to `gh-pages`. The app is fully base-path aware.
- **LAN one-time install:** `npm run build && npm run preview -- --host` (HTTPS caveats
  apply on Android).

After deploying: bump `CACHE_VERSION` in `public/sw.js` so phones pick up new assets.

---

## Testing

```bash
npm test          # run once
npm run test:watch
```

- Vitest with `jsdom` and `fake-indexeddb` (see `vite.config.ts` and `src/test-setup.ts`).
- Tests live in `__tests__/` folders next to the code they cover.
- Engine layer is the best-covered; UI, stores, and the API adapter are lighter and are a
  good place to add coverage.

---

## Known Weak Spots / Roadmap

Prioritized areas to scrutinize (see `COPILOT_REVIEW_HANDOFF.md` for the full brief):

1. **`damage-calc.ts` correctness for Champions** — originally written against the Gen-9
   S/V EV-based formula. Verify it correctly uses the Champions maxed-EV / Stat Point
   model. **Highest-stakes area.**
2. **Name reconciliation** (`showdown-mapping.ts`) — Champions display names ("Alolan
   Raichu") ↔ Showdown ids ("raichualola") ↔ dex slugs; forms/regional variants are
   fragile.
3. **Stat Points vs EVs data model** — team members still carry `evs/ivs`; Champions Stat
   Points aren't yet a first-class field. `team-migration.ts` exists to bridge this.
4. **`useMeta` performance** — recomputes aggregates over all cached usage on the client;
   consider memoizing/persisting.
5. **Service worker** — verify update flow (stale assets) and that API caching signals
   staleness rather than serving dangerously stale usage.
6. **Move Advisor / Matchup Lab heuristics** — check Protect / redirection / Trick Room
   logic for confidently-wrong advice.
7. **Accessibility** — dark-theme contrast, keyboard nav, ARIA on custom pickers, focus
   management in the slide-up editor.
8. **Test coverage** — extend beyond pure engines to UI/stores/adapters.
9. **Error/empty/loading states** — especially offline or before any data is synced.
10. **Type-badge Tailwind classes** (`bg-${type}`) — dynamic class names may be purged by
    Tailwind JIT; verify they render (safelist if needed).

The battle-guides **learning loop** (post-battle improvement) is the intended
differentiator and may be underbuilt — worth prioritizing.

---

## Continuing Work with Kiro

If you're picking this project up on another machine (e.g. your home PC) with
[Kiro CLI](https://kiro.dev), the fastest way to get the AI up to speed is:

1. **Clone/copy the repo** and open a Kiro CLI session in the `PokemonVGC/` folder.
2. **Point Kiro at the context file**: this repo includes **`.kirocontext.md`** — a
   handoff brief that summarizes the product, domain rules, architecture, current state,
   and where to look. Ask Kiro to read it first:
   > "Read `.kirocontext.md`, `requirements.md`, `design.md`, and `tasks.md`, then give me
   > a status summary and the next best task to work on."
3. **Optionally index the codebase** so Kiro can search it semantically:
   Kiro's knowledge tools can index the `src/` tree and the markdown docs for fast recall.
4. **Verify environment**: `npm install`, then `npm run build` and `npm test` to confirm
   the project is healthy before making changes.

The four spec docs (`requirements.md`, `design.md`, `tasks.md`, `COPILOT_REVIEW_HANDOFF.md`)
plus `.kirocontext.md` are the full source of truth — any new Kiro instance that reads them
will understand everything we've been working with.

---

## Reference Documents

| File | Purpose |
|------|---------|
| `requirements.md` | Product requirements (functional + non-functional), glossary, acceptance criteria |
| `design.md` | Architecture, data models, engine design, MVP phasing, key decisions |
| `tasks.md` | Phased implementation task breakdown (T-001 … T-079) |
| `DEPLOY.md` | Step-by-step phone/PWA deployment |
| `COPILOT_REVIEW_HANDOFF.md` | Code + product review brief and known weak spots |
| `.kirocontext.md` | Handoff context for continuing with Kiro on another machine |

---

## License / Attribution

Personal project. Champions usage data is provided by **Pokémon Champions Battle Data**
(championsbattledata.com) and must be attributed in-app per their terms. Pokémon and all
related names are trademarks of Nintendo / Game Freak / The Pokémon Company; this is an
unofficial fan-made companion tool.
