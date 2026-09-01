/**
 * Meta team assembly (pure, deterministic).
 *
 * Turns a candidate species list into a COMPLETE, playable team by attaching
 * each Pokémon's most common set (ability / item / moves / nature) straight
 * from usage data, then optionally proposing ONE small off-meta tweak.
 *
 * Honesty rules (enforced):
 *  - Sets come from observed usage frequencies, labeled with those percentages.
 *  - There are NO win rates in the source, so nothing here claims a win rate.
 *  - The optional tweak is labeled experimental, with a clear rationale.
 */

import type { PokemonUsage } from '@/types/usage';
import { canonicalize } from '@/data/sources/showdown-mapping';

export interface MetaSet {
  displayName: string;
  showdownId: string;
  ability?: string;
  abilityPct?: number;
  item?: string;
  itemPct?: number;
  nature?: string;
  naturePct?: number;
  moves: { name: string; pct: number | null }[];
  /** True if we found usage for this mon; false = user must fill it in. */
  hasData: boolean;
}

export interface MetaTeamTweak {
  /** Slot (display name) the tweak applies to, or team-level if undefined. */
  target?: string;
  suggestion: string;
  rationale: string;
  label: 'experimental';
}

export interface AssembledMetaTeam {
  name: string;
  sets: MetaSet[];
  tweak?: MetaTeamTweak;
  /** Provenance note for the UI. */
  note: string;
}

function usageByName(records: PokemonUsage[]): Map<string, PokemonUsage> {
  const map = new Map<string, PokemonUsage>();
  for (const r of records) map.set(canonicalize(r.displayName), r);
  return map;
}

function topOf(
  usage: PokemonUsage,
  category: 'move' | 'held_item' | 'ability' | 'stat_alignment',
  n: number,
) {
  return usage.rows
    .filter((r) => r.category === category && r.name)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, n);
}

/** Build a most-common set for one species from usage. */
export function buildMetaSet(
  displayName: string,
  showdownId: string,
  usage: PokemonUsage | undefined,
): MetaSet {
  if (!usage) {
    return { displayName, showdownId, moves: [], hasData: false };
  }
  const ability = topOf(usage, 'ability', 1)[0];
  const item = topOf(usage, 'held_item', 1)[0];
  const nature = topOf(usage, 'stat_alignment', 1)[0];
  const moves = topOf(usage, 'move', 4).map((m) => ({
    name: m.name,
    pct: m.percentage,
  }));
  return {
    displayName: usage.displayName || displayName,
    showdownId,
    ability: ability?.name,
    abilityPct: ability?.percentage ?? undefined,
    item: item?.name,
    itemPct: item?.percentage ?? undefined,
    nature: nature?.name,
    naturePct: nature?.percentage ?? undefined,
    moves,
    hasData: true,
  };
}

/**
 * Assemble a complete meta team from a species list + usage, with an optional
 * off-meta tweak. `offMetaCandidate` (if provided) is a low-usage mon that
 * covers gaps; we suggest swapping the weakest-data slot for it.
 */
export function assembleMetaTeam(
  name: string,
  species: { displayName: string; showdownId: string }[],
  records: PokemonUsage[],
  offMetaCandidate?: { displayName: string; reason: string },
): AssembledMetaTeam {
  const byName = usageByName(records);
  const sets = species.map((s) =>
    buildMetaSet(s.displayName, s.showdownId, byName.get(canonicalize(s.displayName))),
  );

  let tweak: MetaTeamTweak | undefined;
  if (offMetaCandidate) {
    // Suggest replacing the slot with the least usage support (weakest data or
    // fewest moves) with the off-meta pick — a small, testable deviation.
    const weakest = [...sets]
      .sort((a, b) => (a.moves.length - b.moves.length) || (a.hasData === b.hasData ? 0 : a.hasData ? 1 : -1))[0];
    tweak = {
      target: weakest?.displayName,
      suggestion: `Consider ${offMetaCandidate.displayName} over ${weakest?.displayName ?? 'a flex slot'}.`,
      rationale: `${offMetaCandidate.reason} This is a small, testable deviation others may not expect — run several games before committing.`,
      label: 'experimental',
    };
  }

  return {
    name,
    sets,
    tweak,
    note: 'Sets are the most common choices from usage data (shown with %). No win rates exist in the source, so none are claimed.',
  };
}
