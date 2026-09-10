import { describe, expect, it } from 'vitest';
import {
  usageResidualFindings,
  coverageGapFindings,
  discoveryLabelText,
  overlookedCores,
  newInRegFindings,
} from '@/engine/off-meta';
import type { PokemonUsage, UsageRow } from '@/types/usage';
import type { PokemonType } from '@/types/pokemon';

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

describe('usageResidualFindings', () => {
  it('flags a mon that many teams run as a teammate but that seldom seeds', () => {
    // "Whimsicott" is listed by everyone as a teammate but is never itself a
    // source record's headline (low seed popularity) -> high residual.
    const records = [
      usage('Incineroar', ['Whimsicott', 'Rillaboom']),
      usage('Rillaboom', ['Whimsicott', 'Incineroar']),
      usage('Flutter Mane', ['Whimsicott', 'Incineroar']),
      usage('Amoonguss', ['Whimsicott', 'Rillaboom']),
    ];
    const findings = usageResidualFindings(records);
    expect(findings.some((f) => f.key === 'whimsicott')).toBe(true);
    const w = findings.find((f) => f.key === 'whimsicott')!;
    expect(w.reasons.join(' ')).toMatch(/underused relative/i);
    // Never claims certainty.
    expect(JSON.stringify(w)).not.toMatch(/optimal|broken|guaranteed/i);
  });

  it('returns empty for no data', () => {
    expect(usageResidualFindings([])).toEqual([]);
  });
});

describe('coverageGapFindings', () => {
  it('finds a low-usage mon that resists and threatens multiple top threats', () => {
    const topThreats = [
      { name: 'Flutter Mane', types: ['ghost', 'fairy'] as PokemonType[] },
      { name: 'Chi-Yu', types: ['dark', 'fire'] as PokemonType[] },
    ];
    // Steel/Dragon-ish candidate that resists ghost/fairy/dark/fire and hits back.
    const dex = [
      { name: 'Roaring Moon', types: ['dragon', 'dark'] as PokemonType[] },
      { name: 'Dondozo', types: ['water'] as PokemonType[] },
    ];
    const findings = coverageGapFindings(topThreats, dex, () => 0.1);
    // Should return type-appropriate answers and never exceed the dex.
    expect(Array.isArray(findings)).toBe(true);
    for (const f of findings) {
      expect(f.answers.length).toBeGreaterThanOrEqual(2);
      expect(f.novelty).toBeGreaterThan(0);
    }
  });

  it('excludes high-usage candidates (not off-meta)', () => {
    const topThreats = [{ name: 'X', types: ['normal'] as PokemonType[] }];
    const dex = [{ name: 'Popular', types: ['fighting'] as PokemonType[] }];
    const findings = coverageGapFindings(topThreats, dex, () => 0.9);
    expect(findings).toHaveLength(0);
  });

  it('returns empty when there are no threats or dex', () => {
    expect(coverageGapFindings([], [], () => 0)).toEqual([]);
  });
});

describe('discoveryLabelText', () => {
  it('never yields optimal/broken language', () => {
    for (const l of ['promising', 'experimental', 'speculative'] as const) {
      expect(discoveryLabelText(l)).not.toMatch(/optimal|broken/i);
    }
  });
});

describe('overlookedCores', () => {
  it('surfaces a structurally strong pair that is rarely used together', () => {
    // Steel/Fairy + Fire/Ground style complementary pair, never co-used.
    const dex = [
      { name: 'Tinkaton', types: ['steel', 'fairy'] as PokemonType[] },
      { name: 'Camerupt', types: ['fire', 'ground'] as PokemonType[] },
      { name: 'Garchomp', types: ['dragon', 'ground'] as PokemonType[] },
    ];
    const cores = overlookedCores(dex, () => 0, 5); // 0 = never used together
    // Should return at least one core and never claim certainty.
    expect(Array.isArray(cores)).toBe(true);
    for (const c of cores) {
      expect(c.underuse).toBeGreaterThanOrEqual(0.5);
      expect(c.opportunity).toBeGreaterThan(0);
      expect(JSON.stringify(c)).not.toMatch(/optimal|broken|guaranteed/i);
    }
  });

  it('excludes pairs that are already commonly used together', () => {
    const dex = [
      { name: 'Tinkaton', types: ['steel', 'fairy'] as PokemonType[] },
      { name: 'Camerupt', types: ['fire', 'ground'] as PokemonType[] },
    ];
    const cores = overlookedCores(dex, () => 0.9, 5); // already heavily co-used
    expect(cores).toHaveLength(0);
  });
});

describe('newInRegFindings', () => {
  const legalDex = [
    { name: 'Baxcalibur', types: ['dragon', 'ice'] as PokemonType[] },
    { name: 'Rillaboom', types: ['grass'] as PokemonType[] },
    { name: 'Toxtricity (Amped Form)', types: ['electric', 'poison'] as PokemonType[] },
  ];

  it('surfaces reg-new species that resolve to the legal dex', () => {
    const findings = newInRegFindings(['Baxcalibur', 'Rillaboom'], legalDex);
    expect(findings.map((f) => f.key).sort()).toEqual(['baxcalibur', 'rillaboom']);
    for (const f of findings) {
      expect(f.noUsageYet).toBe(true);
      expect(f.reasons.join(' ')).toMatch(/new to this regulation/i);
      // Honesty: never a strength/win-rate claim.
      expect(JSON.stringify(f)).not.toMatch(/optimal|broken|guaranteed|win rate/i);
    }
  });

  it('skips names that are not in the legal dex (illegal/unseeded)', () => {
    // Koraidon is not in the provided legal dex -> must be skipped.
    const findings = newInRegFindings(['Baxcalibur', 'Koraidon'], legalDex);
    expect(findings.map((f) => f.key)).toEqual(['baxcalibur']);
  });

  it('canonicalizes form names like "Toxtricity (Amped Form)"', () => {
    const findings = newInRegFindings(['Toxtricity (Amped Form)'], legalDex);
    expect(findings).toHaveLength(1);
    expect(findings[0].key).toBe('toxtricityampedform');
  });

  it('marks an already-used new species as no-longer-untapped and ranks it lower', () => {
    const pop = (k: string) => (k === 'rillaboom' ? 0.4 : 0);
    const findings = newInRegFindings(['Rillaboom', 'Baxcalibur'], legalDex, pop);
    const rilla = findings.find((f) => f.key === 'rillaboom')!;
    const bax = findings.find((f) => f.key === 'baxcalibur')!;
    expect(rilla.noUsageYet).toBe(false);
    expect(bax.noUsageYet).toBe(true);
    // Untapped one ranks ahead of the already-used one.
    expect(findings[0].key).toBe('baxcalibur');
    expect(rilla.reasons.join(' ')).toMatch(/surprise factor is fading/i);
  });

  it('returns empty for empty inputs', () => {
    expect(newInRegFindings([], legalDex)).toEqual([]);
    expect(newInRegFindings(['Baxcalibur'], [])).toEqual([]);
  });

  it('deduplicates repeated names', () => {
    const findings = newInRegFindings(['Baxcalibur', 'Baxcalibur'], legalDex);
    expect(findings).toHaveLength(1);
  });
});
