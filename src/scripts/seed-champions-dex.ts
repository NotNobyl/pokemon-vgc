/**
 * Seed the local Pokémon dex from the Champions Battle Data API index.
 *
 * This replaces the old ~50-mon PokéAPI seed with the full real Champions
 * roster (~237 mons). Everything needed comes from ONE /api call (types, base
 * stats, abilities, learnable moves, sprite), so seeding is a single request +
 * a bulk write — fast and offline-friendly after first load.
 *
 * Unifies the data source: the same API that powers usage/meta/matchup now also
 * powers the dex, so every Pokémon that appears in usage data is searchable.
 */

import type { Pokemon, PokemonType } from '@/types/pokemon';
import { POKEMON_TYPES } from '@/types/pokemon';
import { bulkStorePokemon } from '@/db/pokemon-cache';
import { fetchIndex, type IndexEntry } from '@/data/sources/champions-battle-data';

/**
 * Stable numeric id derived from the Showdown id. The Champions index has no
 * national dex number (dex: null), but our data model + species-clause use a
 * numeric id. A deterministic hash keeps ids stable across re-seeds so saved
 * teams keep referring to the same species.
 *
 * Uses the full 32-bit FNV-1a range (no lossy modulo) to minimize collisions.
 * The seeder additionally resolves any residual collisions by probing, so no
 * Pokémon is ever dropped.
 */
export function stableId(showdownId: string): number {
  let h = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < showdownId.length; i++) {
    h ^= showdownId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Full unsigned 32-bit value. Wide space => collisions are astronomically
  // rare; the seeder still guards against them.
  return h >>> 0;
}

/** Map the index's stat keys to our BaseStats shape. */
function mapStats(raw: Record<string, number> | undefined): Pokemon['baseStats'] {
  const s = raw ?? {};
  return {
    hp: s.hp ?? 0,
    attack: s.attack ?? 0,
    defense: s.defense ?? 0,
    // Index uses sp_attack / sp_defense (underscore); also accept camel forms.
    specialAttack: s.sp_attack ?? s.specialAttack ?? s.spa ?? 0,
    specialDefense: s.sp_defense ?? s.specialDefense ?? s.spd ?? 0,
    speed: s.speed ?? 0,
  };
}

const TYPE_SET = new Set<string>(POKEMON_TYPES);

/** Lowercase + validate types against our PokemonType union. */
function mapTypes(raw: string[]): Pokemon['types'] {
  const cleaned = raw
    .map((t) => t.toLowerCase())
    .filter((t): t is PokemonType => TYPE_SET.has(t));
  if (cleaned.length === 0) return ['normal'];
  if (cleaned.length === 1) return [cleaned[0]];
  return [cleaned[0], cleaned[1]];
}

/** Transform one Champions index entry into our Pokemon record. */
export function championsEntryToPokemon(entry: IndexEntry): Pokemon {
  return {
    id: stableId(entry.showdownId),
    // Store the human display name (e.g. "Iron Hands"). Search is normalized to
    // handle spaces/case, and the UI displays it directly.
    name: entry.displayName,
    types: mapTypes(entry.types),
    baseStats: mapStats(entry.baseStats),
    abilities: entry.abilities ?? [],
    // Champions "learnable moves" are display names (e.g. "Ice Beam"), which is
    // what the move-search UI shows and what usage rows use — consistent.
    movepool: entry.learnableMoveNames ?? [],
    weight: 0, // Champions index does not expose weight; 0 = unknown.
  };
}

export interface ChampionsSeedResult {
  seeded: number;
  /** Count of raw entries skipped as exact duplicates (same showdownId). */
  duplicatesSkipped: number;
  season: string;
}

/**
 * Fetch the Champions index and seed the full dex. Calls onProgress with a
 * simple two-phase signal (fetch, then store). Returns count + season, or
 * throws if the index can't be reached (caller surfaces the error).
 */
export async function seedPokemonFromChampions(
  onProgress?: (current: number, total: number) => void,
): Promise<ChampionsSeedResult> {
  onProgress?.(0, 1);
  const index = await fetchIndex();
  if (!index) {
    throw new Error(
      'Could not reach the Champions Battle Data API to load the Pokédex.',
    );
  }

  // Transform every entry. Guarantee unique numeric ids: the FNV-1a base id is
  // stable per species, but if two species ever hash to the same value we probe
  // to the next free id so NO Pokémon is dropped. Identity/dedup is by the
  // unique showdownId, not the numeric id.
  const usedIds = new Set<number>();
  const seenShowdownIds = new Set<string>();
  const unique: Pokemon[] = [];
  let duplicatesSkipped = 0;

  for (const entry of index.entries) {
    if (seenShowdownIds.has(entry.showdownId)) {
      // Exact duplicate (same showdownId) — e.g. the API lists Rotom Fan twice
      // as "Fan Rotom" and "Rotom Fan". Skipping it is correct, not a failure.
      duplicatesSkipped++;
      continue;
    }
    seenShowdownIds.add(entry.showdownId);

    const pokemon = championsEntryToPokemon(entry);
    // Resolve any numeric-id collision deterministically by linear probing.
    let id = pokemon.id;
    while (usedIds.has(id)) {
      id = (id + 1) >>> 0;
    }
    usedIds.add(id);
    pokemon.id = id;
    unique.push(pokemon);
  }

  onProgress?.(unique.length, unique.length);
  await bulkStorePokemon(unique);

  return { seeded: unique.length, duplicatesSkipped, season: index.season };
}
