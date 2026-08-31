import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { bulkStorePokemon, searchPokemon } from '@/db/pokemon-cache';
import { db } from '@/db/database';
import type { Pokemon } from '@/types/pokemon';

function mk(id: number, name: string): Pokemon {
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

describe('searchPokemon', () => {
  beforeEach(async () => {
    await db.pokemon.clear();
    await bulkStorePokemon([
      mk(1, 'garchomp'),
      mk(2, 'iron-hands'),
      mk(3, 'flutter-mane'),
      mk(4, 'raichu-alola'),
      mk(5, 'incineroar'),
    ]);
  });

  it('matches a simple prefix', async () => {
    const r = await searchPokemon('gar');
    expect(r.map((p) => p.name)).toContain('garchomp');
  });

  it('matches hyphenated names typed with a space', async () => {
    const r = await searchPokemon('iron hands');
    expect(r.map((p) => p.name)).toContain('iron-hands');
  });

  it('matches when typed with no separator', async () => {
    const r = await searchPokemon('fluttermane');
    expect(r.map((p) => p.name)).toContain('flutter-mane');
  });

  it('matches a substring in the middle', async () => {
    const r = await searchPokemon('mane');
    expect(r.map((p) => p.name)).toContain('flutter-mane');
  });

  it('is case-insensitive', async () => {
    const r = await searchPokemon('Incineroar');
    expect(r.map((p) => p.name)).toContain('incineroar');
  });

  it('returns nothing for no match', async () => {
    const r = await searchPokemon('zzzznotamon');
    expect(r).toHaveLength(0);
  });
});
