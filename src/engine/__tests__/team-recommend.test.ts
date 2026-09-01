import { describe, expect, it } from 'vitest';
import {
  buildProvenTeams,
  buildAroundCore,
  improveCurrentTeam,
  improveCurrentTeamScored,
  evidenceLabelText,
  generateDiverseTeams,
} from '@/engine/team-recommend';
import type { PokemonUsage, UsageRow } from '@/types/usage';

function usage(name: string, teammates: string[]): PokemonUsage {
  const rows: UsageRow[] = teammates.map((t, i) => ({
    category: 'teammate',
    rank: i + 1,
    name: t,
    percentage: null,
  }));
  return {
    key: `${name}|Doubles|M5`,
    showdownId: name.toLowerCase(),
    displayName: name,
    format: 'Doubles',
    season: 'M5',
    rows,
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

// A small connected meta: Incineroar <-> Rillaboom <-> Flutter Mane etc.
const records = [
  usage('Incineroar', ['Rillaboom', 'Flutter Mane', 'Amoonguss', 'Urshifu', 'Torkoal']),
  usage('Rillaboom', ['Incineroar', 'Flutter Mane', 'Urshifu', 'Amoonguss', 'Tornadus']),
  usage('Flutter Mane', ['Incineroar', 'Rillaboom', 'Chi-Yu', 'Landorus', 'Amoonguss']),
  usage('Amoonguss', ['Incineroar', 'Rillaboom', 'Flutter Mane', 'Kingambit', 'Urshifu']),
  usage('Urshifu', ['Incineroar', 'Rillaboom', 'Amoonguss', 'Flutter Mane', 'Whimsicott']),
];

describe('buildProvenTeams', () => {
  it('generates teams seeded from popular Pokémon', () => {
    const teams = buildProvenTeams(records, 2);
    expect(teams.length).toBeGreaterThanOrEqual(1);
    expect(teams[0].species.length).toBeGreaterThanOrEqual(4);
    expect(teams[0].reasons.some((r) => /co-occurrence|teammate/i.test(r))).toBe(true);
  });

  it('returns empty for no data', () => {
    expect(buildProvenTeams([], 3)).toEqual([]);
  });

  it('is deterministic', () => {
    const a = buildProvenTeams(records, 2);
    const b = buildProvenTeams(records, 2);
    expect(a.map((t) => t.species.join(','))).toEqual(b.map((t) => t.species.join(',')));
  });
});

describe('buildAroundCore', () => {
  it('locks the core and fills from teammates', () => {
    const result = buildAroundCore(['Incineroar', 'Rillaboom'], records);
    expect(result).not.toBeNull();
    expect(result!.locked).toContain('incineroar');
    expect(result!.locked).toContain('rillaboom');
    // Core is included in the final species list.
    expect(result!.species).toContain('incineroar');
    expect(result!.species).toContain('rillaboom');
  });

  it('flags insufficient data for an unknown core', () => {
    const result = buildAroundCore(['MadeUpMon'], records);
    expect(result!.evidence).toBe('insufficient-data');
  });
});

describe('improveCurrentTeam', () => {
  it('suggests swapping a low-synergy member for a common teammate', () => {
    // A team where 'Magikarp' has no usage synergy with the rest.
    const suggestions = improveCurrentTeam(
      ['Incineroar', 'Rillaboom', 'Magikarp'],
      records,
      2,
    );
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    // It should propose replacing the weak link (Magikarp) first.
    expect(suggestions[0].replaceName.toLowerCase()).toBe('magikarp');
  });
});

describe('improveCurrentTeamScored', () => {
  it('only suggests swaps that RAISE the analyzer score', () => {
    // Scorer: team is better the more of [good1, good2, good3] it contains.
    const good = new Set(['good1', 'good2', 'good3']);
    const scorer = (names: string[]) => {
      const total = 50 + names.filter((n) => good.has(n.toLowerCase())).length * 15;
      return { total, categories: [{ label: 'Coverage', score: total }] };
    };
    const suggestions = improveCurrentTeamScored(
      ['good1', 'good2', 'Filler'],
      records,
      scorer,
      ['good3', 'Junk'], // good3 improves, Junk does not
      3,
    );
    // Should suggest replacing Filler with good3 (raises score), never propose Junk.
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].withName).toBe('good3');
    expect(suggestions[0].scoreAfter!).toBeGreaterThan(suggestions[0].scoreBefore!);
  });

  it('returns nothing when no swap improves the team (already optimal)', () => {
    const scorer = () => ({ total: 90, categories: [{ label: 'X', score: 90 }] });
    const suggestions = improveCurrentTeamScored(
      ['A', 'B', 'C'],
      records,
      scorer,
      ['D', 'E'],
      3,
    );
    expect(suggestions).toEqual([]);
  });
});

describe('evidenceLabelText', () => {
  it('maps labels to human text', () => {
    expect(evidenceLabelText('strong-evidence')).toBe('Strong evidence');
    expect(evidenceLabelText('insufficient-data')).toBe('Insufficient data');
  });
});

describe('generateDiverseTeams', () => {
  it('is deterministic for a given seed offset', () => {
    const a = generateDiverseTeams(records, 3, 0);
    const b = generateDiverseTeams(records, 3, 0);
    expect(a.map((t) => t.species.join(','))).toEqual(b.map((t) => t.species.join(',')));
  });

  it('produces different lead seeds as the offset advances (refresh)', () => {
    const first = generateDiverseTeams(records, 1, 0)[0];
    const second = generateDiverseTeams(records, 1, 1)[0];
    // Different starting seed on refresh (locked seed differs).
    expect(first.locked[0]).not.toBe(second.locked[0]);
  });

  it('returns empty for no data', () => {
    expect(generateDiverseTeams([], 3, 0)).toEqual([]);
  });
});
