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
  constraints?: { exclude?: Set<string>; allow?: Set<string> },
): { species: string[]; displayNames: string[] } {
  const chosen: string[] = [...seedKeys];
  const chosenSet = new Set(seedKeys);
  const exclude = constraints?.exclude;
  const allow = constraints?.allow; // if set, only these keys may be added

  // Score candidate additions by how many current members list them as a mate.
  while (chosen.length < size) {
    const votes = new Map<string, number>();
    for (const memberKey of chosen) {
      for (const mate of teammatesByKey.get(memberKey) ?? []) {
        const mk = canonicalize(mate);
        if (chosenSet.has(mk)) continue;
        if (exclude?.has(mk)) continue;
        if (allow && !allow.has(mk)) continue;
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
  /** Team score before and after the swap (when score-aware). */
  scoreBefore?: number;
  scoreAfter?: number;
  /** Category improvements the swap produced, for the explanation. */
  improvedCategories?: string[];
}

/**
 * Score-aware "Improve Current Team": for each member, try replacing it with
 * popular candidate teammates, re-score the WHOLE team, and only return swaps
 * that ACTUALLY raise the analyzer score. Returns the biggest genuine
 * improvements first, or an empty list if the team is already well-optimized.
 *
 * @param scoreTeamByNames scores a team given its member display names; returns
 *   { total, categories: {label, score}[] } or null. Supplied by the caller so
 *   this engine stays pure/IO-free.
 * @param candidatePool species names to consider as replacements (e.g. the
 *   meta pool). Falls back to common teammates when omitted.
 */
export function improveCurrentTeamScored(
  currentDisplayNames: string[],
  records: PokemonUsage[],
  scoreTeamByNames: (names: string[]) => { total: number; categories: { label: string; score: number }[] } | null,
  candidatePool?: string[],
  maxSuggestions = 3,
): ImprovementSuggestion[] {
  if (currentDisplayNames.length < 2 || records.length === 0) return [];
  const { displayByKey, teammatesByKey } = buildTeammateIndex(records);

  const base = scoreTeamByNames(currentDisplayNames);
  if (!base) return [];

  // Candidate replacements: explicit pool, else common teammates of the team.
  let candidates: string[];
  if (candidatePool && candidatePool.length > 0) {
    candidates = candidatePool;
  } else {
    const votes = new Map<string, string>();
    for (const k of currentDisplayNames.map(canonicalize)) {
      for (const mate of teammatesByKey.get(k) ?? []) {
        votes.set(canonicalize(mate), displayByKey.get(canonicalize(mate)) ?? mate);
      }
    }
    candidates = [...votes.values()];
  }

  const teamCanon = new Set(currentDisplayNames.map(canonicalize));
  const found: ImprovementSuggestion[] = [];

  for (let slot = 0; slot < currentDisplayNames.length; slot++) {
    const outName = currentDisplayNames[slot];
    let bestForSlot: ImprovementSuggestion | null = null;

    for (const cand of candidates) {
      if (teamCanon.has(canonicalize(cand))) continue;
      const trial = [...currentDisplayNames];
      trial[slot] = cand;
      const after = scoreTeamByNames(trial);
      if (!after) continue;
      const delta = after.total - base.total;
      if (delta <= 1) continue; // must be a real improvement (>1 pt)

      // Which categories improved?
      const beforeByLabel = new Map(base.categories.map((c) => [c.label, c.score]));
      const improvedCategories = after.categories
        .filter((c) => (beforeByLabel.get(c.label) ?? 0) + 3 < c.score)
        .map((c) => c.label);

      if (!bestForSlot || after.total > (bestForSlot.scoreAfter ?? 0)) {
        bestForSlot = {
          replaceName: outName,
          withName: cand,
          reason: `Swapping ${outName} → ${cand} raises the team's analyzer score from ${base.total.toFixed(0)} to ${after.total.toFixed(0)}${improvedCategories.length ? ` (better ${improvedCategories.join(', ')})` : ''}.`,
          evidence: 'promising',
          scoreBefore: Math.round(base.total),
          scoreAfter: Math.round(after.total),
          improvedCategories,
        };
      }
    }
    if (bestForSlot) found.push(bestForSlot);
  }

  return found
    .sort((a, b) => (b.scoreAfter ?? 0) - (a.scoreAfter ?? 0))
    .slice(0, maxSuggestions);
}

/**
 * Legacy popularity-only Improve Current (kept for compatibility). Prefer
 * improveCurrentTeamScored, which only suggests verified score increases.
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

/**
 * Diversified generator for the "Suggest / Refresh" flow. Unlike
 * buildProvenTeams (which always seeds from the very top), this seeds from a
 * ROTATING window of popular Pokémon so each refresh surfaces genuinely
 * different teams. Deterministic for a given `seedOffset`, so results are
 * reproducible but varied as the offset advances.
 *
 * @param seedOffset advance this on each Refresh to get the next batch.
 * @param count how many distinct teams to return.
 */
export function generateDiverseTeams(
  records: PokemonUsage[],
  count = 5,
  seedOffset = 0,
): TeamCandidate[] {
  if (records.length === 0) return [];
  const { displayByKey, teammatesByKey } = buildTeammateIndex(records);
  const ranking = rankByTeammateCoOccurrence(records);
  if (ranking.length === 0) return [];

  const candidates: TeamCandidate[] = [];
  // Rotate the starting seed by offset so Refresh explores new territory,
  // wrapping around the popularity list.
  const n = ranking.length;
  for (let i = 0; i < n && candidates.length < count; i++) {
    const seedEntry = ranking[(seedOffset + i) % n];
    const grown = growTeam([seedEntry.key], teammatesByKey, displayByKey);
    if (grown.species.length < 4) continue;

    // Diversity: skip near-duplicates of already-chosen teams.
    const dup = candidates.some((c) => {
      const overlap = c.species.filter((s) => grown.species.includes(s)).length;
      return overlap >= 4;
    });
    if (dup) continue;

    candidates.push({
      species: grown.species,
      displayNames: grown.displayNames,
      locked: [seedEntry.key],
      evidence: grown.species.length === 6 ? 'strong-evidence' : 'promising',
      reasons: [
        `Built around ${seedEntry.displayName} and its most common teammates.`,
        'Meta support inferred from usage co-occurrence (not win rate).',
      ],
    });
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Unified generation: modes + constraints
// ---------------------------------------------------------------------------

export type GenerationMode =
  | 'proven'
  | 'meta-adjacent'
  | 'counter-meta'
  | 'ladder-climb'
  | 'experimental'
  | 'best-available';

export interface GenerateOptions {
  /** Canonical names to exclude entirely. */
  exclude?: string[];
  /** If set, only these species (canonical names) may be used. */
  availableOnly?: string[];
  /** Require at least one member whose usage includes this move. */
  requiredMove?: string;
  /** Require at least one member whose usage includes this item. */
  requiredItem?: string;
  /** 0 = fully off-meta, 1 = fully meta. Biases seed selection. */
  metaBias?: number;
  /** Advance for a different batch (Refresh). */
  seedOffset?: number;
  /** How many teams to return. */
  count?: number;
}

const SPEED_CONTROL_KEYS = ['tailwind', 'trickroom', 'icywind', 'thunderwave'];

/** Does this species' usage include a move/item (case-insensitive)? */
function usageHas(
  rec: PokemonUsage | undefined,
  category: 'move' | 'held_item',
  needle: string,
): boolean {
  if (!rec || !needle) return false;
  const n = canonicalize(needle);
  return rec.rows.some(
    (r) => r.category === category && canonicalize(r.name) === n,
  );
}

/**
 * Unified team generator. Dispatches by mode, enforces constraints (exclusions,
 * available-only, species clause via growTeam dedup), and applies
 * required-move/item as a post-filter. Deterministic per seedOffset.
 *
 * Legality note: this produces species-level candidates. Full regulation
 * validation (items/moves/forms) is applied downstream by the UI/validator; the
 * constraints here guarantee no excluded/unavailable/duplicate species appear.
 */
export function generateTeams(
  records: PokemonUsage[],
  mode: GenerationMode,
  options: GenerateOptions = {},
): TeamCandidate[] {
  if (records.length === 0) return [];
  const { displayByKey, teammatesByKey } = buildTeammateIndex(records);
  const ranking = rankByTeammateCoOccurrence(records);
  if (ranking.length === 0) return [];

  const count = options.count ?? 4;
  const seedOffset = options.seedOffset ?? 0;
  const exclude = new Set((options.exclude ?? []).map(canonicalize));
  const allow = options.availableOnly && options.availableOnly.length > 0
    ? new Set(options.availableOnly.map(canonicalize))
    : undefined;
  const usageByKey = new Map(records.map((r) => [canonicalize(r.displayName), r]));
  const metaBias = options.metaBias ?? 0.7;

  // Build the ordered seed pool per mode.
  let seedPool = ranking.filter((e) => !exclude.has(e.key) && (!allow || allow.has(e.key)));

  if (mode === 'experimental' || metaBias < 0.4) {
    // Off-meta lean: start deeper in the popularity list (less-used seeds).
    const cut = Math.floor(seedPool.length * (mode === 'experimental' ? 0.5 : 1 - metaBias));
    seedPool = [...seedPool.slice(cut), ...seedPool.slice(0, cut)];
  } else if (mode === 'ladder-climb') {
    // Prefer seeds whose usage includes speed control (simpler, consistent).
    seedPool = [...seedPool].sort((a, b) => {
      const aSC = SPEED_CONTROL_KEYS.some((k) => usageHas(usageByKey.get(a.key), 'move', k)) ? 1 : 0;
      const bSC = SPEED_CONTROL_KEYS.some((k) => usageHas(usageByKey.get(b.key), 'move', k)) ? 1 : 0;
      return bSC - aSC;
    });
  }

  const candidates: TeamCandidate[] = [];
  const n = seedPool.length;
  for (let i = 0; i < n && candidates.length < count; i++) {
    const seed = seedPool[(seedOffset + i) % n];
    const rawGrown = growTeam([seed.key], teammatesByKey, displayByKey, 6, {
      exclude,
      allow,
    });
    // Defensive: hard-filter to honor constraints (build a fresh object).
    const filteredSpecies = rawGrown.species.filter(
      (k) => !exclude.has(k) && (!allow || allow.has(k)),
    );
    const grown = {
      species: filteredSpecies,
      displayNames: filteredSpecies.map((k) => displayByKey.get(k) ?? k),
    };
    if (grown.species.length < 4) continue;

    // Required move/item: at least one member must satisfy it.
    if (options.requiredMove) {
      const ok = grown.species.some((k) => usageHas(usageByKey.get(k), 'move', options.requiredMove!));
      if (!ok) continue;
    }
    if (options.requiredItem) {
      const ok = grown.species.some((k) => usageHas(usageByKey.get(k), 'held_item', options.requiredItem!));
      if (!ok) continue;
    }

    // Diversity dedup.
    if (candidates.some((c) => c.species.filter((s) => grown.species.includes(s)).length >= 4)) {
      continue;
    }

    const evidence: EvidenceLabel =
      mode === 'experimental'
        ? 'experimental'
        : grown.species.length === 6
          ? 'strong-evidence'
          : 'promising';

    candidates.push({
      species: grown.species,
      displayNames: grown.displayNames,
      locked: [seed.key],
      evidence,
      reasons: reasonsForMode(mode, seed.displayName),
    });
  }

  return candidates;
}

function reasonsForMode(mode: GenerationMode, seedName: string): string[] {
  switch (mode) {
    case 'proven':
      return [`Built around ${seedName} and its most common teammates.`, 'Meta support inferred from usage co-occurrence (not win rate).'];
    case 'meta-adjacent':
      return [`Proven core around ${seedName}, open to a less common pick that solves a matchup.`, 'Mostly meta with room for a spice slot.'];
    case 'counter-meta':
      return [`Seeded from ${seedName} to pressure common threats.`, 'Aimed at the most-used opposing Pokémon.'];
    case 'ladder-climb':
      return [`Consistency-first build around ${seedName} with speed control.`, 'Simple game plan, low prediction burden.'];
    case 'experimental':
      return [`Higher-novelty build around ${seedName}.`, 'Experimental — weaker evidence, more risk; test before trusting.'];
    case 'best-available':
      return [`Best team from your available Pokémon, built around ${seedName}.`, 'Restricted to Pokémon you marked available.'];
  }
}
