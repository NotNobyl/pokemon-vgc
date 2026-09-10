/**
 * Regulation-aware dex filtering (pure, deterministic).
 *
 * The team-suggestion engines (team-recommend, off-meta) take a "dex" — the
 * pool of candidate species they may build teams from or surface as discovery
 * picks. Left unfiltered, that pool is the entire seeded dex, so suggestions can
 * include Pokémon that are NOT legal in the currently-selected regulation.
 *
 * This helper narrows any dex-like list to the species legal in a given
 * regulation, reusing the single source of truth for legality
 * (`isPokemonLegal`). Keeping it pure + generic (any object with a numeric `id`)
 * means both the meta-teams view and the lab can share one implementation, and
 * it stays unit-testable without React/IO.
 */

import type { Regulation } from '@/types/regulation';
import { isPokemonLegal } from './regulation-validator';

/** Minimal shape needed to test legality: a National Dex `id`. */
export interface DexEntryWithId {
  id: number;
}

/**
 * Filter a dex list to the species legal in `regulation`.
 *
 * - Excludes anything in `regulation.bannedPokemon` (by dex id).
 * - If `regulation.allowedPokemon` is non-empty, treats it as a whitelist.
 * - When `regulation` is undefined (e.g. selected id not found), returns the
 *   dex unchanged rather than hiding everything — a missing reg must not
 *   silently empty the builder.
 *
 * Generic over any entry carrying a numeric `id`, so callers can pass their own
 * richer dex objects (name/types/baseStats/…) and get the same objects back.
 */
export function regulationLegalDex<T extends DexEntryWithId>(
  dex: T[],
  regulation: Regulation | undefined,
): T[] {
  if (!regulation) return dex;
  return dex.filter((entry) => isPokemonLegal(entry.id, regulation));
}
