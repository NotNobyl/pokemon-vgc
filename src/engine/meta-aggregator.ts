/**
 * Meta aggregation engine (pure, no React / no network).
 *
 * IMPORTANT DATA CAVEAT: the Champions Battle Data API does NOT expose a global
 * per-Pokémon usage percentage or ranking. It exposes, per Pokémon, that mon's
 * most common moves/items/abilities/natures/spreads and its most common
 * TEAMMATES. We therefore derive a defensible popularity signal from teammate
 * co-occurrence (a degree-centrality proxy): a Pokémon that appears as a common
 * teammate of many other Pokémon is, by construction, widely used.
 *
 * This is clearly labeled in the UI as "teammate co-occurrence", NOT official
 * usage %, honoring the directive to never present derived data as certainty.
 */

import type { PokemonUsage, UsageRow } from '@/types/usage';
import { canonicalize } from '@/data/sources/showdown-mapping';

export interface MetaRankEntry {
  /** Canonical key used for grouping (canonicalized name). */
  key: string;
  /** Best display name we saw for this Pokémon. */
  displayName: string;
  /** How many distinct other Pokémon list this one as a teammate. */
  coOccurrence: number;
  /** Normalized 0..100 score relative to the top entry. */
  score: number;
}

/**
 * Rank Pokémon by teammate co-occurrence across all synced usage records.
 * Returns entries sorted descending by co-occurrence.
 */
export function rankByTeammateCoOccurrence(
  records: PokemonUsage[],
): MetaRankEntry[] {
  const counts = new Map<string, { name: string; count: number }>();

  for (const rec of records) {
    const teammates = rec.rows.filter((r) => r.category === 'teammate');
    // Each teammate mention from a distinct source Pokémon counts once.
    const seenThisRecord = new Set<string>();
    for (const t of teammates) {
      if (!t.name) continue;
      const key = canonicalize(t.name);
      if (seenThisRecord.has(key)) continue;
      seenThisRecord.add(key);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { name: t.name, count: 1 });
      }
    }
  }

  const entries = [...counts.entries()].map(([key, v]) => ({
    key,
    displayName: v.name,
    coOccurrence: v.count,
    score: 0,
  }));

  entries.sort((a, b) => b.coOccurrence - a.coOccurrence);
  const max = entries.length > 0 ? entries[0].coOccurrence : 1;
  for (const e of entries) {
    e.score = max > 0 ? (e.coOccurrence / max) * 100 : 0;
  }
  return entries;
}

export interface CoreEntry {
  members: [string, string];
  /** Number of times the pair mutually/directionally appears together. */
  strength: number;
  mutual: boolean;
}

/**
 * Find common 2-Pokémon cores from the teammate graph. A pair is stronger when
 * BOTH list each other (mutual). We count directed edges and flag mutuality.
 */
export function findCommonCores(
  records: PokemonUsage[],
  limit = 20,
): CoreEntry[] {
  // Map from source canonical key -> set of teammate canonical keys.
  const edges = new Map<string, Map<string, string>>(); // src -> (dstKey -> dstName)
  const nameByKey = new Map<string, string>();

  for (const rec of records) {
    const srcKey = canonicalize(rec.displayName);
    nameByKey.set(srcKey, rec.displayName);
    const dst = edges.get(srcKey) ?? new Map<string, string>();
    for (const r of rec.rows) {
      if (r.category !== 'teammate' || !r.name) continue;
      const dstKey = canonicalize(r.name);
      dst.set(dstKey, r.name);
      if (!nameByKey.has(dstKey)) nameByKey.set(dstKey, r.name);
    }
    edges.set(srcKey, dst);
  }

  const pairStrength = new Map<string, { members: [string, string]; strength: number; mutual: boolean }>();

  for (const [srcKey, dsts] of edges) {
    for (const [dstKey] of dsts) {
      if (srcKey === dstKey) continue;
      // Canonical unordered pair id.
      const [a, b] = srcKey < dstKey ? [srcKey, dstKey] : [dstKey, srcKey];
      const pairId = `${a}|${b}`;
      const reverseMutual = edges.get(dstKey)?.has(srcKey) ?? false;
      const existing = pairStrength.get(pairId);
      if (existing) {
        existing.strength += 1;
        existing.mutual = existing.mutual || reverseMutual;
      } else {
        pairStrength.set(pairId, {
          members: [nameByKey.get(a) ?? a, nameByKey.get(b) ?? b],
          strength: 1,
          mutual: reverseMutual,
        });
      }
    }
  }

  return [...pairStrength.values()]
    .sort((x, y) => {
      // Mutual pairs first, then by strength.
      if (x.mutual !== y.mutual) return x.mutual ? -1 : 1;
      return y.strength - x.strength;
    })
    .slice(0, limit);
}

export interface LeaderEntry {
  name: string;
  /** Sum of usage percentages across records that reported it. */
  totalPercentage: number;
  /** Number of Pokémon that run this item/move/ability. */
  count: number;
}

/**
 * Aggregate the most common items / moves / abilities across the meta,
 * weighting by the per-Pokémon usage % where available.
 */
export function aggregateLeaders(
  records: PokemonUsage[],
  category: 'held_item' | 'move' | 'ability',
  limit = 15,
): LeaderEntry[] {
  const map = new Map<string, LeaderEntry>();
  for (const rec of records) {
    for (const r of rec.rows) {
      if (r.category !== category || !r.name) continue;
      const existing = map.get(r.name);
      const pct = r.percentage ?? 0;
      if (existing) {
        existing.totalPercentage += pct;
        existing.count += 1;
      } else {
        map.set(r.name, { name: r.name, totalPercentage: pct, count: 1 });
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.totalPercentage - a.totalPercentage)
    .slice(0, limit);
}

export interface TrendPoint {
  date: string; // ISO or DD_MM_YYYY as provided
  rows: UsageRow[];
}

/** Champions daily dates are DD_MM_YYYY; convert to ISO for display/sorting. */
export function championsDateToIso(ddmmyyyy: string): string {
  const m = /^(\d{2})_(\d{2})_(\d{4})$/.exec(ddmmyyyy);
  if (!m) return ddmmyyyy;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}
