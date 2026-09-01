import { describe, expect, it } from 'vitest';
import { buildGamePlan, type GamePlanMember } from '@/engine/game-plan';
import type { BaseStats } from '@/types/pokemon';
import type { PokemonType } from '@/types/pokemon';

function stats(speed: number): BaseStats {
  return { hp: 80, attack: 100, defense: 80, specialAttack: 100, specialDefense: 80, speed };
}
function mk(name: string, speed: number, types: PokemonType[], moves: string[], ability = ''): GamePlanMember {
  return { name, baseStats: stats(speed), types, moves, ability };
}

describe('buildGamePlan', () => {
  it('returns null for <2 members', () => {
    expect(buildGamePlan([mk('A', 100, ['normal'], [])])).toBeNull();
  });

  it('builds a Trick Room plan and leads the setter', () => {
    const team = [
      mk('Torkoal', 20, ['fire'], ['Trick Room', 'Eruption'], 'drought'),
      mk('Slow Nuke', 25, ['rock'], ['Rock Slide']),
      mk('Backup', 30, ['steel'], ['Iron Head']),
      mk('Sup', 40, ['fairy'], ['Follow Me']),
    ];
    const plan = buildGamePlan(team)!;
    expect(plan.archetype).toBe('trick-room');
    expect(plan.leads.members).toContain('Torkoal');
    expect(plan.winCondition.toLowerCase()).toContain('trick room');
  });

  it('leads Fake Out + speed control on a fast team', () => {
    const team = [
      mk('Incin', 90, ['fire', 'dark'], ['Fake Out', 'Knock Off'], 'intimidate'),
      mk('Whimsi', 150, ['grass', 'fairy'], ['Tailwind', 'Moonblast']),
      mk('Nuke', 148, ['dragon'], ['Draco Meteor']),
      mk('Nuke2', 145, ['ground'], ['Earthquake']),
    ];
    const plan = buildGamePlan(team)!;
    expect(plan.archetype).toBe('fast-offense');
    expect(plan.leads.members).toEqual(expect.arrayContaining(['Incin', 'Whimsi']));
    expect(plan.bringFour.length).toBeLessThanOrEqual(4);
  });

  it('flags Trick Room as difficult for a fast team with no speed control', () => {
    const team = [
      mk('FastA', 150, ['electric'], ['Thunderbolt']),
      mk('FastB', 148, ['ice'], ['Ice Beam']),
      mk('FastC', 145, ['fire'], ['Flamethrower']),
      mk('FastD', 140, ['water'], ['Surf']),
    ];
    const plan = buildGamePlan(team)!;
    expect(plan.difficult.join(' ').toLowerCase()).toMatch(/speed control|trick room/);
  });

  it('never claims certainty in the win condition', () => {
    const team = [
      mk('A', 100, ['normal'], ['Tailwind']),
      mk('B', 100, ['fire'], ['Flamethrower']),
    ];
    const plan = buildGamePlan(team)!;
    expect(JSON.stringify(plan)).not.toMatch(/guaranteed|always wins|optimal|unbeatable/i);
  });
});
