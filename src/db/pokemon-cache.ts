import type { Move, Pokemon } from '@/types/pokemon';
import { db } from './database';

export async function getPokemonById(id: number): Promise<Pokemon | undefined> {
  return db.pokemon.get(id);
}

export async function getPokemonByName(name: string): Promise<Pokemon | undefined> {
  return db.pokemon.where('name').equalsIgnoreCase(name).first();
}

export async function searchPokemon(query: string, limit = 20): Promise<Pokemon[]> {
  const q = query.trim().toLowerCase();
  if (!q) return db.pokemon.limit(limit).toArray();

  // PokéAPI stores names as hyphenated lowercase slugs (e.g. "iron-hands",
  // "flutter-mane", "raichu-alola"). Users type spaces and mixed case, so
  // normalize both sides and match on a substring, not just a prefix.
  const normalized = q.replace(/\s+/g, '-');
  const collapsed = q.replace(/[\s-]+/g, ''); // for "ironhands" style typing

  const all = await db.pokemon.toArray();
  const scored = all
    .map((p) => {
      const name = p.name.toLowerCase();
      const nameCollapsed = name.replace(/[-]/g, '');
      let rank = -1;
      if (name === normalized || nameCollapsed === collapsed) rank = 0; // exact
      else if (name.startsWith(normalized) || nameCollapsed.startsWith(collapsed))
        rank = 1; // prefix
      else if (name.includes(normalized) || nameCollapsed.includes(collapsed))
        rank = 2; // substring
      return { p, rank };
    })
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p);

  return scored;
}

export async function getAllPokemon(): Promise<Pokemon[]> {
  return db.pokemon.toArray();
}

export async function bulkStorePokemon(pokemon: Pokemon[]): Promise<void> {
  await db.pokemon.bulkPut(pokemon);
}

/** Remove all cached Pokémon (used before a full re-seed). */
export async function clearPokemon(): Promise<void> {
  await db.pokemon.clear();
}

export async function getMoveByName(name: string): Promise<Move | undefined> {
  return db.moves.get(name);
}

export async function searchMoves(query: string, limit = 20): Promise<Move[]> {
  if (!query) return db.moves.limit(limit).toArray();
  return db.moves
    .where('name')
    .startsWithIgnoreCase(query)
    .limit(limit)
    .toArray();
}

export async function getMovesByNames(names: string[]): Promise<Move[]> {
  return db.moves.where('name').anyOf(names).toArray();
}

export async function bulkStoreMoves(moves: Move[]): Promise<void> {
  await db.moves.bulkPut(moves);
}

export async function getPokemonCount(): Promise<number> {
  return db.pokemon.count();
}

export async function getMoveCount(): Promise<number> {
  return db.moves.count();
}
