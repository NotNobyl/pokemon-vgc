# VGC Companion — Implementation Tasks

**Date:** 2026-08-24  
**Prereqs:** requirements.md, design.md

---

## Phase 1: Foundation & Scaffolding

- [ ] **T-001** Initialize Vite + React + TypeScript project
- [ ] **T-002** Install and configure Tailwind CSS
- [ ] **T-003** Install core dependencies: Zustand, Dexie.js, React Router v6
- [ ] **T-004** Install dev dependencies: Vitest, React Testing Library, ESLint, Prettier
- [ ] **T-005** Set up directory structure per design.md (engine/, modules/, stores/, data/, db/, shared/, types/)
- [ ] **T-006** Configure path aliases (`@/engine`, `@/stores`, etc.) in tsconfig + vite.config
- [ ] **T-007** Create global TypeScript interfaces (types/pokemon.ts, team.ts, regulation.ts, battle-log.ts, matchup.ts)
- [ ] **T-008** Set up Dexie database schema (db/database.ts) with tables: pokemon, moves, teams, battleLogs, scoutingLog, usageStats
- [ ] **T-009** Create app shell: Layout.tsx with bottom tab navigation, Router.tsx with lazy-loaded routes
- [ ] **T-010** Build basic responsive layout (mobile bottom nav, desktop sidebar nav)

## Phase 2: Core Data Layer

- [ ] **T-011** Implement 18×18 type effectiveness chart (engine/type-chart.ts) + unit tests
- [ ] **T-012** Create type-chart.json static data file
- [ ] **T-013** Build regulation JSON schema and create first configs: data/regulations/reg-m-a.json, reg-m-b.json
- [ ] **T-014** Implement regulation validator (engine/regulation-validator.ts) — validate team against selected regulation
- [ ] **T-015** Create build-time/first-load PokéAPI fetch script (scripts/fetch-pokeapi.ts) — fetch Pokémon, moves, abilities
- [ ] **T-016** Implement Dexie pokemon-cache layer (db/pokemon-cache.ts) — store/retrieve Pokémon data from IndexedDB
- [ ] **T-017** Create spread presets data file (data/spread-presets.json) with common EV spreads
- [ ] **T-018** Build settings store (stores/settings-store.ts) — selected regulation, theme, preferences
- [ ] **T-019** Create data management page: regulation picker, dex browser stub, data refresh button

## Phase 3: Team Builder — Core

- [ ] **T-020** Create team store (stores/team-store.ts) — CRUD teams, add/remove members, persist to IndexedDB
- [ ] **T-021** Build Team List page — display saved teams, create new, delete, edit name/tags
- [ ] **T-022** Build Team Detail page — 6-slot grid showing team members
- [ ] **T-023** Build Pokémon Editor component (slide-up sheet) — species search, ability picker, item picker, nature, EVs/IVs or preset
- [ ] **T-024** Build Move Selector component — searchable move list filtered by legal movepool + regulation
- [ ] **T-025** Implement item/species uniqueness validation (no duplicates within team)
- [ ] **T-026** Build Tera Type picker (if regulation.terastallize === true)
- [ ] **T-027** Implement "available to me" toggle per Pokémon with filter support

## Phase 4: Team Builder — Analysis Views

- [ ] **T-028** Implement synergy analyzer (engine/synergy-analyzer.ts) — defensive weakness aggregation
- [ ] **T-029** Build Defensive Synergy View component — type weakness/resistance chart, flag 3+ shared weaknesses
- [ ] **T-030** Implement speed calculator (engine/speed-calc.ts) — effective speed with all modifiers
- [ ] **T-031** Build Speed Tier View component — ordered list at base/Tailwind/TR/Scarf/+1, include meta threats optionally
- [ ] **T-032** Implement role checker (engine/role-checker.ts) — detect speed control, Fake Out, redirection, weather, etc.
- [ ] **T-033** Build Role Coverage Checklist component — green/red indicators for each role
- [ ] **T-034** Implement bring-4 heuristic (basic: minimize shared weaknesses, maximize answer coverage)
- [ ] **T-035** Build Bring-4 Helper component — suggested 4 with override capability

## Phase 5: Damage Calculator

- [ ] **T-036** Implement Gen 9 damage formula (engine/damage-calc.ts) — base calculation
- [ ] **T-037** Add damage modifiers: STAB, type effectiveness, weather, terrain, spread penalty, critical
- [ ] **T-038** Add item modifiers: Life Orb, Choice Band/Specs, type-boosting items, Assault Vest (SpD 1.5×)
- [ ] **T-039** Add ability modifiers: Huge Power, Pure Power, Adaptability, Intimidate, Flash Fire, Levitate, etc.
- [ ] **T-040** Add status modifiers: Burn (0.5× physical), stat stages (-6 to +6)
- [ ] **T-041** Add screen modifiers: Reflect, Light Screen, Aurora Veil
- [ ] **T-042** Implement KO chance calculation — OHKO/2HKO/3HKO/4+HKO with percentages
- [ ] **T-043** Write comprehensive damage calc unit tests (verify against known calcs from damage-calc sites)
- [ ] **T-044** Build Damage Calculator UI — attacker/defender picker, modifier toggles, results display
- [ ] **T-045** Build Bulk Calc mode — damage matrix (my team vs their team), highlight KO thresholds

## Phase 6: Matchup Tool

- [ ] **T-046** Create matchup store (stores/matchup-store.ts) — opponent team input, scouting log
- [ ] **T-047** Build Opponent Team Input page — add species (search), optionally full sets
- [ ] **T-048** Implement threat report generator — use damage calc to determine who threatens whom
- [ ] **T-049** Build Threat Report component — color-coded matrix of threats/answers
- [ ] **T-050** Implement lead/back suggestion heuristic — Fake Out combos, speed control priority, anti-TR leads
- [ ] **T-051** Build Lead Suggestion component — recommended lead + back pairs with reasoning
- [ ] **T-052** Build Scouting Log page — save/browse/search past opponent teams
- [ ] **T-053** Integrate damage calc into threat report (inline KO indicators)

## Phase 7: Move Advisor

- [ ] **T-054** Implement move scoring system (engine/move-advisor.ts) — killScore, damageScore, utilityScore, safetyScore
- [ ] **T-055** Implement Protect prediction heuristic — score penalty for targeting likely Protect users
- [ ] **T-056** Implement double-target logic — prefer KO-ing one target over spreading damage
- [ ] **T-057** Implement utility scoring — bonus for Tailwind/TR on turn 1, Fake Out on threats
- [ ] **T-058** Build Board State Input UI — select active Pokémon, set HP%, weather, terrain, boosts, status
- [ ] **T-059** Build Move Advisor Results component — ranked moves per slot with reasoning strings
- [ ] **T-060** Write move advisor integration tests with known board states

## Phase 8: Battle Guides & Learning

- [ ] **T-061** Implement auto-guide generator — derive win condition, lead recs, decision points, failure conditions from team data
- [ ] **T-062** Build Battle Guide View per team — scrollable card with all guide sections
- [ ] **T-063** Create battle log store (stores/battle-log-store.ts) — CRUD logs, persist to IndexedDB
- [ ] **T-064** Build Post-Battle Log form — result toggle, bring-4 checkboxes, 1-3 free-text notes, tags
- [ ] **T-065** Build Pre-Battle Checklist modal — quick reference prompts
- [ ] **T-066** Implement mistake pattern tracker — aggregate tags/keywords across recent logs, surface patterns
- [ ] **T-067** Build Pattern Tracker dashboard — "you noted X in N of last M losses"
- [ ] **T-068** Create VGC Fundamentals Glossary data (data/glossary.json) and searchable Glossary page

## Phase 9: Data Import & Management

- [ ] **T-069** Build CSV/paste import for usage stats — parse common Pikalytics-like CSV format
- [ ] **T-070** Build Regulation Editor page — in-app JSON editor for regulation configs, save to IndexedDB
- [ ] **T-071** Build data export (teams as JSON/Showdown paste, logs as CSV, full backup)
- [ ] **T-072** Build data import (restore from backup JSON)

## Phase 10: Polish & Ship

- [ ] **T-073** Responsive audit — test all screens at 375px, 768px, 1280px
- [ ] **T-074** Accessibility audit — contrast ratios, keyboard navigation, ARIA labels, screen reader test
- [ ] **T-075** Performance optimization — lazy load modules, optimize IndexedDB queries, reduce bundle size
- [ ] **T-076** Add loading states, error boundaries, empty states across all modules
- [ ] **T-077** Write integration tests for critical paths (create team → view synergy → run matchup → log battle)
- [ ] **T-078** Add PWA manifest + service worker for offline support (stretch)
- [ ] **T-079** Final manual QA pass on mobile device

---

## Dependency Graph

```
T-001 → T-010 (scaffolding, parallel)
    ↓
T-011 → T-019 (data layer, mostly parallel)
    ↓
T-020 → T-027 (team builder core, sequential)
    ↓
T-028 → T-035 (analysis views, parallel after T-030)
    ↓
T-036 → T-045 (damage calc — critical path, sequential)
    ↓
T-046 → T-053 (matchup tool, depends on damage calc)
    ↓
T-054 → T-060 (move advisor, depends on damage calc)
    ↓
T-061 → T-068 (battle guides, mostly independent of damage calc)
    ↓
T-069 → T-072 (data management, independent)
    ↓
T-073 → T-079 (polish, after all features)
```

---

## Estimated Effort

| Phase | Tasks | Complexity |
|-------|-------|-----------|
| 1. Foundation | 10 | Low — boilerplate |
| 2. Data Layer | 9 | Medium — API integration |
| 3. Team Builder Core | 8 | Medium — UI heavy |
| 4. Analysis Views | 8 | Medium — math + UI |
| 5. Damage Calculator | 10 | High — formula correctness critical |
| 6. Matchup Tool | 8 | Medium — reuses engine |
| 7. Move Advisor | 7 | High — heuristic design |
| 8. Battle Guides | 8 | Medium — mostly UI + simple logic |
| 9. Data Management | 4 | Low–Medium |
| 10. Polish | 7 | Medium — testing + refinement |
| **Total** | **79** | |
