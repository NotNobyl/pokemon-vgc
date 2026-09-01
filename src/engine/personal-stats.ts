/**
 * Personal match-history analytics (pure, deterministic).
 *
 * Turns logged battles into PERSONAL insights — kept strictly separate from
 * global meta data. Applies minimum-sample handling and shrinkage so a 1–2 game
 * streak never masquerades as a reliable win rate. All outputs are labeled
 * "observed (personal)" by the UI, never blended with usage stats.
 */

import type { BattleLog } from '@/types/battle-log';
import { shrink } from './team-score';

export interface RecordStat {
  /** Grouping key (teamId, lead pair, etc.). */
  key: string;
  label: string;
  wins: number;
  losses: number;
  games: number;
  /** Raw win rate 0..1 (undefined shown as — in UI). */
  rawWinRate: number;
  /** Shrinkage-adjusted win rate 0..1 (pulled toward 0.5 for small n). */
  adjustedWinRate: number;
  /** True once games >= minSample; below that, treat as provisional. */
  reliable: boolean;
}

export interface PersonalReport {
  totalGames: number;
  wins: number;
  losses: number;
  overallWinRate: number;
  byTeam: RecordStat[];
  byLead: RecordStat[];
  /** Recurring loss tags across the sample, most frequent first. */
  lossPatterns: { tag: string; count: number }[];
  minSample: number;
}

function buildStat(
  key: string,
  label: string,
  logs: BattleLog[],
  minSample: number,
): RecordStat {
  const wins = logs.filter((l) => l.result === 'win').length;
  const losses = logs.filter((l) => l.result === 'loss').length;
  const games = wins + losses;
  const rawWinRate = games > 0 ? wins / games : 0;
  // Shrink toward 0.5 with a prior strength of 2× minSample, so a tiny hot
  // streak (e.g. 2-0) cannot outrank a well-sampled solid record (e.g. 7-3).
  const adjustedWinRate = shrink(rawWinRate, games, 0.5, minSample * 2);
  return {
    key,
    label,
    wins,
    losses,
    games,
    rawWinRate,
    adjustedWinRate,
    reliable: games >= minSample,
  };
}

/**
 * Compute a personal report from battle logs.
 * @param teamNameById resolves a teamId to a display name.
 * @param minSample games required before a split is considered reliable.
 */
export function computePersonalReport(
  logs: BattleLog[],
  teamNameById: (id: string) => string,
  minSample = 5,
): PersonalReport {
  const wins = logs.filter((l) => l.result === 'win').length;
  const losses = logs.filter((l) => l.result === 'loss').length;
  const totalGames = wins + losses;

  // By team.
  const byTeamMap = new Map<string, BattleLog[]>();
  for (const l of logs) {
    const arr = byTeamMap.get(l.teamId) ?? [];
    arr.push(l);
    byTeamMap.set(l.teamId, arr);
  }
  const byTeam = [...byTeamMap.entries()]
    .map(([id, ls]) => buildStat(id, teamNameById(id), ls, minSample))
    .sort((a, b) => b.adjustedWinRate - a.adjustedWinRate || b.games - a.games);

  // By lead (first 2 brought, order-independent).
  const byLeadMap = new Map<string, BattleLog[]>();
  for (const l of logs) {
    if (l.brought.length < 2) continue;
    const lead = [...l.brought].slice(0, 2).sort().join(' + ');
    const arr = byLeadMap.get(lead) ?? [];
    arr.push(l);
    byLeadMap.set(lead, arr);
  }
  const byLead = [...byLeadMap.entries()]
    .map(([lead, ls]) => buildStat(lead, lead, ls, minSample))
    .sort((a, b) => b.adjustedWinRate - a.adjustedWinRate || b.games - a.games);

  // Loss patterns from tags.
  const tagCounts = new Map<string, number>();
  for (const l of logs.filter((x) => x.result === 'loss')) {
    for (const t of l.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const lossPatterns = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalGames,
    wins,
    losses,
    overallWinRate: totalGames > 0 ? wins / totalGames : 0,
    byTeam,
    byLead,
    lossPatterns,
    minSample,
  };
}

/**
 * Decide whether a recurring loss pattern warrants suggesting a change.
 * Requires the pattern to appear in at least `minOccurrences` losses — so we
 * don't recommend swapping a Pokémon after one or two losses.
 */
export function patternWarrantsChange(
  count: number,
  minOccurrences = 3,
): boolean {
  return count >= minOccurrences;
}
