/**
 * Compare Teams engine (pure).
 *
 * Ranks/compares teams using the SAME score model, then explains the
 * difference category-by-category rather than just declaring a winner.
 */

import type { CategoryScore, ScoreWeights, TeamScore } from './team-score';
import { scoreTeam, type ScorableMember, DEFAULT_WEIGHTS } from './team-score';
import type { MetaSupportLookup } from './team-score';

export interface ScoredTeam {
  id: string;
  name: string;
  score: TeamScore;
}

export interface CategoryDelta {
  key: keyof ScoreWeights;
  label: string;
  a: number;
  b: number;
  delta: number; // b - a
}

export interface TeamComparison {
  a: ScoredTeam;
  b: ScoredTeam;
  totalDelta: number; // b.total - a.total
  categoryDeltas: CategoryDelta[];
  improved: CategoryDelta[]; // where b is meaningfully better than a
  weakened: CategoryDelta[]; // where b is meaningfully worse than a
  summary: string;
}

const MEANINGFUL = 5; // ignore sub-5-point noise in explanations

/** Score a list of teams and return them ranked best-first. */
export function rankTeams(
  teams: { id: string; name: string; members: ScorableMember[] }[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  meta?: MetaSupportLookup,
): ScoredTeam[] {
  return teams
    .map((t) => ({ id: t.id, name: t.name, score: scoreTeam(t.members, weights, meta) }))
    .sort((x, y) => y.score.total - x.score.total);
}

/** Compare two already-scored teams (b relative to a). */
export function compareScoredTeams(a: ScoredTeam, b: ScoredTeam): TeamComparison {
  const byKey = new Map<keyof ScoreWeights, CategoryScore>();
  for (const c of a.score.categories) byKey.set(c.key, c);

  const categoryDeltas: CategoryDelta[] = b.score.categories.map((cb) => {
    const ca = byKey.get(cb.key);
    const aScore = ca?.score ?? 0;
    return {
      key: cb.key,
      label: cb.label,
      a: aScore,
      b: cb.score,
      delta: cb.score - aScore,
    };
  });

  const improved = categoryDeltas
    .filter((d) => d.delta >= MEANINGFUL)
    .sort((x, y) => y.delta - x.delta);
  const weakened = categoryDeltas
    .filter((d) => d.delta <= -MEANINGFUL)
    .sort((x, y) => x.delta - y.delta);

  const totalDelta = b.score.total - a.score.total;
  const dir =
    Math.abs(totalDelta) < 1
      ? `${b.name} and ${a.name} score about the same`
      : totalDelta > 0
        ? `${b.name} scores ${totalDelta.toFixed(0)} higher than ${a.name}`
        : `${b.name} scores ${Math.abs(totalDelta).toFixed(0)} lower than ${a.name}`;

  const tradeoff =
    improved.length || weakened.length
      ? ` — better at ${improved.map((d) => d.label).join(', ') || 'nothing notable'}; worse at ${weakened.map((d) => d.label).join(', ') || 'nothing notable'}.`
      : '.';

  return {
    a,
    b,
    totalDelta,
    categoryDeltas,
    improved,
    weakened,
    summary: dir + tradeoff,
  };
}
