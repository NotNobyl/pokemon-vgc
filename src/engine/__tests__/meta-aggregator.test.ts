import { describe, expect, it } from 'vitest';
import {
  aggregateLeaders,
  championsDateToIso,
  findCommonCores,
  rankByTeammateCoOccurrence,
} from '@/engine/meta-aggregator';
import type { PokemonUsage, UsageRow } from '@/types/usage';

function mkUsage(name: string, rows: Partial<UsageRow>[]): PokemonUsage {
  return {
    key: `${name}|Doubles|M5`,
    showdownId: name.toLowerCase(),
    displayName: name,
    format: 'Doubles',
    season: 'M5',
    rows: rows.map((r, i) => ({
      category: r.category ?? 'teammate',
      rank: r.rank ?? i + 1,
      name: r.name ?? '',
      percentage: r.percentage ?? null,
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

describe('meta-aggregator', () => {
  const records = [
    mkUsage('Incineroar', [
      { category: 'teammate', name: 'Rillaboom' },
      { category: 'teammate', name: 'Flutter Mane' },
      { category: 'held_item', name: 'Sitrus Berry', percentage: 62 },
    ]),
    mkUsage('Rillaboom', [
      { category: 'teammate', name: 'Incineroar' },
      { category: 'teammate', name: 'Flutter Mane' },
      { category: 'held_item', name: 'Assault Vest', percentage: 40 },
    ]),
    mkUsage('Flutter Mane', [
      { category: 'teammate', name: 'Incineroar' },
      { category: 'held_item', name: 'Booster Energy', percentage: 55 },
    ]),
  ];

  it('ranks Pokémon by teammate co-occurrence', () => {
    const ranking = rankByTeammateCoOccurrence(records);
    // Incineroar is listed as a teammate by Rillaboom + Flutter Mane => 2.
    const incin = ranking.find((r) => r.key === 'incineroar');
    expect(incin?.coOccurrence).toBe(2);
    // Top entry gets score 100.
    expect(ranking[0].score).toBe(100);
  });

  it('finds mutual cores', () => {
    const cores = findCommonCores(records);
    const incinRilla = cores.find(
      (c) =>
        c.members.map((m) => m.toLowerCase()).sort().join('+') ===
        'incineroar+rillaboom',
    );
    expect(incinRilla?.mutual).toBe(true);
  });

  it('aggregates item leaders by count', () => {
    const items = aggregateLeaders(records, 'held_item', 10);
    expect(items.length).toBe(3);
    expect(items.every((i) => i.count === 1)).toBe(true);
  });

  it('converts Champions DD_MM_YYYY dates to ISO', () => {
    expect(championsDateToIso('31_08_2026')).toBe('2026-08-31');
    expect(championsDateToIso('not-a-date')).toBe('not-a-date');
  });
});
