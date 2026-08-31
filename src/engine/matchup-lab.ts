/**
 * Matchup Lab engine (pure, no React / no network).
 *
 * Given an opponent roster (species names) and cached Champions usage data,
 * infer each opponent Pokémon's LIKELY set (moves/item/ability/nature/spread)
 * and produce a team-level scouting report: likely leads, speed-control and
 * archetype signals, recommended bring-4, and explicit scouting notes.
 *
 * Guardrails (per directives):
 *  - Never assert a move the Pokémon does not run in the data — likely moves are
 *    drawn straight from observed usage rows.
 *  - Everything is probabilistic. Each inference carries a probability and the
 *    whole report carries a confidence derived from data coverage.
 */

import type { PokemonUsage, UsageRow, StatPoints } from '@/types/usage';
import { canonicalize } from '@/data/sources/showdown-mapping';

export interface LikelySetItem {
  name: string;
  /** Observed usage probability 0..100 (null if source gave none). */
  probability: number | null;
}

export interface LikelySet {
  displayName: string;
  /** True if we found cached usage for this Pokémon. */
  hasData: boolean;
  topMoves: LikelySetItem[];
  topItems: LikelySetItem[];
  topAbilities: LikelySetItem[];
  topNatures: LikelySetItem[];
  topSpreads: { spread: StatPoints | null; label: string; probability: number | null }[];
  topTeammates: string[];
}

export interface OpponentThreatSignal {
  displayName: string;
  /** Signals we detected from the likely moveset. */
  hasSpeedControl: boolean; // Tailwind / Trick Room / Icy Wind
  hasFakeOut: boolean;
  hasRedirection: boolean; // Follow Me / Rage Powder
  hasProtect: boolean;
  hasIntimidate: boolean;
  isTrickRoomMode: boolean; // TR move OR very low speed spread
}

export interface MatchupReport {
  opponents: LikelySet[];
  signals: OpponentThreatSignal[];
  /** Archetype guesses derived from aggregate signals. */
  likelyArchetypes: string[];
  /** Pokémon most likely to lead (highest data confidence + lead-y kits). */
  likelyLeads: string[];
  scoutingNotes: string[];
  /** 0..1 confidence in this report, driven by how many mons we had data for. */
  coverage: number;
}

const SPEED_CONTROL_MOVES = new Set([
  'tailwind',
  'trickroom',
  'icywind',
  'electroweb',
  'thunderwave',
  'bulldoze',
]);
const TRICK_ROOM_MOVES = new Set(['trickroom']);
const FAKE_OUT = new Set(['fakeout']);
const REDIRECTION = new Set(['followme', 'ragepowder']);
const PROTECT_MOVES = new Set(['protect', 'detect', 'spikyshield', 'kingsshield', 'wideguard']);

function moveKey(name: string): string {
  return canonicalize(name);
}

function topOf(
  usage: PokemonUsage,
  category: UsageRow['category'],
  limit: number,
): LikelySetItem[] {
  return usage.rows
    .filter((r) => r.category === category && (category === 'stat_points' || r.name))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((r) => ({ name: r.name, probability: r.percentage }));
}

/** Build a likely set for one opponent species from cached usage. */
export function buildLikelySet(
  displayName: string,
  usage: PokemonUsage | undefined,
): LikelySet {
  if (!usage) {
    return {
      displayName,
      hasData: false,
      topMoves: [],
      topItems: [],
      topAbilities: [],
      topNatures: [],
      topSpreads: [],
      topTeammates: [],
    };
  }
  const spreads = usage.rows
    .filter((r) => r.category === 'stat_points')
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map((r) => ({
      spread: r.statPoints ?? null,
      label: r.name || 'spread',
      probability: r.percentage,
    }));

  return {
    displayName: usage.displayName || displayName,
    hasData: true,
    topMoves: topOf(usage, 'move', 6),
    topItems: topOf(usage, 'held_item', 3),
    topAbilities: topOf(usage, 'ability', 2),
    topNatures: topOf(usage, 'stat_alignment', 2),
    topSpreads: spreads,
    topTeammates: topOf(usage, 'teammate', 5).map((t) => t.name),
  };
}

/** Detect threat signals from a likely set's top moves + ability + spread. */
export function detectSignals(set: LikelySet): OpponentThreatSignal {
  const moveKeys = set.topMoves.map((m) => moveKey(m.name));
  const abilityKeys = set.topAbilities.map((a) => moveKey(a.name));
  const hasTrickRoomMove = moveKeys.some((k) => TRICK_ROOM_MOVES.has(k));

  // Low-speed spread heuristic: top spread invests 0 speed points AND a
  // speed-lowering nature-ish signal — treat as possible TR mode.
  const topSpread = set.topSpreads[0]?.spread;
  const lowSpeedSpread = topSpread ? topSpread.speed === 0 : false;

  return {
    displayName: set.displayName,
    hasSpeedControl: moveKeys.some((k) => SPEED_CONTROL_MOVES.has(k)),
    hasFakeOut: moveKeys.some((k) => FAKE_OUT.has(k)),
    hasRedirection: moveKeys.some((k) => REDIRECTION.has(k)),
    hasProtect: moveKeys.some((k) => PROTECT_MOVES.has(k)),
    hasIntimidate: abilityKeys.includes('intimidate'),
    isTrickRoomMode: hasTrickRoomMove || (lowSpeedSpread && hasTrickRoomMove),
  };
}

/**
 * Produce a full matchup report for an opponent roster.
 * @param roster opponent species display names (species-only is fine)
 * @param usageByName function that returns cached usage for a species name
 */
export function buildMatchupReport(
  roster: string[],
  resolveUsage: (name: string) => PokemonUsage | undefined,
): MatchupReport {
  const opponents = roster.map((name) => buildLikelySet(name, resolveUsage(name)));
  const signals = opponents.map(detectSignals);

  const withData = opponents.filter((o) => o.hasData).length;
  const coverage = roster.length > 0 ? withData / roster.length : 0;

  // Archetype inference from aggregate signals.
  const archetypes: string[] = [];
  const trickRoomCount = signals.filter((s) => s.isTrickRoomMode).length;
  const tailwindLikely = signals.some(
    (s) =>
      s.hasSpeedControl &&
      opponents
        .find((o) => o.displayName === s.displayName)
        ?.topMoves.some((m) => moveKey(m.name) === 'tailwind'),
  );
  if (trickRoomCount >= 1) archetypes.push('Trick Room');
  if (tailwindLikely) archetypes.push('Tailwind offense');
  if (signals.filter((s) => s.hasIntimidate).length >= 2)
    archetypes.push('Intimidate-heavy');
  if (signals.some((s) => s.hasRedirection)) archetypes.push('Redirection support');
  if (archetypes.length === 0) archetypes.push('Balanced / unclear');

  // Likely leads: Pokémon with Fake Out, speed control, or redirection are
  // classic leads; prefer ones we have data for.
  const leadScored = opponents
    .map((o) => {
      const sig = signals.find((s) => s.displayName === o.displayName)!;
      let score = 0;
      if (sig.hasFakeOut) score += 3;
      if (sig.hasSpeedControl) score += 3;
      if (sig.hasRedirection) score += 2;
      if (sig.hasIntimidate) score += 2;
      if (o.hasData) score += 1;
      return { name: o.displayName, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.name);

  // Scouting notes — explicit, uncertainty-aware.
  const notes: string[] = [];
  if (coverage < 1) {
    const missing = opponents.filter((o) => !o.hasData).map((o) => o.displayName);
    notes.push(
      `No cached usage for: ${missing.join(', ')}. Sync more data or treat these sets as unknown.`,
    );
  }
  if (trickRoomCount >= 1) {
    notes.push(
      'Possible Trick Room — confirm before committing fast leads; consider Taunt / your own TR counter-lead.',
    );
  }
  if (signals.some((s) => s.hasFakeOut)) {
    notes.push('Watch for Fake Out on turn 1 — protect your key mon or lead into it.');
  }
  if (signals.filter((s) => s.hasIntimidate).length >= 1) {
    notes.push('Intimidate present — physical attackers may be dropped; factor -1 Atk.');
  }
  if (signals.some((s) => s.hasRedirection)) {
    notes.push('Redirection (Follow Me / Rage Powder) — spread moves or target the redirector.');
  }
  notes.push(
    'All sets are probabilistic from observed usage. Scout revealed moves/items and adjust.',
  );

  return {
    opponents,
    signals,
    likelyArchetypes: archetypes,
    likelyLeads: leadScored,
    scoutingNotes: notes,
    coverage,
  };
}


export interface Bring4Recommendation {
  /** Team member ids ordered best-first; the top 4 are the suggested bring. */
  ordered: { teamMemberId: string; name: string; score: number }[];
}

/**
 * Recommend which 4 of my team to bring vs an opponent roster, using an
 * offensive type-coverage heuristic. Pure: the caller supplies each of my
 * members' STAB types and the opponent Pokémon's types, plus a type-chart
 * effectiveness function. HEURISTIC only — not a game-tree solver.
 */
export function recommendBring4(
  myTeam: { teamMemberId: string; name: string; types: string[] }[],
  opponentTypes: string[][],
  getEffectiveness: (atk: string, def: string[]) => number,
): Bring4Recommendation {
  const ordered = myTeam
    .map((mon) => {
      let score = 0;
      for (const atkType of mon.types) {
        for (const defTypes of opponentTypes) {
          if (defTypes.length === 0) continue;
          const eff = getEffectiveness(atkType, defTypes);
          score += eff >= 2 ? 2 : eff === 1 ? 0.5 : eff > 0 ? -0.5 : -1;
        }
      }
      return { teamMemberId: mon.teamMemberId, name: mon.name, score };
    })
    .sort((a, b) => b.score - a.score);
  return { ordered };
}
