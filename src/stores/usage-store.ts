import { create } from 'zustand';
import type {
  PokemonUsage,
  UsageFormat,
  UsageRow,
  UsageCategory,
} from '@/types/usage';
import type { ConfidenceResult } from '@/types/usage';
import {
  bulkPutUsage,
  getLatestSyncTime,
  getLatestUsage,
  getUsageCount,
} from '@/db/usage-cache';
import {
  ATTRIBUTION,
  ATTRIBUTION_URL,
  fetchIndex,
  syncUsage,
  type ChampionsIndex,
  type SyncProgress,
} from '@/data/sources/champions-battle-data';
import { confidenceFromProvenance } from '@/engine/confidence';

/** Champions is Doubles-only focus for now. */
export const CURRENT_FORMAT: UsageFormat = 'Doubles';

interface UsageState {
  index: ChampionsIndex | null;
  season: string | null;
  cachedCount: number;
  lastSyncAt: string | null;
  isSyncing: boolean;
  syncProgress: SyncProgress | null;
  syncError: string | null;
  lastSyncSummary: { succeeded: number; failed: number } | null;
  attribution: string;
  attributionUrl: string;

  /** Load cache metadata (count + last sync) on app start. */
  hydrate: () => Promise<void>;
  /** Fetch the index (resolves current season + species list). */
  loadIndex: () => Promise<ChampionsIndex | null>;
  /** Full sync of all indexed Pokémon for the current format. */
  syncAll: () => Promise<void>;
  cancelSync: () => void;
}

let abortController: AbortController | null = null;

export const useUsageStore = create<UsageState>((set, get) => ({
  index: null,
  season: null,
  cachedCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  syncProgress: null,
  syncError: null,
  lastSyncSummary: null,
  attribution: ATTRIBUTION,
  attributionUrl: ATTRIBUTION_URL,

  async hydrate() {
    const [cachedCount, lastSyncAt] = await Promise.all([
      getUsageCount(),
      getLatestSyncTime(),
    ]);
    set({ cachedCount, lastSyncAt });
  },

  async loadIndex() {
    const index = await fetchIndex();
    if (index) {
      set({ index, season: index.season, syncError: null });
    } else {
      set({ syncError: 'Could not reach the Champions Battle Data API.' });
    }
    return index;
  },

  async syncAll() {
    if (get().isSyncing) return;
    set({ isSyncing: true, syncError: null, lastSyncSummary: null });

    let index = get().index;
    if (!index) index = await get().loadIndex();
    if (!index) {
      set({ isSyncing: false });
      return;
    }

    abortController = new AbortController();
    const batch: PokemonUsage[] = [];

    const result = await syncUsage(index.entries, CURRENT_FORMAT, index.season, {
      signal: abortController.signal,
      onProgress: (syncProgress) => set({ syncProgress }),
      onRecord: async (record) => {
        batch.push(record);
        // Flush periodically so progress is durable even if interrupted.
        if (batch.length >= 20) {
          await bulkPutUsage(batch.splice(0, batch.length));
        }
      },
    });

    if (batch.length > 0) await bulkPutUsage(batch);

    const [cachedCount, lastSyncAt] = await Promise.all([
      getUsageCount(),
      getLatestSyncTime(),
    ]);

    set({
      isSyncing: false,
      syncProgress: null,
      cachedCount,
      lastSyncAt,
      lastSyncSummary: { succeeded: result.succeeded, failed: result.failed },
    });
    abortController = null;
  },

  cancelSync() {
    abortController?.abort();
    set({ isSyncing: false, syncProgress: null });
  },
}));

/** Non-hook helper: get cached usage for a Pokémon by showdown id. */
export async function getUsageForShowdownId(
  showdownId: string,
): Promise<PokemonUsage | undefined> {
  return getLatestUsage(showdownId, CURRENT_FORMAT);
}

/** Filter helper: top-N rows of a category, sorted by rank. */
export function topRows(
  usage: PokemonUsage | undefined,
  category: UsageCategory,
  limit = 5,
): UsageRow[] {
  if (!usage) return [];
  return usage.rows
    .filter((r) => r.category === category)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

/** Completeness heuristic: fraction of expected categories present. */
export function usageCompleteness(usage: PokemonUsage | undefined): number {
  if (!usage) return 0;
  const expected: UsageCategory[] = [
    'move',
    'held_item',
    'ability',
    'teammate',
    'stat_alignment',
    'stat_points',
  ];
  const present = new Set(usage.rows.map((r) => r.category));
  return expected.filter((c) => present.has(c)).length / expected.length;
}

/** Confidence for a cached record in the current Champions context. */
export function usageConfidence(
  usage: PokemonUsage | undefined,
  currentSeason: string | null,
): ConfidenceResult | null {
  if (!usage) return null;
  return confidenceFromProvenance(usage.provenance, {
    currentFormat: CURRENT_FORMAT,
    currentSeason: currentSeason ?? usage.season,
    completeness: usageCompleteness(usage),
  });
}
