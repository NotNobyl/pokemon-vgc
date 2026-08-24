import type { Move, Pokemon } from '@/types/pokemon';
import { db } from './database';

export async function getPokemonById(id: number): Promise<Pokemon | undefined> {
  return db.pokemon.get(id);
}

export async function getPokemonByName(name: string): Promise<Pokemon | undefined> {
  return db.pokemon.where('name').equalsIgnoreCase(name).first();
}

export async function searchPokemon(query: string, limit = 20): Promise<Pokemon[]> {
  if (!query) return db.pokemon.limit(limit).toArray();
  return db.pokemon
    .where('name')
    .startsWithIgnoreCase(query)
    .limit(limit)
    .toArray();
}

export async function getAllPokemon(): Promise<Pokemon[]> {
  return db.pokemon.toArray();
}

export async function bulkStorePokemon(pokemon: Pokemon[]): Promise<void> {
  await db.pokemon.bulkPut(pokemon);
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
