import { describe, expect, it } from 'vitest';
import { assembleMetaTeam, buildMetaSet } from '@/engine/meta-team';
import type { PokemonUsage, UsageRow } from '@/types/usage';

function usage(name: string, rows: Partial<UsageRow>[]): PokemonUsage {
  return {
    key: `${name}|Doubles|M5`,
    showdownId: name.toLowerCase(),
    displayName: name,
    format: 'Doubles',
    season: 'M5',
    rows: rows.map((r, i) => ({
      category: r.category ?? 'move',
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

const incin = usage('Incineroar', [
  { category: 'ability', name: 'Intimidate', percentage: 99 },
  { category: 'held_item', name: 'Sitrus Berry', percentage: 62 },
  { category: 'stat_alignment', name: 'Careful', percentage: 40 },
  { category: 'move', name: 'Fake Out', percentage: 95, rank: 1 },
  { category: 'move', name: 'Knock Off', percentage: 80, rank: 2 },
  { category: 'move', name: 'Parting Shot', percentage: 70, rank: 3 },
  { category: 'move', name: 'Flare Blitz', percentage: 55, rank: 4 },
]);

describe('buildMetaSet', () => {
  it('fills the most common set with percentages', () => {
    const set = buildMetaSet('Incineroar', 'incineroar', incin);
    expect(set.hasData).toBe(true);
    expect(set.ability).toBe('Intimidate');
    expect(set.item).toBe('Sitrus Berry');
    expect(set.moves[0]).toEqual({ name: 'Fake Out', pct: 95 });
    expect(set.moves).toHaveLength(4);
  });

  it('marks no-data species so the user fills them in', () => {
    const set = buildMetaSet('Mystery', 'mystery', undefined);
    expect(set.hasData).toBe(false);
    expect(set.moves).toHaveLength(0);
  });
});

describe('assembleMetaTeam', () => {
  it('assembles sets and claims no win rate', () => {
    const team = assembleMetaTeam(
      'Test',
      [
        { displayName: 'Incineroar', showdownId: 'incineroar' },
        { displayName: 'Mystery', showdownId: 'mystery' },
      ],
      [incin],
    );
    expect(team.sets).toHaveLength(2);
    expect(team.note.toLowerCase()).toContain('no win rates');
    expect(JSON.stringify(team)).not.toMatch(/win rate:|guaranteed|optimal|broken/i);
  });

  it('attaches an experimental tweak targeting the weakest-data slot', () => {
    const team = assembleMetaTeam(
      'Test',
      [
        { displayName: 'Incineroar', showdownId: 'incineroar' },
        { displayName: 'Mystery', showdownId: 'mystery' }, // no data = weakest
      ],
      [incin],
      { displayName: 'Sneasler', reason: 'Resists several top threats and is low usage.' },
    );
    expect(team.tweak).toBeDefined();
    expect(team.tweak!.label).toBe('experimental');
    expect(team.tweak!.target).toBe('Mystery'); // weakest-data slot
    expect(team.tweak!.suggestion).toContain('Sneasler');
  });
});
