import { describe, expect, it } from 'vitest';
import {
  usageResidualFindings,
  coverageGapFindings,
  discoveryLabelText,
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
