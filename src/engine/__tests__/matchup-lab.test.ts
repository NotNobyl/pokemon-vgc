import { describe, expect, it } from 'vitest';
import {
  buildLikelySet,
  buildMatchupReport,
  detectSignals,
} from '@/engine/matchup-lab';
import type { PokemonUsage, UsageRow } from '@/types/usage';

function mkUsage(displayName: string, rows: Partial<UsageRow>[]): PokemonUsage {
  return {
    key: `${displayName}|Doubles|M5`,
    showdownId: displayName.toLowerCase(),
    displayName,
    format: 'Doubles',
    season: 'M5',
    rows: rows.map((r, i) => ({
      category: r.category ?? 'move',
      rank: r.rank ?? i + 1,
      name: r.name ?? '',
      percentage: r.percentage ?? null,
      statUp: r.statUp,
      statDown: r.statDown,
      statPoints: r.statPoints,
    })),
    provenance: {
      source: 'champions-battle-data',
      attribution: 'test',
      sourceUrl: 'test',
      format: 'Doubles',
      season: 'M5',
      retrievedAt: new Date().toISOString(),
      transformVersion: 1,
    },
  };
}

describe('matchup-lab', () => {
  it('only surfaces moves that appear in observed usage (legality guard)', () => {
    const usage = mkUsage('Incineroar', [
      { category: 'move', name: 'Fake Out', percentage: 80, rank: 1 },
      { category: 'move', name: 'Knock Off', percentage: 70, rank: 2 },
      { category: 'ability', name: 'Intimidate', percentage: 95, rank: 1 },
    ]);
    const set = buildLikelySet('Incineroar', usage);
    const moveNames = set.topMoves.map((m) => m.name);
    expect(moveNames).toEqual(['Fake Out', 'Knock Off']);
    // Never invents a move not present in the data.
    expect(moveNames).not.toContain('Flare Blitz');
  });

  it('marks Pokémon with no cached data as unknown (uncertainty)', () => {
    const set = buildLikelySet('Mystery', undefined);
    expect(set.hasData).toBe(false);
    expect(set.topMoves).toHaveLength(0);
  });

  it('detects Fake Out, Intimidate, and speed control signals', () => {
    const usage = mkUsage('Incineroar', [
      { category: 'move', name: 'Fake Out' },
      { category: 'move', name: 'Protect' },
      { category: 'ability', name: 'Intimidate' },
    ]);
    const sig = detectSignals(buildLikelySet('Incineroar', usage));
    expect(sig.hasFakeOut).toBe(true);
    expect(sig.hasIntimidate).toBe(true);
    expect(sig.hasProtect).toBe(true);
  });

  it('computes coverage and notes missing data', () => {
    const withData = mkUsage('Incineroar', [
      { category: 'move', name: 'Fake Out' },
    ]);
    const map = new Map([['incineroar', withData]]);
    const report = buildMatchupReport(
      ['Incineroar', 'UnknownMon'],
      (name) => map.get(name.toLowerCase().replace(/[^a-z0-9]/g, '')),
    );
    expect(report.coverage).toBeCloseTo(0.5);
    expect(report.scoutingNotes.some((n) => n.includes('UnknownMon'))).toBe(true);
  });

  it('flags Trick Room archetype when a TR move is observed', () => {
    const tr = mkUsage('Torkoal', [
      { category: 'move', name: 'Trick Room' },
      { category: 'move', name: 'Eruption' },
    ]);
    const map = new Map([['torkoal', tr]]);
    const report = buildMatchupReport(['Torkoal'], (name) =>
      map.get(name.toLowerCase().replace(/[^a-z0-9]/g, '')),
    );
    expect(report.likelyArchetypes).toContain('Trick Room');
  });
});
