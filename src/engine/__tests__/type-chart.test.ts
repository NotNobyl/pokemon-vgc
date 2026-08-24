import { describe, it, expect } from 'vitest';
import {
  getEffectiveness,
  getWeaknesses,
  getResistances,
  getImmunities,
  getTeamWeaknesses,
  getCriticalWeaknesses,
} from '../type-chart';

describe('Type Chart Engine', () => {
  describe('getEffectiveness', () => {
    it('returns 2x for super effective single type', () => {
      expect(getEffectiveness('fire', ['grass'])).toBe(2);
      expect(getEffectiveness('water', ['fire'])).toBe(2);
      expect(getEffectiveness('electric', ['water'])).toBe(2);
    });

    it('returns 0.5x for not very effective', () => {
      expect(getEffectiveness('fire', ['water'])).toBe(0.5);
      expect(getEffectiveness('grass', ['fire'])).toBe(0.5);
    });

    it('returns 0 for immunities', () => {
      expect(getEffectiveness('normal', ['ghost'])).toBe(0);
      expect(getEffectiveness('electric', ['ground'])).toBe(0);
      expect(getEffectiveness('ground', ['flying'])).toBe(0);
      expect(getEffectiveness('psychic', ['dark'])).toBe(0);
    });

    it('returns 4x for double super effective', () => {
      // Grass/Ground is 4x weak to Ice
      expect(getEffectiveness('ice', ['grass', 'ground'])).toBe(4);
      // Fire/Steel is 4x weak to Ground
      expect(getEffectiveness('ground', ['fire', 'steel'])).toBe(4);
    });

    it('returns 0.25x for double resistance', () => {
      // Fire/Water resists Fire (0.5 * 0.5)
      expect(getEffectiveness('fire', ['fire', 'water'])).toBe(0.25);
    });

    it('returns 1x for neutral type matchups', () => {
      expect(getEffectiveness('normal', ['normal'])).toBe(1);
    });

    it('handles immunity overriding super effective', () => {
      // Normal vs Ghost/something = 0
      expect(getEffectiveness('normal', ['ghost', 'dark'])).toBe(0);
      // Ground vs Flying/Water = 0
      expect(getEffectiveness('ground', ['flying', 'water'])).toBe(0);
    });
  });

  describe('getWeaknesses', () => {
    it('returns correct weaknesses for a mono-type', () => {
      const weaknesses = getWeaknesses(['fire']);
      expect(weaknesses.get('water')).toBe(2);
      expect(weaknesses.get('ground')).toBe(2);
      expect(weaknesses.get('rock')).toBe(2);
      expect(weaknesses.has('grass')).toBe(false);
    });

    it('returns correct weaknesses for dual type', () => {
      // Water/Ground: weak to Grass (4x)
      const weaknesses = getWeaknesses(['water', 'ground']);
      expect(weaknesses.get('grass')).toBe(4);
      expect(weaknesses.has('fire')).toBe(false); // Water resists fire
    });
  });

  describe('getResistances', () => {
    it('returns correct resistances for a type', () => {
      const resistances = getResistances(['steel']);
      expect(resistances.has('normal')).toBe(true);
      expect(resistances.has('grass')).toBe(true);
      expect(resistances.has('ice')).toBe(true);
      expect(resistances.has('fairy')).toBe(true);
    });
  });

  describe('getImmunities', () => {
    it('returns correct immunities', () => {
      const immunities = getImmunities(['ghost']);
      expect(immunities).toContain('normal');
      expect(immunities).toContain('fighting');
    });

    it('returns empty for types with no immunities', () => {
      const immunities = getImmunities(['fire']);
      expect(immunities).toHaveLength(0);
    });
  });

  describe('getTeamWeaknesses', () => {
    it('counts how many team members are weak to each type', () => {
      // 3 Pokémon all weak to Ground
      const team: (['fire'] | ['electric'] | ['steel'])[] = [['fire'], ['electric'], ['steel']];
      const weaknesses = getTeamWeaknesses(team);
      // Fire, Electric, and Steel are all weak to Ground
      expect(weaknesses.get('ground')).toBe(3);
    });
  });

  describe('getCriticalWeaknesses', () => {
    it('flags types that 3+ members are weak to', () => {
      const team: (['fire'] | ['electric'] | ['steel'] | ['water'])[] = [
        ['fire'], ['electric'], ['steel'], ['water'],
      ];
      const critical = getCriticalWeaknesses(team, 3);
      expect(critical.has('ground')).toBe(true);
      expect(critical.get('ground')).toBe(3);
    });

    it('returns empty map when no critical weaknesses exist', () => {
      const team: (['fire'] | ['water'] | ['grass'])[] = [['fire'], ['water'], ['grass']];
      const critical = getCriticalWeaknesses(team, 3);
      expect(critical.size).toBe(0);
    });
  });
});
