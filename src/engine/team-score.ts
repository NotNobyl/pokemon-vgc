/**
 * Team score model (pure, versioned, explainable).
 *
 * Produces a transparent breakdown — NOT a black-box AI number. Every category
 * is computed from deterministic engine outputs (synergy, role coverage, type
 * chart) plus optional usage data. Usage-derived signals are clearly INFERRED,
 * never presented as observed win rates (the source exposes no win rates).
 *
 * Confidence uses shrinkage: a team leaning on high-usage, well-sampled meta
 * Pokémon is more "supported" than one built on unseen picks, but a small
 * sample never dominates. Weights are configurable; the model version is
 * stamped so recommendations remain reproducible/auditable.
 */

import type { PokemonType, BaseStats, Nature } from '@/types/pokemon';
import { analyzeSynergy, checkRoleCoverage } from './synergy-analyzer';
import { analyzeCore, type AnalyzableMember } from './team-analysis';
import type { StatPointSpread } from './champions-stat';
import { canonicalize } from '@/data/sources/showdown-mapping';

export const TEAM_SCORE_MODEL_VERSION = 2;

/** Configurable category weights (sum need not be 1; total is normalized). */
export interface ScoreWeights {
  defensiveSynergy: number;
  offensiveCoverage: number;
  speedControl: number;
  roleCompression: number;
  metaSupport: number; // INFERRED from usage co-occurrence, not win rate
  speedCoherence: number; // fast/slow coherence + no speed redundancy (approx)
  sharedWeaknessPenalty: number;
  itemConflictPenalty: number;
  redundancyPenalty: number; // anti-synergy: conflicting weather, overlap, etc.
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  defensiveSynergy: 1,
  offensiveCoverage: 1,
  speedControl: 1,
  roleCompression: 0.8,
  metaSupport: 0.6,
  speedCoherence: 0.8,
  sharedWeaknessPenalty: 1,
  itemConflictPenalty: 0.5,
  redundancyPenalty: 0.7,
};

/** A resolved team member for scoring (already joined with dex data). */
export interface ScorableMember {
  name: string;
  types: PokemonType[];
  moves: string[];
  moveTypes: PokemonType[];
  ability: string;
  item: string;
  /** Base stats — enables speed-coherence + anti-synergy analysis. */
  baseStats?: BaseStats;
  /** Real Champions Stat Point spread + alignment — enables EXACT speed. */
  statPoints?: StatPointSpread;
  statAlignment?: Nature;
}

export interface CategoryScore {
  key: keyof ScoreWeights;
  label: string;
  /** 0..100 for this category (penalties are inverted so higher is better). */
  score: number;
  /** Short plain-language explanation. */
  detail: string;
}

export interface TeamScore {
  modelVersion: number;
  /** 0..100 overall, weight-normalized. */
  total: number;
  categories: CategoryScore[];
  /** 0..1 confidence in the meta-support signal (shrinkage-adjusted). */
  confidence: number;
  confidenceLabel: 'low' | 'moderate' | 'high';
  strengths: string[];
  weaknesses: string[];
  /** What the score is based on, for the UI's evidence panel. */
  evidence: string[];
}

/** Usage lookup: returns teammate-co-occurrence rank info for a species, or null. */
export interface MetaSupportLookup {
  /** 0..1 normalized popularity of this species (from teammate co-occurrence). */
  popularity: (canonicalName: string) => number | null;
}

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/**
 * Shrinkage: pull a raw mean toward a prior (0.5) based on sample size n and a
 * prior strength k. Prevents tiny samples from dominating.
 */
export function shrink(rawMean: number, n: number, prior = 0.5, k = 5): number {
  if (n <= 0) return prior;
  return (rawMean * n + prior * k) / (n + k);
}

export function scoreTeam(
  members: ScorableMember[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  meta?: MetaSupportLookup,
): TeamScore {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const evidence: string[] = [
    'Type synergy, offensive coverage, and role coverage are calculated deterministically from the team.',
  ];

  const memberTypes = members.map(
    (m) => m.types as [PokemonType] | [PokemonType, PokemonType],
  );
  const moveTypesPerMember = members.map((m) => m.moveTypes);
  const synergy = analyzeSynergy(memberTypes, moveTypesPerMember);
  const roles = checkRoleCoverage(
    members.map((m) => ({ name: m.name, moves: m.moves, ability: m.ability })),
  );

  // --- Defensive synergy: fewer shared weaknesses = better. ---
  const sharedWeakCount = [...synergy.criticalWeaknesses.values()].length;
  const maxWeakStack = Math.max(0, ...[...synergy.weaknesses.values()]);
  const defensiveSynergy = clamp100(100 - maxWeakStack * 12 - sharedWeakCount * 8);
  if (sharedWeakCount === 0) strengths.push('No 3+ shared type weaknesses.');
  else weaknesses.push(`${sharedWeakCount} type(s) hit 3+ members super-effectively.`);

  // --- Offensive coverage: fraction of types hit super-effectively. ---
  const coveredCount = [...synergy.offensiveCoverage.values()].filter(Boolean).length;
  const offensiveCoverage = clamp100((coveredCount / 18) * 100);
  if (offensiveCoverage >= 78) strengths.push('Broad super-effective coverage.');
  if (synergy.uncoveredTypes.length > 0) {
    weaknesses.push(
      `No answer to: ${synergy.uncoveredTypes.slice(0, 4).join(', ')}.`,
    );
  }

  // --- Speed control. ---
  const speedControl = roles.hasSpeedControl ? 100 : 25;
  if (roles.hasSpeedControl) strengths.push('Has speed control.');
  else weaknesses.push('No speed control (Tailwind/Trick Room/Icy Wind).');

  // --- Role compression: how many key roles are filled. ---
  const roleFlags = [
    roles.hasSpeedControl,
    roles.hasFakeOut,
    roles.hasRedirection,
    roles.hasIntimidation,
    roles.hasPriorityMoves,
    roles.hasWeatherSetter,
  ];
  const rolesFilled = roleFlags.filter(Boolean).length;
  const roleCompression = clamp100((rolesFilled / roleFlags.length) * 100);
  if (roles.hasFakeOut) strengths.push('Has Fake Out pressure.');
  if (roles.hasRedirection) strengths.push('Has redirection support.');

  // --- Meta support (INFERRED from usage co-occurrence popularity). ---
  let metaSupport = 50;
  let confidence = 0.2; // low until usage actually covers the team
  if (meta) {
    const pops = members
      .map((m) => meta.popularity(canonicalize(m.name)))
      .filter((p): p is number => p !== null);
    if (pops.length > 0) {
      const rawMean = pops.reduce((a, b) => a + b, 0) / pops.length;
      // Shrink toward 0.5 by how many members we actually have data for.
      const shrunk = shrink(rawMean, pops.length, 0.5, 3);
      metaSupport = clamp100(shrunk * 100);
      confidence = Math.min(1, pops.length / members.length);
      evidence.push(
        `Meta support is INFERRED from teammate co-occurrence for ${pops.length}/${members.length} members (not win rate).`,
      );
    } else {
      evidence.push('No cached usage matched this team; meta support is a neutral prior.');
    }
  } else {
    evidence.push('Usage data not provided; meta support is a neutral prior.');
  }

  // --- Penalties (inverted to 0..100 where higher = fewer problems). ---
  const items = members.map((m) => m.item?.toLowerCase()).filter(Boolean);
  const dupItems = items.length - new Set(items).size;
  const itemConflictPenalty = clamp100(100 - dupItems * 40);
  if (dupItems > 0) weaknesses.push(`${dupItems} duplicate held item(s) — illegal.`);

  const sharedWeaknessPenalty = clamp100(100 - sharedWeakCount * 20 - Math.max(0, maxWeakStack - 2) * 15);

  // --- Deeper analysis: speed coherence + anti-synergy (approximate). ---
  // Only if base stats are available for members.
  let speedCoherence = 60; // neutral-ish when unknown
  let redundancyPenalty = 100;
  const membersWithStats = members.filter((m) => m.baseStats);
  if (membersWithStats.length === members.length && members.length >= 2) {
    const analyzable: AnalyzableMember[] = members.map((m) => ({
      name: m.name,
      baseStats: m.baseStats!,
      moves: m.moves,
      ability: m.ability,
      statPoints: m.statPoints,
      statAlignment: m.statAlignment,
    }));
    const core = analyzeCore(analyzable);
    speedCoherence = clamp100(core.coherence * 100);
    redundancyPenalty = clamp100(100 - core.issues.length * 18);
    for (const s of core.synergies) strengths.push(s);
    for (const iss of core.issues) weaknesses.push(iss);
    evidence.push(
      core.speed.exact
        ? 'Speed coherence uses EXACT Champions stats from real Stat Point spreads.'
        : 'Speed coherence uses base stats + a max-invested proxy (approximate — sync usage for exact spreads).',
    );
  } else {
    evidence.push('Speed/anti-synergy analysis skipped (missing base stats for some members).');
  }

  const categories: CategoryScore[] = [
    { key: 'defensiveSynergy', label: 'Defensive Synergy', score: defensiveSynergy, detail: `Max ${maxWeakStack} members share a weakness.` },
    { key: 'offensiveCoverage', label: 'Offensive Coverage', score: offensiveCoverage, detail: `${coveredCount}/18 types hit super-effectively.` },
    { key: 'speedControl', label: 'Speed Control', score: speedControl, detail: roles.hasSpeedControl ? 'Present.' : 'Missing.' },
    { key: 'speedCoherence', label: 'Speed Coherence (approx)', score: speedCoherence, detail: 'Fast/slow/TR coherence + speed-tier spread.' },
    { key: 'roleCompression', label: 'Role Compression', score: roleCompression, detail: `${rolesFilled}/6 key roles filled.` },
    { key: 'metaSupport', label: 'Meta Support (inferred)', score: metaSupport, detail: 'From usage co-occurrence, not win rate.' },
    { key: 'sharedWeaknessPenalty', label: 'Weakness Safety', score: sharedWeaknessPenalty, detail: 'Higher = fewer stacked weaknesses.' },
    { key: 'itemConflictPenalty', label: 'Item Legality', score: itemConflictPenalty, detail: dupItems > 0 ? 'Duplicate items present.' : 'No item conflicts.' },
    { key: 'redundancyPenalty', label: 'Anti-Synergy Safety', score: redundancyPenalty, detail: 'Higher = fewer conflicting weathers / overlaps.' },
  ];

  // Weighted, normalized total.
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  const weighted = categories.reduce(
    (sum, c) => sum + c.score * weights[c.key],
    0,
  );
  const total = clamp100(weightSum > 0 ? weighted / weightSum : 0);

  const confidenceLabel: TeamScore['confidenceLabel'] =
    confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'moderate' : 'low';

  return {
    modelVersion: TEAM_SCORE_MODEL_VERSION,
    total,
    categories,
    confidence,
    confidenceLabel,
    strengths,
    weaknesses,
    evidence,
  };
}
