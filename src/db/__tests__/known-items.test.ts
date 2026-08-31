import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getKnownItems, putUsage } from '@/db/usage-cache';
import { db } from '@/db/database';
import type { PokemonUsage } from '@/types/usage';

function usageWithItems(name: string, items: string[]): PokemonUsage {
  return {
    key: `${name}|Doubles|M5`,
    showdownId: name.toLowerCase(),
    displayName: name,
    format: 'Doubles',
    season: 'M5',
    rows: items.map((it, i) => ({
      category: 'held_item' as const,
      rank: i + 1,
      name: it,
      percentage: 50 - i,
    })),
    provenance: {
      source: 'champions-battle-data',
      attribution: 't',
      sourceUrl: 't',
      format: 'Doubles',
      season: 'M5',
      retrievedAt: new Date().toISOString(),
      transformVersion: 1,
    },
  };
}

describe('getKnownItems', () => {
  beforeEach(async () => {
    await db.usageData.clear();
  });

  it('returns the bundled fallback list even with no synced usage', async () => {
    const items = await getKnownItems();
    expect(items.length).toBeGreaterThan(20);
    // A well-known item the user specifically mentioned.
    expect(items.map((i) => i.toLowerCase())).toContain('mystic water');
  });

  it('ranks synced usage items ahead of fallback-only items', async () => {
    await putUsage(usageWithItems('Palafin', ['Mystic Water', 'Choice Band']));
    const items = await getKnownItems();
    // Both synced items appear before any fallback-only item. "Air Balloon"
    // is fallback-only and alphabetically early, so it must still come AFTER
    // the synced items.
    const idxMystic = items.indexOf('Mystic Water');
    const idxChoice = items.indexOf('Choice Band');
    const idxAirBalloon = items.indexOf('Air Balloon');
    expect(idxMystic).toBeGreaterThanOrEqual(0);
    expect(idxChoice).toBeGreaterThanOrEqual(0);
    expect(idxMystic).toBeLessThan(idxAirBalloon);
    expect(idxChoice).toBeLessThan(idxAirBalloon);
  });

  it('de-duplicates case-insensitively between usage and fallback', async () => {
    await putUsage(usageWithItems('X', ['Leftovers']));
    const items = await getKnownItems();
    const leftovers = items.filter((i) => i.toLowerCase() === 'leftovers');
    expect(leftovers).toHaveLength(1);
  });
});
