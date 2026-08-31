/**
 * Mapping between the Champions Battle Data API's Showdown internal IDs /
 * display names and our locally-cached Pokémon records (seeded from PokéAPI).
 *
 * The API uses Showdown IDs like "garchomp", "taurospaldeaaqua", "raichualola".
 * Our local Pokemon.name uses PokéAPI slugs like "garchomp", "raichu-alola".
 * We canonicalize both sides to a comparable key so usage data can be attached
 * to the right species/form, and fall back to loose matching by base name.
 */

import type { Pokemon } from '@/types/pokemon';

/**
 * Reduce any name/id form to a comparison key: lowercase, strip everything
 * that isn't a letter or digit. So "Raichu-Alola", "raichualola", and
 * "Alolan Raichu" collapse toward the same neighborhood.
 */
export function canonicalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Showdown places the form suffix at the END ("raichualola"), while some
 * human/PokéAPI forms place region at the FRONT ("alolan raichu" /
 * "raichu-alola"). This produces a set of candidate canonical keys for a name
 * so we can match across those conventions.
 */
export function candidateKeys(name: string): string[] {
  const base = canonicalize(name);
  const keys = new Set<string>([base]);

  // Normalize regional adjective variants to their short form first
  // ("alolan" -> "alola", "galarian" -> "galar", etc.), so downstream
  // prefix/suffix relocation works on a consistent token.
  const normalized = base
    .replace(/alolan/g, 'alola')
    .replace(/galarian/g, 'galar')
    .replace(/hisuian/g, 'hisui')
    .replace(/paldean/g, 'paldea');
  keys.add(normalized);

  // Region/form tokens that may appear as a prefix or a suffix.
  const tokens = ['alola', 'galar', 'hisui', 'paldea', 'mega', 'gmax'];

  // Apply relocation to BOTH the raw base and the normalized form.
  for (const form of [base, normalized]) {
    for (const t of tokens) {
      if (form.startsWith(t)) {
        keys.add(form.slice(t.length) + t); // prefix -> suffix
      }
      if (form.endsWith(t)) {
        keys.add(t + form.slice(0, form.length - t.length)); // suffix -> prefix
      }
    }
  }

  return [...keys];
}

export interface PokemonNameIndex {
  byKey: Map<string, Pokemon>;
}

/** Build a lookup index from our local Pokémon list. */
export function buildPokemonNameIndex(pokemon: Pokemon[]): PokemonNameIndex {
  const byKey = new Map<string, Pokemon>();
  for (const p of pokemon) {
    for (const key of candidateKeys(p.name)) {
      // First writer wins to keep base forms stable; don't clobber.
      if (!byKey.has(key)) byKey.set(key, p);
    }
  }
  return { byKey };
}

/**
 * Resolve a Champions Showdown id (or display name) to a local Pokémon record.
 * Returns undefined if we have no matching cached species.
 */
export function resolveLocalPokemon(
  index: PokemonNameIndex,
  showdownIdOrName: string,
): Pokemon | undefined {
  for (const key of candidateKeys(showdownIdOrName)) {
    const hit = index.byKey.get(key);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Given a local Pokémon, produce the best-guess Showdown id used by the API.
 * This is a heuristic: the API accepts human names case-insensitively too, so
 * the primary path is to look the species up in the fetched index by name.
 */
export function toShowdownIdGuess(pokemonName: string): string {
  return canonicalize(pokemonName);
}
