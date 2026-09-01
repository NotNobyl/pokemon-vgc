/**
 * Off-Meta Discovery engine (pure, deterministic).
 *
 * Finds Pokémon/cores that appear UNDERUSED relative to a measurable signal —
 * not random low-usage picks. The Champions source has no win rates, so we use
 * defensible proxies from the teammate co-occurrence network and the type
 * chart, and we NEVER label anything "optimal", "broken", or a "meta killer".
 * Every finding carries an evidence label, a novelty estimate, a confidence,
 * and a suggested number of test matches.
 *
 * Methods:
 *  1. Usage-vs-centrality residual: a mon that many OTHER teams list as a
 *     teammate (high in-degree) but that isn't itself a popular seed is
 *     "underused relative to how well it fits". Positive residual = candidate.
 *  2. Meta coverage-gap: given the top threats' types, find lower-usage species
 *     that resist those threats and/or hit them super-effectively.
 *  3. Partner-lift: pairs that co-occur more than their individual popularity
 *     predicts (association, explicitly NOT causation).
 */

import type { PokemonType } from '@/types/pokemon';
import type { PokemonUsage } from '@/types/usage';
import { canonicalize } from '@/data/sources/showdown-mapping';
import { getEffectiveness } from './type-chart';

export type DiscoveryLabel = 'promising' | 'experimental' | 'speculative';

export interface DiscoveryFinding {
  key: string;
  displayName: string;
  /** 0..1 how far off-meta this is (higher = less used). */
  novelty: number;
  /** 0..1 confidence in the signal (data coverage / sample). */
  confidence: number;
  label: DiscoveryLabel;
  /** Why it was surfaced. */
  reasons: string[];
  /** Suggested number of ladder games to test before keeping/rejecting. */
  suggestedTestMatches: number;
}

function labelFor(novelty: number, confidence: number): DiscoveryLabel {
  if (confidence >= 0.6 && novelty < 0.7) return 'promising';
  if (confidence >= 0.4) return 'experimental';
  return 'speculative';
}

function testMatchesFor(confidence: number): number {
  // Less confidence => more games needed to judge.
  if (confidence >= 0.6) return 15;
  if (confidence >= 0.4) return 25;
  return 40;
}

/**
 * Method 1 — usage-vs-centrality residual.
 * in-degree = how many distinct other mons list X as a teammate (network fit).
 * seed popularity = X's own co-occurrence rank score.
 * residual = normalized in-degree - normalized seed popularity. A positive
 * residual means X is a frequent, well-fitting teammate that is itself less
 * "headlined" — an underused-relative-to-fit candidate.
 */
export function usageResidualFindings(
  records: PokemonUsage[],
  limit = 8,
): DiscoveryFinding[] {
  if (records.length === 0) return [];

  // In-degree: count distinct source mons that list each name as a teammate.
  const inDegree = new Map<string, number>();
  const displayByKey = new Map<string, string>();
  // Which names have their OWN source record (a "headlined" usage page).
  const hasOwnRecord = new Set<string>();
  for (const rec of records) {
    hasOwnRecord.add(canonicalize(rec.displayName));
    displayByKey.set(canonicalize(rec.displayName), rec.displayName);
    const seen = new Set<string>();
    for (const r of rec.rows) {
      if (r.category !== 'teammate' || !r.name) continue;
      const k = canonicalize(r.name);
      if (seen.has(k)) continue;
      seen.add(k);
      inDegree.set(k, (inDegree.get(k) ?? 0) + 1);
      if (!displayByKey.has(k)) displayByKey.set(k, r.name);
    }
  }
  const maxIn = Math.max(1, ...inDegree.values());

  const findings: DiscoveryFinding[] = [];
  for (const [key, deg] of inDegree) {
    const inNorm = deg / maxIn;
    // "Underused relative to fit": strong teammate in-degree, but either NOT a
    // headlined mon at all, or headlined far less than its teammate presence.
    const headlined = hasOwnRecord.has(key);
    // Residual is high when in-degree is high but it isn't itself a headliner.
    const residual = headlined ? inNorm * 0.3 : inNorm;
    if (residual <= 0.4) continue;

    const novelty = headlined ? 0.5 : 0.85; // non-headliners are more off-meta
    const confidence = Math.min(1, deg / 5); // more corroborating teams = surer
    findings.push({
      key,
      displayName: displayByKey.get(key) ?? key,
      novelty: Number(novelty.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
      label: labelFor(novelty, confidence),
      reasons: [
        `Listed as a teammate by ${deg} different teams${headlined ? '' : ', yet has no headline usage page of its own'} — underused relative to how often it fits.`,
        'Signal is teammate co-occurrence (association), not a win rate.',
      ],
      suggestedTestMatches: testMatchesFor(confidence),
    });
  }

  return findings
    .sort((a, b) => b.confidence - a.confidence || b.novelty - a.novelty)
    .slice(0, limit);
}

export interface CoverageCandidate {
  key: string;
  displayName: string;
  /** Threat display names this candidate answers (resists or threatens). */
  answers: string[];
  novelty: number;
  confidence: number;
  label: DiscoveryLabel;
  reasons: string[];
  suggestedTestMatches: number;
}

/**
 * Method 2 — meta coverage-gap.
 * @param topThreats the current top threats with their types.
 * @param dex all legal species with types (for candidate scanning).
 * @param popularity 0..1 popularity by canonical name (to bias toward low-usage).
 */
export function coverageGapFindings(
  topThreats: { name: string; types: PokemonType[] }[],
  dex: { name: string; types: PokemonType[] }[],
  popularity: (key: string) => number | null,
  limit = 8,
): CoverageCandidate[] {
  if (topThreats.length === 0 || dex.length === 0) return [];

  const results: CoverageCandidate[] = [];
  for (const cand of dex) {
    const key = canonicalize(cand.name);
    const pop = popularity(key) ?? 0;
    if (pop > 0.5) continue; // only lower-usage candidates are "off-meta"

    const answers: string[] = [];
    for (const threat of topThreats) {
      // Candidate "answers" a threat if it resists the threat's STAB types AND
      // can hit the threat super-effectively with one of its own types.
      const resistsThreat = threat.types.every(
        (t) => getEffectiveness(t, cand.types as [PokemonType]) <= 1,
      );
      const threatensBack = cand.types.some(
        (t) => getEffectiveness(t, threat.types as [PokemonType]) > 1,
      );
      if (resistsThreat && threatensBack) answers.push(threat.name);
    }
    if (answers.length < 2) continue; // must answer multiple top threats

    const novelty = 1 - pop;
    const confidence = Math.min(1, answers.length / topThreats.length);
    results.push({
      key,
      displayName: cand.name,
      answers,
      novelty: Number(novelty.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
      label: labelFor(novelty, confidence),
      reasons: [
        `Resists and threatens ${answers.length} common threats: ${answers.slice(0, 4).join(', ')}.`,
        `Currently low usage (${Math.round(pop * 100)}%), so opponents are less prepared for it.`,
        'Type-matchup heuristic only — verify sets and speed in practice.',
      ],
      suggestedTestMatches: testMatchesFor(confidence),
    });
  }

  return results
    .sort((a, b) => b.answers.length - a.answers.length || b.novelty - a.novelty)
    .slice(0, limit);
}

export function discoveryLabelText(l: DiscoveryLabel): string {
  switch (l) {
    case 'promising': return 'Promising';
    case 'experimental': return 'Experimental';
    case 'speculative': return 'Speculative';
  }
}

export interface OverlookedCore {
  a: string;
  b: string;
  /** 0..1 structural strength (defensive complementarity + coverage). */
  structureScore: number;
  /** 0..1 how little the pair is actually used together. */
  underuse: number;
  /** structureScore * underuse — high = strong on paper, rarely played. */
  opportunity: number;
  label: DiscoveryLabel;
  reasons: string[];
  suggestedTestMatches: number;
}

const ALL_TYPES_OM: PokemonType[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
  'steel', 'fairy',
];

function clamp01om(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function typeMult(atk: PokemonType, def: PokemonType[]): number {
  return def.reduce((m, d) => m * getEffectiveness(atk, [d]), 1);
}

/** How well two type profiles cover each other's weaknesses (0..1). */
function defensiveComplement(aTypes: PokemonType[], bTypes: PokemonType[]): number {
  let covered = 0;
  let weakTotal = 0;
  const check = (weakSide: PokemonType[], coverSide: PokemonType[]) => {
    for (const atk of ALL_TYPES_OM) {
      if (typeMult(atk, weakSide) <= 1) continue;
      weakTotal++;
      if (typeMult(atk, coverSide) < 1) covered++;
    }
  };
  check(aTypes, bTypes);
  check(bTypes, aTypes);
  return weakTotal === 0 ? 0.5 : covered / weakTotal;
}

/** Fraction of the 18 types the pair hits super-effectively with STAB (0..1). */
function combinedCoverage(aTypes: PokemonType[], bTypes: PokemonType[]): number {
  let hit = 0;
  for (const def of ALL_TYPES_OM) {
    const canHit = [...aTypes, ...bTypes].some((atk) => getEffectiveness(atk, [def]) > 1);
    if (canHit) hit++;
  }
  return hit / ALL_TYPES_OM.length;
}

/**
 * Overlooked cores: pairs that are STRUCTURALLY strong (cover each other's
 * weaknesses + broad combined coverage) but rarely used together — targeting
 * on-paper-excellent pairings a young meta hasn't adopted. Type-chart signal
 * plus optional moveset/speed coherence when a resolver is supplied.
 *
 * @param dex candidate species with types (caller keeps the pool reasonable).
 * @param coOccurrence 0..1 how often the pair is ALREADY used together.
 * @param coherenceOf optional: returns 0..1 moveset/speed coherence for a pair
 *   (from analyzeCore). When provided, it modulates the opportunity score and
 *   adds a reason, so structurally-strong-but-incoherent pairs rank lower.
 */
export function overlookedCores(
  dex: { name: string; types: PokemonType[] }[],
  coOccurrence: (aKey: string, bKey: string) => number,
  limit = 8,
  coherenceOf?: (aName: string, bName: string) => number | null,
): OverlookedCore[] {
  const results: OverlookedCore[] = [];
  for (let i = 0; i < dex.length; i++) {
    for (let j = i + 1; j < dex.length; j++) {
      const a = dex[i];
      const b = dex[j];
      const complement = defensiveComplement(a.types, b.types);
      const coverage = combinedCoverage(a.types, b.types);
      let structureScore = clamp01om(0.6 * complement + 0.4 * coverage);
      if (structureScore < 0.55) continue;

      const used = coOccurrence(canonicalize(a.name), canonicalize(b.name));
      const underuse = 1 - clamp01om(used);
      if (underuse < 0.5) continue;

      // Fold in moveset/speed coherence when available.
      const reasons = [
        `${a.name} + ${b.name} cover each other defensively and together threaten many types (structure ${Math.round(structureScore * 100)}%).`,
        'Rarely used together in current usage — a potential blind spot in a young meta.',
      ];
      const coherence = coherenceOf?.(a.name, b.name);
      if (typeof coherence === 'number') {
        // Blend structure with real kit/speed coherence.
        structureScore = clamp01om(0.6 * structureScore + 0.4 * coherence);
        reasons.push(
          coherence >= 0.5
            ? `Movesets/speed look coherent together (${Math.round(coherence * 100)}%).`
            : `But movesets/speed coherence is only ${Math.round(coherence * 100)}% — verify roles and speed control before trusting it.`,
        );
      } else {
        reasons.push('Structural (type-chart) signal only; verify sets, speed, and roles in practice.');
      }

      const opportunity = structureScore * underuse;
      results.push({
        a: a.name,
        b: b.name,
        structureScore: Number(structureScore.toFixed(2)),
        underuse: Number(underuse.toFixed(2)),
        opportunity: Number(opportunity.toFixed(2)),
        label: labelFor(underuse, structureScore),
        reasons,
        suggestedTestMatches: testMatchesFor(structureScore),
      });
    }
  }
  return results.sort((x, y) => y.opportunity - x.opportunity).slice(0, limit);
}
