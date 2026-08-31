import { describe, expect, it } from 'vitest';
import { recommendBring4 } from '@/engine/matchup-lab';
import { generateImprovementNotes } from '@/engine/improvement-notes';
import type { LiveMatch } from '@/types/live-match';

// Minimal type-effectiveness stub: super-effective if atk is 'fire' vs 'grass'.
function eff(atk: string, def: string[]): number {
  if (atk === 'fire' && def.includes('grass')) return 2;
  if (atk === 'water' && def.includes('fire')) return 2;
  if (atk === 'grass' && def.includes('fire')) return 0.5;
  return 1;
}

describe('recommendBring4', () => {
  it('ranks members with more super-effective coverage higher', () => {
    const myTeam = [
      { teamMemberId: 'a', name: 'Charizard', types: ['fire'] },
      { teamMemberId: 'b', name: 'Pidgey', types: ['normal'] },
    ];
    const oppTypes = [['grass'], ['grass']]; // two grass mons
    const rec = recommendBring4(myTeam, oppTypes, eff);
    expect(rec.ordered[0].teamMemberId).toBe('a'); // fire beats grass
    expect(rec.ordered[0].score).toBeGreaterThan(rec.ordered[1].score);
  });

  it('returns all members ordered (top 4 chosen by caller)', () => {
    const myTeam = Array.from({ length: 6 }, (_, i) => ({
      teamMemberId: `m${i}`,
      name: `Mon${i}`,
      types: ['normal'],
    }));
    const rec = recommendBring4(myTeam, [['fire']], eff);
    expect(rec.ordered).toHaveLength(6);
  });
});

function mkMatch(overrides: Partial<LiveMatch>): LiveMatch {
  return {
    id: 'm1',
    teamId: 't1',
    regulationId: 'reg-m-a',
    format: 'Doubles',
    phase: 'finished',
    opponents: [],
    recommendedBring4: [],
    myBring4: [],
    recommendedLeads: [],
    turns: [],
    createdAt: 0,
    updatedAt: 0,
    schemaVersion: 1,
    ...overrides,
  };
}

describe('generateImprovementNotes', () => {
  it('flags leading into a likely Fake Out on turn 1', () => {
    const match = mkMatch({
      result: 'loss',
      opponents: [{ name: 'Incineroar', revealed: { moves: [] } }],
      turns: [
        { turn: 1, myActive: [], theirActive: ['Incineroar'] },
      ],
    });
    const notes = generateImprovementNotes(match, (name) =>
      name === 'Incineroar' ? ['Fake Out', 'Knock Off'] : [],
    );
    expect(notes.some((n) => n.tag === 'lead-into-fake-out')).toBe(true);
  });

  it('flags a possible Trick Room loss', () => {
    const match = mkMatch({
      result: 'loss',
      opponents: [{ name: 'Torkoal', revealed: { moves: [] } }],
    });
    const notes = generateImprovementNotes(match, () => ['Trick Room', 'Eruption']);
    expect(notes.some((n) => n.tag === 'lost-speed-control')).toBe(true);
  });

  it('flags a notably different bring-4 on a loss', () => {
    const match = mkMatch({
      result: 'loss',
      recommendedBring4: ['a', 'b', 'c', 'd'],
      myBring4: ['a', 'x', 'y', 'd'], // 2 differ
    });
    const notes = generateImprovementNotes(match, () => []);
    expect(notes.some((n) => n.tag === 'wrong-bring-4')).toBe(true);
  });

  it('always returns at least a reflection prompt', () => {
    const win = generateImprovementNotes(mkMatch({ result: 'win' }), () => []);
    expect(win.length).toBeGreaterThanOrEqual(1);
    expect(win.some((n) => n.tag === 'win-review')).toBe(true);
  });
});
