import { useCallback, useEffect, useState } from 'react';
import type { PokemonUsage } from '@/types/usage';
import { getAllUsageForFormat } from '@/db/usage-cache';
import { CURRENT_FORMAT, useUsageStore } from '@/stores/usage-store';
import {
  aggregateLeaders,
  findCommonCores,
  rankByTeammateCoOccurrence,
  type CoreEntry,
  type LeaderEntry,
  type MetaRankEntry,
} from '@/engine/meta-aggregator';

export interface MetaData {
  records: PokemonUsage[];
  ranking: MetaRankEntry[];
  cores: CoreEntry[];
  itemLeaders: LeaderEntry[];
  moveLeaders: LeaderEntry[];
  abilityLeaders: LeaderEntry[];
}

interface UseMetaResult {
  data: MetaData | null;
  loading: boolean;
  season: string | null;
  reload: () => Promise<void>;
}

/**
 * Loads all cached usage for the current Champions format+season and derives
 * the meta aggregates. Recomputes when the season changes (e.g. after a sync).
 */
export function useMeta(): UseMetaResult {
  const season = useUsageStore((s) => s.season);
  const cachedCount = useUsageStore((s) => s.cachedCount);
  const [data, setData] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    // Prefer the resolved season; fall back to "Current" (what the API stamps
    // on the root battle endpoint).
    const seasonsToTry = season ? [season, 'Current'] : ['Current'];
    let records: PokemonUsage[] = [];
    for (const s of seasonsToTry) {
      records = await getAllUsageForFormat(CURRENT_FORMAT, s);
      if (records.length > 0) break;
    }

    setData({
      records,
      ranking: rankByTeammateCoOccurrence(records),
      cores: findCommonCores(records, 20),
      itemLeaders: aggregateLeaders(records, 'held_item', 15),
      moveLeaders: aggregateLeaders(records, 'move', 15),
      abilityLeaders: aggregateLeaders(records, 'ability', 15),
    });
    setLoading(false);
  }, [season]);

  useEffect(() => {
    void reload();
    // cachedCount changes after a sync -> recompute.
  }, [reload, cachedCount]);

  return { data, loading, season, reload };
}
