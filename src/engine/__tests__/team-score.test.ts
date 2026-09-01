import { describe, expect, it } from 'vitest';
import {
  scoreTeam,
  shrink,
  DEFAULT_WEIGHTS,
  TEAM_SCORE_MODEL_VERSION,
  type ScorableMember,
} from '@/engine/team-score';
import { rankTeams, compareScoredTeams } from '@/engine/team-compare';

function mk(name: string, over: Partial<ScorableMember> = {}): ScorableMember {
  return {
    name,
    types: ['normal'],
    moves: [],
    moveTypes: [],
    ability: '',
    item: '',
    ...over,
  };
}

describe('shrink', () => {
  it('returns the prior for zero samples', () => {
    expect(shrink(0.9, 0)).toBe(0.5);
  });
  it('pulls small samples toward the prior', () => {
    const small = shrink(1.0, 1, 0.5, 5); // 1 sample, strong prior
    const large = shrink(1.0, 100, 0.5, 5);
    expect(small).toBeLessThan(large);
    expect(large).toBeGreaterThan(0.9);
  });
});

describe('scoreTeam', () => {
  it('is reproducible and stamps the model version', () => {
    const team = [mk('A', { moves: ['tailwind'] }), mk('B')];
    const s1 = scoreTeam(team, DEFAULT_WEIGHTS);
    const s2 = scoreTeam(team, DEFAULT_WEIGHTS);
    expect(s1.total).toBe(s2.total);
    expect(s1.modelVersion).toBe(TEAM_SCORE_MODEL_VERSION);
  });

  it('rewards speed control', () => {
    const withSC = scoreTeam([mk('A', { moves: ['tailwind'] })]);
    const withoutSC = scoreTeam([mk('A', { moves: ['tackle'] })]);
    const sc = withSC.categories.find((c) => c.key === 'speedControl')!;
    const noSc = withoutSC.categories.find((c) => c.key === 'speedControl')!;
    expect(sc.score).toBeGreaterThan(noSc.score);
  });

  it('penalizes duplicate items', () => {
    const dup = scoreTeam([
      mk('A', { item: 'Sitrus Berry' }),
      mk('B', { item: 'Sitrus Berry' }),
    ]);
    const cat = dup.categories.find((c) => c.key === 'itemConflictPenalty')!;
    expect(cat.score).toBeLessThan(100);
    expect(dup.weaknesses.some((w) => w.includes('duplicate'))).toBe(true);
  });

  it('uses a neutral prior + low confidence when no usage is provided', () => {
    const s = scoreTeam([mk('A')]);
    expect(s.confidenceLabel).toBe('low');
    const meta = s.categories.find((c) => c.key === 'metaSupport')!;
    expect(meta.score).toBe(50);
  });

  it('raises confidence when usage covers the team', () => {
    const team = [mk('Incineroar'), mk('Rillaboom')];
    const s = scoreTeam(team, DEFAULT_WEIGHTS, {
      popularity: () => 0.8,
    });
    expect(s.confidence).toBeGreaterThan(0.7);
    expect(s.confidenceLabel).toBe('high');
  });
});

describe('team-compare', () => {
  it('ranks teams best-first and explains the delta', () => {
    const teams = [
      { id: '1', name: 'No SC', members: [mk('A', { moves: ['tackle'] })] },
      { id: '2', name: 'With SC', members: [mk('B', { moves: ['tailwind'] })] },
    ];
    const ranked = rankTeams(teams);
    expect(ranked[0].name).toBe('With SC'); // speed control wins
    const cmp = compareScoredTeams(ranked[1], ranked[0]);
    expect(cmp.totalDelta).toBeGreaterThan(0);
    expect(cmp.improved.some((d) => d.key === 'speedControl')).toBe(true);
    expect(cmp.summary).toContain('Speed Control');
  });
});
