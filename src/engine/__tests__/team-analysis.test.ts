import { describe, expect, it } from 'vitest';
import { analyzeCore, type AnalyzableMember } from '@/engine/team-analysis';
import type { BaseStats } from '@/types/pokemon';

function stats(speed: number): BaseStats {
  return { hp: 80, attack: 100, defense: 80, specialAttack: 100, specialDefense: 80, speed };
}

function mk(name: string, speed: number, moves: string[], ability = ''): AnalyzableMember {
  return { name, baseStats: stats(speed), moves, ability };
}

describe('analyzeCore', () => {
  it('classifies a Trick Room core and rewards coherence', () => {
    const core = [
      mk('Torkoal', 20, ['Trick Room', 'Eruption'], 'drought'),
      mk('Slow Nuke', 30, ['Earthquake', 'Rock Slide']),
    ];
    const a = analyzeCore(core);
    expect(a.speed.archetype).toBe('trick-room');
    expect(a.speed.hasSpeedControlPlan).toBe(true);
    expect(a.synergies.some((s) => /Trick Room core/i.test(s))).toBe(true);
  });

  it('flags Trick Room + fast attackers as anti-synergy', () => {
    const core = [
      mk('TR Setter', 20, ['Trick Room']),
      mk('Fast A', 150, ['Tackle']),
      mk('Fast B', 155, ['Tackle']),
    ];
    const a = analyzeCore(core);
    expect(a.issues.some((i) => /Trick Room present but multiple fast/i.test(i))).toBe(true);
  });

  it('flags conflicting weather', () => {
    const core = [
      mk('Sun', 60, [], 'drought'),
      mk('Rain', 60, [], 'drizzle'),
    ];
    const a = analyzeCore(core);
    expect(a.issues.some((i) => /Conflicting weather/i.test(i))).toBe(true);
  });

  it('flags missing speed control on a fast-offense core', () => {
    const core = [
      mk('Fast A', 150, ['Tackle']),
      mk('Fast B', 148, ['Scratch']),
    ];
    const a = analyzeCore(core);
    expect(a.speed.hasSpeedControlPlan).toBe(false);
    expect(a.issues.some((i) => /No speed-control plan/i.test(i))).toBe(true);
  });

  it('detects speed redundancy when 3 members share a tier', () => {
    const core = [
      mk('A', 100, ['Tailwind']),
      mk('B', 101, ['Tackle']),
      mk('C', 102, ['Tackle']),
    ];
    const a = analyzeCore(core);
    expect(a.speed.speedRedundancy).toBe(true);
  });

  it('rewards redirection protecting a fast attacker', () => {
    const core = [
      mk('Amoonguss', 30, ['Rage Powder', 'Spore']),
      mk('Fast Nuke', 150, ['Moonblast']),
    ];
    const a = analyzeCore(core);
    expect(a.roles.hasRedirection).toBe(true);
    expect(a.synergies.some((s) => /Redirection/i.test(s))).toBe(true);
  });

  it('marks speed as approximate when no real spread is given', () => {
    const a = analyzeCore([mk('X', 100, [])]);
    expect(a.speed.approximate).toBe(true);
    expect(a.speed.exact).toBe(false);
  });

  it('uses exact Champions speed when a spread + alignment are supplied', () => {
    const a = analyzeCore([
      {
        name: 'Fast',
        baseStats: stats(120),
        moves: [],
        ability: '',
        statPoints: { hp: 0, attack: 0, defense: 0, spAttack: 34, spDefense: 0, speed: 32 },
        statAlignment: 'timid',
      },
    ]);
    expect(a.speed.exact).toBe(true);
    expect(a.speed.approximate).toBe(false);
  });
});
