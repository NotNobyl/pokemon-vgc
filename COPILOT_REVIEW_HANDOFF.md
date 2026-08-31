# Copilot Handoff — VGC Companion (Pokémon Champions) Code & Product Review

## Your task

You are reviewing an existing web app called **VGC Companion**. Analyze it and produce a
**prioritized list of concrete improvement areas** across product, architecture, code
quality, correctness, UX, accessibility, performance, and testing. Be specific and
critical — point to real risks and gaps, not generic advice. Where you claim something is
wrong or risky, explain *why* and suggest the smallest practical fix. Rank findings by
impact vs. effort. Call out anything you're unsure about rather than guessing.

At the end, give me a **top-10 "do next" list** ordered by value for a solo developer who
is actively climbing the Pokémon Champions doubles ladder and building this in spare time.

## Product context

- **Purpose:** A Pokémon Champions VGC (doubles) companion for a competitive ladder
  player. Helps build teams, study the meta, analyze opponent matchups at team preview,
  and (planned) log battles to improve over time.
- **Primary user:** One player (the developer). Local-first, private, no accounts.
- **Deployment constraint (important):** Must run **100% on an Android phone** as an
  installable PWA, fully offline after first load. It is built on a work PC but **nothing
  is hosted on that PC** — the static build is published to a free static host (Netlify)
  and installed on the phone. No backend server exists or is wanted for v1.
- **Scope now:** Champions **Doubles only**. Showdown support is explicitly deferred (the
  code leaves seams for it but no Showdown adapter exists yet).

## Key domain rules the tool must respect

- **Champions ≠ Scarlet/Violet.** Champions maxes all EVs, so the S/V EV/IV spread does
  not apply; Champions uses **Stat Points** (0–32 per stat) and **Stat Alignments**
  (nature-equivalent). The tool must NOT silently apply S/V EV assumptions to Champions.
- **Never present derived/usage data as certainty.** Every usage datapoint carries
  provenance (source, format, season, retrieval time) and a computed confidence.
- **Legality/uncertainty:** matchup features must not claim a Pokémon runs a move that
  isn't in observed usage, and unknown opponent sets must be shown as probabilities.

## Data source (the differentiator)

- **Champions Battle Data API** (`https://championsbattledata.com`, docs at `/api_guide`,
  terms at `/api-rules/`). Real in-game Champions usage. CORS enabled (browser calls it
  directly, no proxy). Terms allow personal/commercial use **with attribution**; no
  re-hosting as a competing data service. Attribution string is displayed in-app.
- Endpoints used: `/api` (index: ~237 mons, base stats, types, abilities, movepool,
  sprites, per-mon battle summary), `/api/battle/Doubles/:showdownId` (usage rows: move,
  held_item, teammate, ability, stat_alignment, stat_points), daily snapshots via `days=`.
- **Known data limitation:** the API exposes NO global per-mon usage %/ranking. The app
  derives a popularity ranking from **teammate co-occurrence** and labels it as such.

## Tech stack

- Vite + React 19 + TypeScript (strict-ish: `verbatimModuleSyntax`, `noUnusedLocals`).
- Zustand (state), Dexie/IndexedDB (persistence), React Router v6 (basename-aware for
  root or GitHub-Pages subpath deploys).
- Tailwind CSS (dark theme). oxlint for linting. Vitest + fake-indexeddb for tests.
- No external validation lib — hand-rolled normalization in the API adapter.
- Custom service worker (`public/sw.js`): app-shell cache-first, API network-first with
  cache fallback, SPA navigation fallback, base-path aware. PWA manifest + generated PNG
  icons (192/512/maskable).

## Architecture (layers)

- `engine/` — pure TS, no React, unit-tested: `type-chart`, `damage-calc`, `speed-calc`,
  `synergy-analyzer`, `move-advisor`, `regulation-validator`, `matchup-lab`,
  `meta-aggregator`, `confidence`.
- `data/sources/` — `champions-battle-data.ts` (adapter: fetch+normalize+provenance),
  `showdown-mapping.ts` (Showdown-id ↔ PokéAPI-slug name reconciliation).
- `db/` — Dexie schema (`database.ts`), `pokemon-cache.ts`, `usage-cache.ts`.
- `stores/` — Zustand: team, matchup, battle-log, settings, usage.
- `modules/` — feature UIs: `team-builder`, `matchup-tool` (Damage Calc, Threat Report,
  Move Advisor, Scouting Log, **Matchup Lab**), `meta-dashboard`, `battle-guides`,
  `data-manager`.
- `scripts/seed-champions-dex.ts` — seeds the local dex from the Champions API index.
- `types/` — shared interfaces incl. `usage.ts` (provenance/confidence model).

## Current feature state

- **Team Builder:** species search, ability/item/nature/tera, moves, synergy/speed/role
  views, real usage hints per mon, playstyle notes (e.g. Palafin Zero→Hero), Champions-
  aware (hides EV/IV, item picker from real usage).
- **Matchup Lab:** enter opponent roster → likely sets from usage, archetype/lead guess,
  bring-4 heuristic, scouting notes, data-coverage confidence.
- **Meta Dashboard:** teammate-co-occurrence ranking, cores, item/move/ability leaders.
- **Damage Calc / Move Advisor / Threat Report / Scouting Log:** present.
- **Battle Guides / learning loop:** components exist (`BattleLogForm`, `PatternTracker`,
  etc.) — verify how complete/wired they are; the post-battle improvement loop is the
  intended differentiator and may be underbuilt.
- **Data tab:** syncs Champions usage into IndexedDB with progress + attribution.

## Known weak spots to scrutinize (be skeptical here)

1. **Correctness of `damage-calc.ts`** for Champions — it was written against a Gen-9 S/V
   formula and uses EV-based stats. Does it correctly handle Champions' maxed-EV / Stat
   Point model, or is it silently wrong for this format? This is the highest-stakes area.
2. **Name reconciliation** (`showdown-mapping.ts`) between the Champions display names
   ("Alolan Raichu"), Showdown ids ("raichualola"), and dex slugs — forms/regional
   variants are fragile. Find cases that break.
3. **Stat Points vs EVs** — the data model still has `evs/ivs` on team members; Champions
   Stat Points aren't a first-class team-member field yet. Is the data model honest?
4. **`useMeta` recomputes** aggregates over all cached usage on the client — check
   performance with ~237 mons and whether it should be memoized/persisted.
5. **Service worker caching** — verify update flow (stale assets), and that API caching
   never serves dangerously stale usage without signaling staleness.
6. **Move Advisor / Matchup Lab heuristics** — are the scoring rules sound, or do they
   give confidently-wrong advice? Check the Protect/redirection/Trick Room logic.
7. **Accessibility** — dark theme contrast, keyboard nav, ARIA on the custom pickers
   (item search, move search, roster input), focus management in the slide-up editor.
8. **Test coverage** — pure engines are tested; UI/stores/adapters largely are not.
9. **Error/empty/loading states** — especially when offline or when no data is synced.
10. **Type-badge Tailwind classes** (`bg-${type}`) — dynamic class names may be purged by
    Tailwind's JIT and not render. Verify.

## How to run / verify

- `npm install` then `npm run build` (runs `tsc -b && vite build`).
- `npm test` (Vitest). `npm run lint` (oxlint). `npm run build:pages` for GitHub Pages.
- Currently: build passes, ~47 tests pass, lint 0 errors (some pre-existing warnings).

## Deliverable format I want back

1. **Executive summary** (5–8 bullets): biggest risks and biggest opportunities.
2. **Findings by category** (Correctness / Architecture / UX / A11y / Performance /
   Testing / Product), each with: severity, why it matters, suggested fix, effort.
3. **Top-10 prioritized "do next" list** for a solo dev on a ladder-climb timeline.
4. **Anything you couldn't assess** and what you'd need to.

Be direct. If something is over-engineered, say so. If a feature is a distraction from
ladder performance, say so.
