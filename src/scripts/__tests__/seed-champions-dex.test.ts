import { describe, expect, it } from 'vitest';
import {
  championsEntryToPokemon,
  stableId,
} from '@/scripts/seed-champions-dex';
import type { IndexEntry } from '@/data/sources/champions-battle-data';

const abomasnow: IndexEntry = {
  showdownId: 'abomasnow',
  displayName: 'Abomasnow',
  types: ['Grass', 'Ice'],
  baseStats: {
    hp: 165,
    attack: 112,
    defense: 95,
    sp_attack: 112,
    sp_defense: 105,
    speed: 80,
  },
  abilities: ['Snow Warning', 'Soundproof'],
  learnableMoveNames: ['Blizzard', 'Ice Beam', 'Protect'],
};

describe('champions dex transformer', () => {
  it('maps types to lowercase PokemonType values', () => {
    const p = championsEntryToPokemon(abomasnow);
    expect(p.types).toEqual(['grass', 'ice']);
  });

  it('maps sp_attack/sp_defense to specialAttack/specialDefense', () => {
    const p = championsEntryToPokemon(abomasnow);
    expect(p.baseStats.specialAttack).toBe(112);
    expect(p.baseStats.specialDefense).toBe(105);
    expect(p.baseStats.hp).toBe(165);
    expect(p.baseStats.speed).toBe(80);
  });

  it('keeps display name and full movepool/abilities', () => {
    const p = championsEntryToPokemon(abomasnow);
    expect(p.name).toBe('Abomasnow');
    expect(p.abilities).toEqual(['Snow Warning', 'Soundproof']);
    expect(p.movepool).toContain('Ice Beam');
  });

  it('produces a stable, positive numeric id', () => {
    const id1 = stableId('abomasnow');
    const id2 = stableId('abomasnow');
    expect(id1).toBe(id2); // deterministic
    expect(id1).toBeGreaterThan(0);
    expect(Number.isInteger(id1)).toBe(true);
    // Different species -> different id (collision extremely unlikely).
    expect(stableId('garchomp')).not.toBe(id1);
  });

  it('produces ids across the full 32-bit range (no lossy modulo)', () => {
    // Regression guard: the old implementation used `% 1_000_000` which caused
    // ~175/237 collisions and silently dropped Pokémon on seed. Ensure ids are
    // no longer clamped into a tiny range.
    const samples = ['gholdengo', 'arcaninehisui', 'fluttermane', 'incineroar'];
    const ids = samples.map(stableId);
    // At least one id should exceed 1,000,000 (impossible under the old modulo).
    expect(ids.some((id) => id > 1_000_000)).toBe(true);
    expect(ids.every((id) => id <= 0xffffffff)).toBe(true);
  });

  it('a probing scheme yields unique ids even when bases collide', () => {
    // Mirror the seeder's linear-probe collision resolution.
    const names = [
      'absol', 'arcaninehisui', 'garchomp', 'emolga', 'incineroar',
      'aromatisse', 'palafin', 'aurorus', 'gholdengo', 'raichualola',
    ];
    const used = new Set<number>();
    for (const n of names) {
      let id = stableId(n);
      while (used.has(id)) id = (id + 1) >>> 0;
      used.add(id);
    }
    expect(used.size).toBe(names.length); // no drops
  });

  it('falls back to normal type when types are empty/invalid', () => {
    const p = championsEntryToPokemon({
      showdownId: 'x',
      displayName: 'X',
      types: ['Bogus'],
    });
    expect(p.types).toEqual(['normal']);
  });
});
