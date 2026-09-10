import { describe, it, expect } from 'vitest';
import { regulationLegalDex } from '../regulation-dex';
import type { Regulation } from '@/types/regulation';

/** Minimal regulation factory for tests. */
function reg(partial: Partial<Regulation>): Regulation {
  return {
    id: 'test',
    name: 'Test Regulation',
    game: 'champions',
    generation: 9,
    allowedPokemon: [],
    bannedPokemon: [],
    allowedItems: [],
    bannedItems: [],
    megaEvolutions: { allowed: true, legalMegas: [] },
    terastallize: false,
    dynamax: false,
    level: 50,
    teamSize: 6,
    bringCount: 4,
    ...partial,
  };
}

const dex = [
  { id: 3, name: 'Venusaur', types: ['grass', 'poison'] },
  { id: 6, name: 'Charizard', types: ['fire', 'flying'] },
  { id: 150, name: 'Mewtwo', types: ['psychic'] },
  { id: 445, name: 'Garchomp', types: ['dragon', 'ground'] },
];

describe('regulationLegalDex', () => {
  it('excludes banned Pokémon by dex id', () => {
    const out = regulationLegalDex(dex, reg({ bannedPokemon: [150] }));
    expect(out.map((d) => d.id)).toEqual([3, 6, 445]);
    expect(out.some((d) => d.name === 'Mewtwo')).toBe(false);
  });

  it('treats a non-empty allowedPokemon as a whitelist', () => {
    const out = regulationLegalDex(dex, reg({ allowedPokemon: [3, 6] }));
    expect(out.map((d) => d.id)).toEqual([3, 6]);
  });

  it('lets banned override the whitelist (both applied)', () => {
    const out = regulationLegalDex(
      dex,
      reg({ allowedPokemon: [3, 6, 150], bannedPokemon: [150] }),
    );
    expect(out.map((d) => d.id)).toEqual([3, 6]);
  });

  it('returns everything legal when no bans and empty whitelist', () => {
    const out = regulationLegalDex(dex, reg({}));
    expect(out).toHaveLength(4);
  });

  it('returns the dex unchanged when regulation is undefined', () => {
    const out = regulationLegalDex(dex, undefined);
    expect(out).toBe(dex);
  });

  it('preserves the original entry objects (identity + extra fields)', () => {
    const out = regulationLegalDex(dex, reg({ bannedPokemon: [150] }));
    expect(out[0]).toBe(dex[0]);
    expect(out[0].types).toEqual(['grass', 'poison']);
  });

  it('does not mutate the input array', () => {
    const input = [...dex];
    regulationLegalDex(input, reg({ bannedPokemon: [3] }));
    expect(input).toHaveLength(4);
  });
});
