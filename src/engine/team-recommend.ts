/**
 * Team recommendation engine (pure, deterministic).
 *
 * Generates candidate teams from REAL usage data (teammate co-occurrence +
 * cores) and ranks them with the versioned team-score model. It does NOT invent
 * win rates or claim optimality — candidates are labeled by evidence strength
 * and every recommendation carries the reasons it was chosen.
 *
 * Modes implemented here:
 *  - buildProvenTeams:   expand from popular cores/teammates (meta-supported).
 *  - buildAroundCore:    lock 1–3 species, fill by common teammates + fit.
 *  - improveCurrentTeam: smallest helpful single-swap suggestions.
 *
 * Candidate *scoring* reuses scoreTeam; this module only supplies candidate
 * species lists and the reasons. The UI resolves species -> ScorableMember and
 * calls scoreTeam, keeping this engine free of dex/IO concerns.
 */

import type { PokemonUsage } from '@/types/usage';
import { canonicalize } from '@/data/sources/showdown-mapping';
import { rankByTeammateCoOccurrence } from './meta-aggregator';

export type EvidenceLabel =
  | 'proven'
  | 'strong-evidence'
  | 'promising'
  | 'experimental'
  | 'insufficient-data';

export interface TeamCandidate {
  /** Canonical species names for the 6 slots (fewer if data is thin). */
  species: string[];
  /** Display names aligned to species. */
  displayNames: string[];
  /** Which slots were locked/required (canonical names). */
  locked: string[];
  evidence: EvidenceLabel;
  /** Human reasons this candidate was generated. */
  reasons: string[];
}

/** Build a name-> (displayName, teammates[]) index from usage records. */
function buildTeammateIndex(records: PokemonUsage[]): {
  displayByKey: Map<string, string>;
  teammatesByKey: Map<string, string[]>;
} {
  const displayByKey = new Map<string, string>();
  const teammatesByKey = new Map<string, string[]>();
  for (const rec of records) {
    const key = canonicalize(rec.displayName);
    displayByKey.set(key, rec.displayName);
    const mates = rec.rows
      .filter((r) => r.category === 'teammate' && r.name)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.name);
    teammatesByKey.set(key, mates);
    for (const m of mates) {
      if (!displayByKey.has(canonicalize(m))) displayByKey.set(canonicalize(m), m);
    }
  }
  return { displayByKey, teammatesByKey };
}

/** Greedily grow a team from a seed by most-common teammates. */
function growTeam(
  seedKeys: string[],
  teammatesByKey: Map<string, string[]>,
  displayByKey: Map<string, string>,
  size = 6,
): { species: string[]; displayNames: string[] } {
  const chosen: string[] = [...seedKeys];
  const chosenSet = new Set(seedKeys);

  // Score candidate additions by how many current members list them as a mate.
  while (chosen.length < size) {
    const votes = new Map<string, number>();
    for (const memberKey of chosen) {
      for (const mate of teammatesByKey.get(memberKey) ?? []) {
        const mk = canonicalize(mate);
        if (chosenSet.has(mk)) continue;
        votes.set(mk, (votes.get(mk) ?? 0) + 1);
      }
    }
    if (votes.size === 0) break;
    // Pick the most-voted teammate (ties broken alphabetically for determinism).
    const best = [...votes.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0];
    chosen.push(best);
    chosenSet.add(best);
  }

  return {
    species: chosen,
    displayNames: chosen.map((k) => displayByKey.get(k) ?? k),
  };
}

/**
 * Best Proven Team candidates: seed from the most popular Pokémon and expand by
 * teammate co-occurrence. Deterministic; returns up to `count` diverse teams.
 */
export function buildProvenTeams(
  records: PokemonUsage[],
  count = 3,
): TeamCandidate[] {
  if (records.length === 0) return [];
  const { displayByKey, teammatesByKey } = buildTeammateIndex(records);
  const ranking = rankByTeammateCoOccurrence(records);
  if (ranking.length === 0) return [];

  const candidates: TeamCandidate[] = [];
  const usedSeeds = new Set<string>();

  for (const entry of ranking) {
    if (candidates.length >= count) break;
    if (usedSeeds.has(entry.key)) continue;
    const grown = growTeam([entry.key], teammatesByKey, displayByKey);
    if (grown.species.length < 4) continue; // too little data to be useful
    // Diversity: skip if it heavily overlaps a team we already picked.
    const overlapsExisting = candidates.some((c) => {
      const overlap = c.species.filter((s) => grown.species.includes(s)).length;
      return overlap >= 4;
    });
    if (overlapsExisting) continue;

    grown.species.forEach((s) => usedSeeds.add(s));
    const evidence: EvidenceLabel =
      grown.species.length === 6 ? 'strong-evidence' : 'promising';
    candidates.push({
      species: grown.species,
      displayNames: grown.displayNames,
      locked: [entry.key],
      evidence,
      reasons: [
        `Built around ${entry.displayName}, one of the most-used Pokémon (teammate co-occurrence).`,
        'Filled by most common teammates from usage data.',
        'Meta support is inferred from co-occurrence, not win rate.',
      ],
    });
  }

  return candidates;
}

/**
 * Build Around a Core: lock 1–3 species, fill the rest from their common
 * teammates. `coreDisplayNames` are what the user selected.
 */
export function buildAroundCore(
  coreDisplayNames: string[],
  records: PokemonUsage[],
): TeamCandidate | null {
  if (coreDisplayNames.length === 0) return null;
  const { displayByKey, teammatesByKey } = buildTeammateIndex(records);
  const coreKeys = coreDisplayNames.map(canonicalize);
  // Ensure display names for the core even if not in usage.
  coreDisplayNames.forEach((n) => {
    if (!displayByKey.has(canonicalize(n))) displayByKey.set(canonicalize(n), n);
  });

  const grown = growTeam(coreKeys, teammatesByKey, displayByKey);
  const hadData = coreKeys.some((k) => (teammatesByKey.get(k)?.length ?? 0) > 0);

  return {
    species: grown.species,
    displayNames: grown.displayNames,
    locked: coreKeys,
    evidence: hadData ? 'promising' : 'insufficient-data',
    reasons: hadData
      ? [
          `Locked your core: ${coreDisplayNames.join(', ')}.`,
          'Remaining slots filled by the core members\u2019 most common teammates.',
        ]
      : [
          `Locked your core: ${coreDisplayNames.join(', ')}.`,
          'No usage teammates found for this core \u2014 fill the rest manually or sync data.',
        ],
  };
}

export interface ImprovementSuggestion {
  /** Canonical name of the current member to consider replacing. */
  replaceName: string;
  /** Suggested replacement display name. */
  withName: string;
  reason: string;
  evidence: EvidenceLabel;
}

/**
 * Improve Current Team: suggest the smallest helpful single swaps. Looks for
 * team members that are NOT common teammates of the rest, and proposes the most
 * common teammate of the retained core that isn't already on the team.
 */
export function improveCurrentTeam(
  currentDisplayNames: string[],
  records: PokemonUsage[],
  maxSuggestions = 3,
): ImprovementSuggestion[] {
  if (currentDisplayNames.length === 0 || records.length === 0) return [];
  const { displayByKey, teammatesByKey } = buildTeammateIndex(records);
  const teamKeys = currentDisplayNames.map(canonicalize);
  const teamSet = new Set(teamKeys);

  // Candidate replacements: most common teammates of the team not already on it.
  const votes = new Map<string, number>();
  for (const k of teamKeys) {
    for (const mate of teammatesByKey.get(k) ?? []) {
      const mk = canonicalize(mate);
      if (teamSet.has(mk)) continue;
      votes.set(mk, (votes.get(mk) ?? 0) + 1);
    }
  }
  const topAdditions = [...votes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxSuggestions);

  // Weakest links: members that no other member lists as a teammate.
  const weakLinks = teamKeys.filter((k) => {
    return !teamKeys.some(
      (other) =>
        other !== k &&
        (teammatesByKey.get(other) ?? []).some((m) => canonicalize(m) === k),
    );
  });

  const suggestions: ImprovementSuggestion[] = [];
  for (let i = 0; i < topAdditions.length; i++) {
    const [addKey, addVotes] = topAdditions[i];
    const replace = weakLinks[i] ?? teamKeys[teamKeys.length - 1 - i] ?? teamKeys[0];
    suggestions.push({
      replaceName: displayByKey.get(replace) ?? replace,
      withName: displayByKey.get(addKey) ?? addKey,
      reason: `${displayByKey.get(addKey) ?? addKey} co-occurs with ${addVotes} of your kept members in usage data; ${displayByKey.get(replace) ?? replace} has the least usage synergy with the rest.`,
      evidence: 'promising',
    });
  }
  return suggestions;
}

/** Human label for an evidence level. */
export function evidenceLabelText(e: EvidenceLabel): string {
  switch (e) {
    case 'proven': return 'Proven';
    case 'strong-evidence': return 'Strong evidence';
    case 'promising': return 'Promising';
    case 'experimental': return 'Experimental';
    case 'insufficient-data': return 'Insufficient data';
  }
}
