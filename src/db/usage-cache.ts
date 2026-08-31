import type { PokemonUsage, UsageFormat } from '@/types/usage';
import { db } from './database';
import commonItemsData from '@/data/common-items.json';

/** Build the composite primary key used for the usageData table. */
export function usageKey(
  showdownId: string,
  format: UsageFormat,
  season: string,
): string {
  return `${showdownId}|${format}|${season}`;
}

export async function getUsage(
  showdownId: string,
  format: UsageFormat,
  season: string,
): Promise<PokemonUsage | undefined> {
  return db.usageData.get(usageKey(showdownId, format, season));
}

/**
 * Get the most recently retrieved usage record for a Pokémon + format,
 * regardless of season. Useful for "show whatever we have cached".
 */
export async function getLatestUsage(
  showdownId: string,
  format: UsageFormat,
): Promise<PokemonUsage | undefined> {
  const matches = await db.usageData
    .where('showdownId')
    .equals(showdownId)
    .filter((u) => u.format === format)
    .toArray();
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) =>
    b.provenance.retrievedAt.localeCompare(a.provenance.retrievedAt),
  )[0];
}

/**
 * Store a usage record, but never overwrite a newer valid record with an older
 * or less-complete one (per the data-integrity directive).
 */
export async function putUsage(record: PokemonUsage): Promise<void> {
  const existing = await db.usageData.get(record.key);
  if (existing) {
    const existingTime = Date.parse(existing.provenance.retrievedAt);
    const incomingTime = Date.parse(record.provenance.retrievedAt);
    const incomingHasFewerRows = record.rows.length < existing.rows.length;
    // Reject strictly older data; reject same-time data that is less complete.
    if (incomingTime < existingTime) return;
    if (incomingTime === existingTime && incomingHasFewerRows) return;
  }
  await db.usageData.put(record);
}

export async function bulkPutUsage(records: PokemonUsage[]): Promise<void> {
  for (const record of records) {
    await putUsage(record);
  }
}

export async function getUsageCount(): Promise<number> {
  return db.usageData.count();
}

/** All cached usage rows for a format+season (for the meta dashboard). */
export async function getAllUsageForFormat(
  format: UsageFormat,
  season: string,
): Promise<PokemonUsage[]> {
  return db.usageData
    .where('format')
    .equals(format)
    .filter((u) => u.season === season)
    .toArray();
}

/** The newest retrievedAt timestamp across all cached usage, or null. */
export async function getLatestSyncTime(): Promise<string | null> {
  const all = await db.usageData.toArray();
  if (all.length === 0) return null;
  return all
    .map((u) => u.provenance.retrievedAt)
    .sort((a, b) => b.localeCompare(a))[0];
}

export async function clearUsage(): Promise<void> {
  await db.usageData.clear();
}

/**
 * Distinct held-item names for the item picker. Combines items observed in
 * cached Champions usage (ranked first by how many Pokémon run them) with a
 * bundled fallback list of common VGC items, so the picker ALWAYS has content
 * even before any usage data is synced (offline-first). De-duplicated
 * case-insensitively; synced/meta items take precedence in ordering.
 */
export async function getKnownItems(): Promise<string[]> {
  const all = await db.usageData.toArray();
  const counts = new Map<string, number>();
  for (const rec of all) {
    for (const row of rec.rows) {
      if (row.category === 'held_item' && row.name) {
        counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
      }
    }
  }

  const fromUsage = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  // Merge with bundled fallback, de-duplicating case-insensitively.
  const seen = new Set(fromUsage.map((n) => n.toLowerCase()));
  const fallback = (commonItemsData as { items: string[] }).items
    .filter((n) => !seen.has(n.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return [...fromUsage, ...fallback];
}
