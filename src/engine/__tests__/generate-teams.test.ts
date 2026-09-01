import { describe, expect, it } from 'vitest';
import { generateTeams } from '@/engine/team-recommend';
import type { PokemonUsage, UsageRow } from '@/types/usage';

function usage(name: string, teammates: string[], extra: Partial<UsageRow>[] = []): PokemonUsage {
  const rows: UsageRow[] = [
    ...teammates.map((t, i) => ({ category: 'teammate' as const, rank: i + 1, name: t, percentage: null })),
    ...extra.map((e, i) => ({ category: e.category ?? 'move', rank: i + 1, name: e.name ?? '', percentage: e.percentage ?? null } as UsageRow)),
  ];
  return {
    key: `${name}|Doubles|M5`,
    showdownId: name.toLowerCase(),
    displayName: name,
    format: 'Doubles',
    season: 'M5',
    rows,
    provenance: {
      source: 'champions-battle-data', attribution: 't', sourceUrl: 't',
      format: 'Doubles', season: 'M5', retrievedAt: new Date().toISOString(), transformVersion: 1,
    },
  };
}

const records = [
  usage('Incineroar', ['Rillaboom', 'Flutter Mane', 'Amoonguss', 'Urshifu'], [
    { category: 'move', name: 'Fake Out' }, { category: 'held_item', name: 'Sitrus Berry' },
  ]),
  usage('Rillaboom', ['Incineroar', 'Flutter Mane', 'Urshifu', 'Amoonguss'], [
    { category: 'move', name: 'Tailwind' },
  ]),
  usage('Flutter Mane', ['Incineroar', 'Rillaboom', 'Amoonguss', 'Urshifu']),
  usage('Amoonguss', ['Incineroar', 'Rillaboom', 'Flutter Mane', 'Urshifu']),
  usage('Urshifu', ['Incineroar', 'Rillaboom', 'Amoonguss', 'Flutter Mane']),
  usage('Torkoal', ['Amoonguss', 'Flutter Mane'], [{ category: 'move', name: 'Trick Room' }]),
];

describe('generateTeams', () => {
  it('excludes specified Pokémon from every team', () => {
    const teams = generateTeams(records, 'proven', { exclude: ['Incineroar'], count: 3 });
    for (const t of teams) {
      expect(t.species).not.toContain('incineroar');
    }
  });

  it('honors available-only restriction', () => {
    const allowed = ['Rillaboom', 'Flutter Mane', 'Amoonguss', 'Urshifu'];
    const teams = generateTeams(records, 'best-available', { availableOnly: allowed, count: 2 });
    const canon = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const allowedCanon = new Set(allowed.map(canon));
    expect(teams.length).toBeGreaterThan(0);
    for (const t of teams) {
      for (const s of t.species) expect(allowedCanon.has(s)).toBe(true);
    }
  });

  it('requires a move when requiredMove is set', () => {
    const teams = generateTeams(records, 'proven', { requiredMove: 'Tailwind', count: 3 });
    for (const t of teams) {
      // At least one member has Tailwind in usage (Rillaboom).
      expect(t.species).toContain('rillaboom');
    }
  });

  it('labels experimental teams as experimental', () => {
    const teams = generateTeams(records, 'experimental', { count: 2 });
    expect(teams.length).toBeGreaterThan(0);
    for (const t of teams) expect(t.evidence).toBe('experimental');
  });

  it('is deterministic for a given seed offset', () => {
    const a = generateTeams(records, 'proven', { seedOffset: 1, count: 3 });
    const b = generateTeams(records, 'proven', { seedOffset: 1, count: 3 });
    expect(a.map((t) => t.species.join(','))).toEqual(b.map((t) => t.species.join(',')));
  });

  it('never includes duplicate species (species clause)', () => {
    const teams = generateTeams(records, 'proven', { count: 3 });
    for (const t of teams) {
      expect(new Set(t.species).size).toBe(t.species.length);
    }
  });

  it('returns empty for no data', () => {
    expect(generateTeams([], 'proven', {})).toEqual([]);
  });
});
