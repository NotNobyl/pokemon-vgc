# VGC Companion — Design Document

**Version:** 1.0  
**Date:** 2026-08-24  
**Status:** Draft  
**Prereq:** requirements.md v1.0

---

## 1. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18 + TypeScript | Component model fits modular UI; TS catches data shape bugs early |
| Build tool | Vite | Fast HMR, simple config, good TS/React support |
| Styling | Tailwind CSS | Utility-first, responsive-by-default, fast to iterate |
| State management | Zustand | Lightweight, no boilerplate, persists to localStorage trivially |
| Persistence | IndexedDB (via Dexie.js) + localStorage | IndexedDB for large data (dex cache, teams, logs); localStorage for small prefs |
| Routing | React Router v6 | Standard, supports lazy-loading modules |
| Testing | Vitest + React Testing Library | Fast, Vite-native, good for unit + integration |
| Linting | ESLint + Prettier | Standard tooling |

**No backend server.** The entire app runs client-side. Pokémon data is pre-fetched from PokéAPI at build time (or on first launch) and cached in IndexedDB. Regulation configs are static JSON bundled with the app but also editable via an in-app config editor that writes to IndexedDB.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer (React)                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │Team      │  │Matchup Tool  │  │Battle Guides &    │  │
│  │Builder   │  │+ Damage Calc │  │Learning           │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│       │                │                    │             │
│  ─────┴────────────────┴────────────────────┴──────────  │
│                    Shared UI Components                    │
│         (PokémonCard, TypeBadge, StatBar, etc.)          │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────┐
│                     Core Engine Layer                      │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Type Chart  │ │Speed Calc│ │Damage    │ │Move      │  │
│  │Engine      │ │Engine    │ │Calculator│ │Advisor   │  │
│  └────────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌────────────┐ ┌──────────┐ ┌──────────────────────┐   │
│  │Synergy     │ │Role      │ │Regulation            │   │
│  │Analyzer    │ │Checker   │ │Validator             │   │
│  └────────────┘ └──────────┘ └──────────────────────┘   │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────┐
│                      Data Layer                            │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │Pokémon DB  │ │Regulation    │ │User Data Store     │  │
│  │(IndexedDB) │ │Configs (JSON)│ │(teams, logs, scout)│  │
│  └────────────┘ └──────────────┘ └────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Key Principles
- **Core engine is pure TypeScript** — no React dependencies, fully testable in isolation
- **UI is a thin layer** calling engine functions and rendering results
- **Modules share engines** — Matchup Tool reuses Team Builder's type/speed/damage logic
- **Data flows down** — stores hold state, engines compute, UI renders

---

## 3. Directory Structure

```
src/
├── app/                    # App shell, routing, layout
│   ├── App.tsx
│   ├── Router.tsx
│   └── Layout.tsx
├── modules/
│   ├── team-builder/       # Module 1
│   │   ├── components/
│   │   ├── hooks/
│   │   └── pages/
│   ├── matchup-tool/       # Module 2
│   │   ├── components/
│   │   ├── hooks/
│   │   └── pages/
│   └── battle-guides/      # Module 3
│       ├── components/
│       ├── hooks/
│       └── pages/
├── engine/                 # Pure TS computation — no React
│   ├── type-chart.ts
│   ├── damage-calc.ts
│   ├── speed-calc.ts
│   ├── synergy-analyzer.ts
│   ├── role-checker.ts
│   ├── move-advisor.ts
│   └── regulation-validator.ts
├── data/                   # Static/bundled data
│   ├── type-chart.json
│   ├── regulations/
│   │   ├── reg-m-a.json
│   │   └── reg-m-b.json
│   ├── spread-presets.json
│   └── glossary.json
├── stores/                 # Zustand stores
│   ├── team-store.ts
│   ├── matchup-store.ts
│   ├── battle-log-store.ts
│   └── settings-store.ts
├── db/                     # IndexedDB (Dexie) schema & access
│   ├── database.ts
│   └── pokemon-cache.ts
├── shared/                 # Shared React components
│   ├── components/
│   ├── hooks/
│   └── utils/
├── types/                  # Global TypeScript interfaces
│   ├── pokemon.ts
│   ├── team.ts
│   ├── regulation.ts
│   ├── battle-log.ts
│   └── matchup.ts
└── scripts/                # Build-time scripts
    └── fetch-pokeapi.ts    # Pre-fetch and cache dex data
```

---

## 4. Data Models

### 4.1 Pokémon (cached from PokéAPI)

```typescript
interface Pokemon {
  id: number;
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  abilities: string[];
  movepool: string[];       // all learnable moves
  weight: number;           // for weight-based moves
}

interface Move {
  name: string;
  type: PokemonType;
  category: 'physical' | 'special' | 'status';
  basePower: number;        // 0 for status moves
  accuracy: number;
  priority: number;         // e.g., +1 for Fake Out, +3 for Protect
  targets: 'single' | 'spread' | 'self' | 'ally';
  flags: {
    contact: boolean;
    sound: boolean;
    bullet: boolean;
    // ... relevant battle flags
  };
}
```

### 4.2 Team & Team Member

```typescript
interface TeamMember {
  id: string;               // unique within team
  pokemonId: number;        // ref to Pokemon.id
  nickname?: string;
  ability: string;
  item: string;
  teraType?: PokemonType;
  moves: [string, string?, string?, string?]; // 1-4 moves
  evs: StatSpread;
  ivs: StatSpread;
  nature: Nature;
  level: number;            // usually 50 for VGC
  available: boolean;       // "caught / available to me"
}

interface StatSpread {
  hp: number; attack: number; defense: number;
  specialAttack: number; specialDefense: number; speed: number;
}

interface Team {
  id: string;
  name: string;
  regulationId: string;
  archetype: string[];      // tags: 'trick-room', 'rain', 'sun', etc.
  members: TeamMember[];    // exactly 6
  createdAt: number;
  updatedAt: number;
}
```

### 4.3 Regulation Config

```typescript
interface Regulation {
  id: string;
  name: string;             // "Regulation M-A"
  game: string;             // "champions" | "showdown" | "scarlet-violet"
  generation: number;
  allowedPokemon: number[]; // dex numbers, or "all-except" with a ban list
  bannedPokemon: number[];
  allowedItems: string[];
  bannedItems: string[];
  megaEvolutions: {
    allowed: boolean;
    legalMegas: string[];   // species that can mega evolve
  };
  terastallize: boolean;
  dynamax: boolean;
  level: number;            // cap (usually 50)
  teamSize: number;         // 6
  bringCount: number;       // 4
}
```

### 4.4 Battle Log

```typescript
interface BattleLog {
  id: string;
  teamId: string;
  opponentTeamId?: string;  // if from scouting log
  date: number;
  result: 'win' | 'loss';
  brought: string[];        // 4 Pokemon IDs from team
  opponentBrought?: string[]; // if known
  notes: string[];          // 1-3 reflection notes
  tags: string[];           // e.g., 'mispredicted-protect', 'bad-lead'
}
```

### 4.5 Matchup / Board State

```typescript
interface BoardState {
  myActive: [ActivePokemon, ActivePokemon];
  theirActive: [ActivePokemon, ActivePokemon];
  myBench: ActivePokemon[];
  theirBench: ActivePokemon[];
  weather?: 'sun' | 'rain' | 'sand' | 'snow' | 'none';
  terrain?: 'electric' | 'grassy' | 'psychic' | 'misty' | 'none';
  screens: { reflect: boolean; lightScreen: boolean; auroraVeil: boolean };
  trickRoom: boolean;
  tailwind: { my: boolean; theirs: boolean };
  turn: number;
}

interface ActivePokemon {
  teamMemberId: string;
  currentHp: number;        // percentage 0-100
  statBoosts: StatBoosts;   // -6 to +6 per stat
  status?: 'burn' | 'paralysis' | 'sleep' | 'poison' | 'toxic' | 'freeze';
  terastallized: boolean;
  protected: boolean;       // used protect this turn
}
```

---

## 5. Core Engine Design

### 5.1 Type Chart Engine

- Static 18×18 effectiveness matrix
- `getEffectiveness(attackType, defenderTypes): number` → 0, 0.25, 0.5, 1, 2, 4
- `getTeamWeaknesses(members): Map<PokemonType, number>` → count of members weak to each type
- Used by: Synergy Analyzer, Damage Calculator, Threat Report

### 5.2 Damage Calculator

Implements the standard Gen 9 damage formula:

```
damage = ((2 * level / 5 + 2) * power * A / D) / 50 + 2
       × targets × weather × critical × random × STAB × type × burn × other
```

Key modifiers chain:
1. **Base:** level, base power, attack stat, defense stat
2. **Multipliers:** STAB (1.5×), type effectiveness, weather (1.5× or 0.5×), terrain (1.3×), spread (0.75×), critical (1.5×), burn (0.5× on physical)
3. **Item modifiers:** Life Orb (1.3×), Choice Band/Specs (1.5×), type-boosting items (1.2×)
4. **Ability modifiers:** Huge Power (2× Atk), Adaptability (2× STAB), Levitate (Ground immunity), etc.
5. **Random roll:** 0.85–1.0 (16 possible values) → gives min/max range

Returns: `{ min: number, max: number, minPercent: number, maxPercent: number, koChance: '0HKO' | 'OHKO' | '2HKO' | '3HKO' | '4+HKO', ohkoPercent?: number }`

### 5.3 Speed Calculator

```typescript
function calcEffectiveSpeed(member: TeamMember, pokemon: Pokemon, modifiers: SpeedModifiers): number
```

Modifiers: nature, EVs/IVs, stat stage, Choice Scarf (1.5×), Tailwind (2×), Trick Room (inverted), Paralysis (0.5×), Unburden, Swift Swim/Chlorophyll, etc.

### 5.4 Move Advisor (Heuristic)

Single-turn decision engine. For each of my 2 active Pokémon, scores every legal move against every legal target:

```
Score = killScore + damageScore + utilityScore + safetyScore

killScore:      +100 if this move KOs the target (OHKO confirmed)
damageScore:    0–50 scaled by % HP dealt
utilityScore:   bonus for speed control, status, Fake Out pressure, positioning
safetyScore:    penalty if I'd be KO'd next turn without Protect; bonus for Protect if threatened
```

Applies heuristic rules:
- Don't overkill (if partner already KOs target, hit the other)
- Respect Protect likelihood (opponent just survived a big threat → likely Protects)
- Prefer double-targeting a threat I can KO over spreading damage
- Value speed control moves highly on turn 1

Output: ranked move suggestions for each active slot, with reasoning string.

### 5.5 Synergy Analyzer

- Defensive: aggregate weaknesses/resistances across team, flag 3+ shared weaknesses
- Offensive: check type coverage across team's STAB + coverage moves
- Role: check presence of key VGC roles (speed control, Fake Out, redirection, etc.)

### 5.6 Regulation Validator

- Loads regulation JSON for selected format
- Validates team: legal species, legal moves (intersection of movepool + regulation allowed moves), no banned items, no duplicates
- Used at team creation and on regulation switch

---

## 6. UI Design

### 6.1 Navigation

Bottom tab bar (mobile-first):
- **Team** — Team Builder
- **Matchup** — Matchup Tool + Damage Calc
- **Guide** — Battle Guides + Learning
- **Data** — Regulation picker, dex browser, usage imports, settings

### 6.2 Key Screens

**Team Builder:**
- Team list → Team detail (6 slots) → Pokémon editor (slide-up sheet)
- Synergy/Speed/Role views as tabs below the team grid
- Drag-to-reorder for team slots

**Matchup Tool:**
- Select my team → input opponent team → view threat report
- Damage calc as a sub-screen: pick attacker, defender, set conditions, see result
- Board state advisor: set the 2v2 field, get move suggestions

**Battle Guides:**
- Per-team guide (auto-generated, scrollable card)
- Battle log: quick-entry form (result toggle, bring-4 checkboxes, free-text notes)
- Pattern tracker: dashboard showing recurring note tags over last N battles
- Glossary: searchable reference page

### 6.3 Responsive Strategy

- Mobile (< 640px): single column, bottom nav, slide-up sheets for editors
- Tablet (640–1024px): side panel for details
- Desktop (> 1024px): multi-column layout, persistent side panels

---

## 7. Data Flow & Persistence

### 7.1 Initial Data Load

1. On first app load (or manual refresh): run `fetch-pokeapi.ts` script equivalent in-browser
2. Fetch all Pokémon for current gen from PokéAPI, transform to our `Pokemon` interface
3. Store in IndexedDB via Dexie
4. Subsequent loads read from IndexedDB (cache-first)

### 7.2 User Data

All user data stored in IndexedDB:
- Teams (with full member details)
- Battle logs
- Scouting log (opponent teams)
- User preferences (selected regulation, theme, etc.)
- Imported usage stats

Zustand stores hydrate from IndexedDB on app start and persist on every state change (debounced).

### 7.3 Export / Backup

- Export teams as JSON (compatible with Pokémon Showdown paste format as stretch goal)
- Export battle logs as CSV
- Import/export all data as a single JSON backup file

---

## 8. MVP Phasing

| Phase | Scope | Target |
|-------|-------|--------|
| 1 | Project scaffolding, type chart, data layer, basic Team Builder (add/remove Pokémon, set moves/items) | Foundation |
| 2 | Synergy view, speed tier view, role coverage checklist | Team analysis |
| 3 | Damage calculator, KO predictor | Core math |
| 4 | Matchup Tool (threat report, lead suggestions), scouting log | Opponent analysis |
| 5 | Move advisor (board state input, heuristic suggestions) | In-battle help |
| 6 | Battle Guides (auto-generated), battle logging, pattern tracker | Learning loop |
| 7 | Polish: responsive refinement, accessibility audit, performance optimization | Ship quality |

---

## 9. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No backend server | Simplicity, no hosting costs, works offline, data stays on user's device |
| Dexie.js over raw IndexedDB | Cleaner API, built-in versioning, good TS support |
| Zustand over Redux | Less boilerplate for this app's size; built-in persist middleware |
| Engine layer is pure TS | Testable without React, reusable, fast — critical for damage calc performance |
| Heuristic move advisor (not minimax) | Multi-turn game-tree search is out of scope; single-turn math + rules covers 80% of decisions |
| Regulation as JSON config | Meets the "update without code change" requirement directly |
| Tailwind CSS | Rapid responsive development, consistent spacing/colors, small bundle with purge |
| Vite | Fast dev experience, native TS, simple config |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| PokéAPI rate limits during data fetch | Fetch once, cache aggressively; provide fallback static JSON bundle |
| Damage formula complexity (abilities, items, edge cases) | Start with common cases (top 30 abilities/items), expand coverage iteratively |
| Move advisor gives bad suggestions | Clearly label as "heuristic suggestion," show reasoning so user can override |
| IndexedDB storage limits on mobile | Monitor usage; battle logs are small; dex data ~5MB compressed |
| Regulation data becomes stale | In-app editor + JSON import makes updates trivial |
