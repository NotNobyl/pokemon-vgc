import { describe, expect, it } from 'vitest';
import {
  canonicalize,
  candidateKeys,
  buildPokemonNameIndex,
  resolveLocalPokemon,
} from '@/data/sources/showdown-mapping';
import type { Pokemon } from '@/types/pokemon';

function mkPokemon(id: number, name: string): Pokemon {
  return {
    id,
    name,
    types: ['normal'],
    baseStats: {
      hp: 1,
      attack: 1,
      defense: 1,
      specialAttack: 1,
      specialDefense: 1,
      speed: 1,
    },
    abilities: [],
    movepool: [],
    weight: 1,
  };
}

describe('showdown-mapping', () => {
  it('canonicalizes names by stripping non-alphanumerics', () => {
    expect(canonicalize('Raichu-Alola')).toBe('raichualola');
    expect(canonicalize('Iron Hands')).toBe('ironhands');
    expect(canonicalize("Farfetch'd")).toBe('farfetchd');
  });

  it('produces candidate keys bridging prefix/suffix form conventions', () => {
    const keys = candidateKeys('raichu-alola');
    // PokéAPI slug "raichu-alola" -> canonical "raichualola" (Showdown id form)
    expect(keys).toContain('raichualola');
  });

  it('bridges prefixed regional names to suffixed Showdown ids', () => {
    const keys = candidateKeys('alolan raichu');
    expect(keys).toContain('raichualola');
  });

  it('resolves a Showdown id to a local PokéAPI-named record', () => {
    const index = buildPokemonNameIndex([
      mkPokemon(26, 'raichu-alola'),
      mkPokemon(445, 'garchomp'),
    ]);
    expect(resolveLocalPokemon(index, 'raichualola')?.id).toBe(26);
    expect(resolveLocalPokemon(index, 'garchomp')?.id).toBe(445);
    expect(resolveLocalPokemon(index, 'nonexistent')).toBeUndefined();
  });
});
