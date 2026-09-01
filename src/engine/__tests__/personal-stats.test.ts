import { describe, expect, it } from 'vitest';
import {
  computePersonalReport,
  patternWarrantsChange,
} from '@/engine/personal-stats';
import type { BattleLog } from '@/types/battle-log';

function log(teamId: string, result: 'win' | 'loss', over: Partial<BattleLog> = {}): BattleLog {
  return {
    id: crypto.randomUUID(),
    teamId,
    date: Date.now(),
    result,
    brought: [],
    notes: [],
    tags: [],
    ...over,
  };
}

const names = (id: string) => ({ t1: 'Team One', t2: 'Team Two' }[id] ?? id);

describe('computePersonalReport', () => {
  it('computes overall record', () => {
    const r = computePersonalReport(
      [log('t1', 'win'), log('t1', 'loss'), log('t1', 'win')],
      names,
    );
    expect(r.totalGames).toBe(3);
    expect(r.wins).toBe(2);
    expect(r.overallWinRate).toBeCloseTo(2 / 3);
  });

  it('marks small samples as not reliable and shrinks their win rate', () => {
    // 2-0 team: raw 100% but only 2 games -> below minSample=5 -> not reliable,
    // adjusted pulled well below 1.0.
    const r = computePersonalReport([log('t1', 'win'), log('t1', 'win')], names, 5);
    const team = r.byTeam.find((t) => t.key === 't1')!;
    expect(team.reliable).toBe(false);
    expect(team.rawWinRate).toBe(1);
    expect(team.adjustedWinRate).toBeLessThan(0.8);
  });

  it('does not let a tiny hot sample outrank a larger solid one', () => {
    const logs: BattleLog[] = [
      // t1: 2-0 (hot but tiny)
      log('t1', 'win'), log('t1', 'win'),
      // t2: 7-3 (solid, larger)
      ...Array(7).fill(0).map(() => log('t2', 'win')),
      ...Array(3).fill(0).map(() => log('t2', 'loss')),
    ];
    const r = computePersonalReport(logs, names, 5);
    // After shrinkage, the well-sampled 70% team should rank at or above the
    // tiny 100% team.
    const t1 = r.byTeam.find((t) => t.key === 't1')!;
    const t2 = r.byTeam.find((t) => t.key === 't2')!;
    expect(t2.adjustedWinRate).toBeGreaterThanOrEqual(t1.adjustedWinRate);
    expect(t2.reliable).toBe(true);
    expect(t1.reliable).toBe(false);
  });

  it('groups leads order-independently', () => {
    const r = computePersonalReport(
      [
        log('t1', 'win', { brought: ['a', 'b', 'c', 'd'] }),
        log('t1', 'loss', { brought: ['b', 'a', 'e', 'f'] }), // same lead a+b
      ],
      names,
    );
    const lead = r.byLead.find((l) => l.key === 'a + b');
    expect(lead?.games).toBe(2);
  });

  it('surfaces recurring loss patterns', () => {
    const r = computePersonalReport(
      [
        log('t1', 'loss', { tags: ['bad-lead'] }),
        log('t1', 'loss', { tags: ['bad-lead', 'wrong-bring-4'] }),
      ],
      names,
    );
    expect(r.lossPatterns[0].tag).toBe('bad-lead');
    expect(r.lossPatterns[0].count).toBe(2);
  });
});

describe('patternWarrantsChange', () => {
  it('does not recommend a change after only 1-2 occurrences', () => {
    expect(patternWarrantsChange(1)).toBe(false);
    expect(patternWarrantsChange(2)).toBe(false);
    expect(patternWarrantsChange(3)).toBe(true);
  });
});
