# VGC Companion — Requirements Document

**Version:** 1.0  
**Date:** 2026-08-24  
**Status:** Draft

---

## 1. Product Overview

**VGC Companion** is a mobile-friendly web application for competitive Pokémon VGC (Video Game Championships) doubles players. It serves as a planning and reflection companion — not a battle engine — across three connected modules:

1. **Team Builder** — assemble and evaluate 6-Pokémon teams
2. **Matchup Tool** — analyze threat matchups against opponent teams
3. **Battle Guides & Learning** — generate play guides and track improvement over time

**Target user:** Intermediate VGC player who knows the basics but wants structured habits for speed control awareness, Protect/Fake Out timing, bring-4 decisions, and learning from losses.

**Supported formats:** Pokémon Champions (current official platform), Pokémon Showdown, older Scarlet/Violet regulations — any VGC-legal doubles format.

---

## 2. Functional Requirements

### 2.1 Format & Regulation System

| ID | Requirement |
|----|-------------|
| FR-REG-01 | User can select a regulation/format (e.g., Reg M-A, Reg M-B, Showdown OU Doubles) from a list |
| FR-REG-02 | Selecting a regulation filters the available Pokémon, items, moves, and Mega Evolutions to only legal options |
| FR-REG-03 | Regulation rules are stored as structured editable config data (JSON files), not hardcoded logic |
| FR-REG-04 | A new regulation can be added by editing/adding a JSON config file — no code change or redeployment required |
| FR-REG-05 | Standard VGC doubles rules enforced: 6 Pokémon in Team Sheet, bring 4 to battle, no duplicate species, no duplicate held items |

### 2.2 Data Sources & Management

| ID | Requirement |
|----|-------------|
| FR-DATA-01 | Pokémon base stats, types, abilities, and move data sourced from PokéAPI or equivalent open dataset |
| FR-DATA-02 | Pokémon data is cached locally (generated JSON or lightweight DB) — not fetched live per request |
| FR-DATA-03 | Full 18-type effectiveness chart built as static reference data |
| FR-DATA-04 | Manual/CSV import feature for competitive usage stats, common movesets, and team cores |
| FR-DATA-05 | No automated scraping of third-party sites (Pikalytics, Pokémon Zone, etc.) |
| FR-DATA-06 | User can flag Pokémon as "caught / available to me" vs "not yet available" to filter recommendations |

### 2.3 Module 1: Team Builder

| ID | Requirement |
|----|-------------|
| FR-TB-01 | Add/remove Pokémon to a 6-slot team box |
| FR-TB-02 | For each Pokémon: set ability, held item, EVs/IVs (or simplified spread presets), Tera Type (if applicable), and up to 4 moves |
| FR-TB-03 | Spread presets available: Bulky Physical Wall, Fast Attacker, Trick Room Support, etc. (in addition to manual EV entry) |
| FR-TB-04 | Move selection validated against the Pokémon's legal movepool for the selected regulation/format |
| FR-TB-05 | **Defensive Synergy View:** combined type-weakness/resistance chart across team (or subset), flag when 3+ members share a weakness |
| FR-TB-06 | **Speed Tier View:** team ordered by effective speed at common stages (base, Tailwind, Trick Room, Choice Scarf, +1); optionally include common meta threats for comparison |
| FR-TB-07 | **Role Coverage Checklist:** flag presence/absence of speed control (Tailwind/Trick Room/Icy Wind), Fake Out user, redirection (Follow Me/Rage Powder), weather/hazard setters, reliable answers to common offensive types |
| FR-TB-08 | **Bring-4 Helper:** suggest which 4 to bring for a generic matchup; allow manual override |
| FR-TB-09 | Save multiple teams with name, archetype tags (Trick Room, Rain, Sun, Tailwind offense, bulky balance, etc.) |
| FR-TB-10 | Item uniqueness enforced within a team (no duplicate held items) |
| FR-TB-11 | Species clause enforced (no duplicate species) |

### 2.4 Module 2: Matchup Tool

| ID | Requirement |
|----|-------------|
| FR-MT-01 | Input an opponent's team manually (species-only or full sets if known) |
| FR-MT-02 | **Threat Report:** which of my Pokémon are outsped/threatened by which of theirs, and by how much (damage calc showing % HP and KO likelihood) |
| FR-MT-03 | **Answer Coverage:** which of their Pokémon I have a strong answer to |
| FR-MT-04 | **Lead/Back Suggestions:** suggested lead pairs and back-line pairs based on common opening patterns (Fake Out chains, speed control targeting) |
| FR-MT-05 | Save opponent teams to a personal "scouting log" for tournament use |
| FR-MT-06 | Reuses the same type chart, speed tier, and damage-estimate logic as Team Builder (no duplication) |

### 2.4.1 Damage Calculator & KO Predictor

| ID | Requirement |
|----|-------------|
| FR-DMG-01 | Implement Gen 9 damage formula (or appropriate gen for the regulation) accounting for: base power, attack/defense stats, level, STAB, type effectiveness, weather, terrain, spread move penalty (0.75×), critical hits, stat boosts, held items (Life Orb, Choice Band/Specs, etc.), and abilities that modify damage |
| FR-DMG-02 | For any attacker→defender pair, calculate damage range (min–max roll) as % of defender's HP |
| FR-DMG-03 | Display KO likelihood: OHKO, chance to OHKO (e.g., "87.5% to OHKO"), 2HKO, 3HKO, or "does not KO" |
| FR-DMG-04 | Support common battle modifiers: stat stages (-6 to +6), Burned status (halves physical attack), weather (Sun/Rain boosting Fire/Water), terrain (Electric/Grassy/Psychic/Misty), screens (Reflect/Light Screen), and Tera Type changes |
| FR-DMG-05 | Allow user to set the board state for a calc: which Pokémon are on field, weather/terrain active, stat boosts applied, HP remaining |
| FR-DMG-06 | Bulk calc mode: show a full damage matrix — every move of my Pokémon vs every opponent Pokémon (and vice versa) with KO thresholds highlighted |

### 2.4.2 Optimal Move Advisor

| ID | Requirement |
|----|-------------|
| FR-OPT-01 | Given a board state (my 2 active Pokémon, their 2 active Pokémon, known moves, current HP, field conditions), suggest the optimal move for each of my active Pokémon |
| FR-OPT-02 | "Optimal" considers: KO potential (prioritize securing a KO), damage dealt, avoiding waste (don't overkill), preserving your own Pokémon (minimize incoming damage next turn), and speed order |
| FR-OPT-03 | Factor in Protect prediction: if an opponent is likely to Protect (e.g., after being threatened), suggest spreading or doubling the other target instead |
| FR-OPT-04 | Show reasoning for the suggestion (e.g., "Earthquake KOs Incineroar through Intimidate; partner is Flying-type so no friendly fire") |
| FR-OPT-05 | Allow user to input the current board state quickly — select from their team + opponent's team, set HP sliders, toggle field conditions |
| FR-OPT-06 | This is a heuristic advisor, not a game-tree solver — suggestions are based on immediate-turn damage/KO math and common VGC decision heuristics, not multi-turn lookahead |

### 2.5 Module 3: Battle Guides & Learning

| ID | Requirement |
|----|-------------|
| FR-BG-01 | For each saved team, auto-generate a battle guide: win condition, general game plan (1–2 sentences) |
| FR-BG-02 | Lead recommendations against common archetypes (Trick Room, weather, generic bulky offense) with reasoning |
| FR-BG-03 | Key in-game decision points (when to Protect, when to double, when to pivot) |
| FR-BG-04 | "This team loses if..." failure conditions list |
| FR-BG-05 | **Pre-Battle Checklist:** short prompt before ranked matches ("who moves first," "likely lead," "win condition") |
| FR-BG-06 | **Post-Battle Reflection Log:** quick entry for result, what was brought, 1–3 things that went right/wrong |
| FR-BG-07 | Reflection logs stored persistently over time |
| FR-BG-08 | **Mistake Pattern Tracker:** surfaces recurring issues from logged reflections (e.g., "mispredicted Protect in 4 of last 10 losses") |
| FR-BG-09 | **VGC Fundamentals Glossary:** reference for Fake Out, Follow Me/Rage Powder, speed control, Trick Room, bring-4 strategy, Team Preview reading — aimed at intermediate players |
| FR-BG-10 | Post-battle logging takes under 1 minute (lightweight UX) |

---

## 3. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Mobile-friendly responsive web app (usable on phone between tournament matches) |
| NFR-02 | Local persistence at minimum (browser storage / IndexedDB / lightweight local DB) |
| NFR-03 | No user accounts/auth required for v1 (unless simplest path to cross-device persistence) |
| NFR-04 | Regulation data, dex data, and meta usage imports editable without redeploying core logic |
| NFR-05 | MVP prioritization: Team Builder + synergy view → Matchup Tool → Battle Guides/Learning |
| NFR-06 | Fast load times; offline-capable for cached data |
| NFR-07 | Accessible (WCAG 2.1 AA baseline — contrast, keyboard nav, screen reader labels) |

---

## 4. Out of Scope (v1)

- No live battle simulation or Pokémon Showdown/Champions integration
- No automated scraping of third-party stat sites
- No multi-turn game-tree solving or AI opponent simulation — the optimal move advisor is single-turn heuristic only
- No multiplayer/social features
- No user authentication system (unless trivially needed for persistence)
- No exact RNG seed / timer / animation frame considerations — standard damage formula with min/max roll range is sufficient

---

## 5. Glossary

| Term | Definition |
|------|------------|
| VGC | Video Game Championships — official Pokémon competitive doubles format |
| Bring-4 | Selecting 4 of 6 team members to bring into a specific battle |
| Team Sheet | The 6-Pokémon roster revealed to opponents before a match |
| Tera Type | A Pokémon's terastallization type (changes its type mid-battle) |
| Speed Control | Moves/abilities that alter effective speed order (Tailwind, Trick Room, Icy Wind, etc.) |
| Regulation | A ruleset defining which Pokémon, items, moves, and mechanics are legal for a period |
| Meta | The current competitive metagame — what's commonly used and effective |
| OHKO / 2HKO | One-hit KO / Two-hit KO — number of hits required to faint a Pokémon |
| Damage Roll | The random multiplier (0.85–1.0) applied to each attack; results in min/max damage range |
| Board State | The current in-battle situation: which Pokémon are active, their HP, field conditions, stat changes |
| Spread Move | A move targeting multiple Pokémon in doubles; deals 75% of its normal damage |

---

## 6. Acceptance Criteria Summary

The MVP is considered complete when:
1. A user can create a 6-Pokémon team with validated moves/items/abilities for a selected regulation
2. The defensive synergy view correctly flags shared weaknesses
3. The speed tier view shows correct ordering under Tailwind/TR/Scarf modifiers
4. The damage calculator produces correct min/max damage ranges and KO predictions for known matchups
5. The matchup tool produces a threat report with damage calcs comparing two teams
6. The optimal move advisor suggests reasonable plays for a given board state with explanations
7. The battle log can store and retrieve post-match reflections
8. The app is usable on a mobile viewport
9. Regulation data can be updated via JSON config without code changes
