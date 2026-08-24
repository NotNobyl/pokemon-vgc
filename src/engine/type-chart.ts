import type { PokemonType } from '@/types/pokemon';
import { POKEMON_TYPES } from '@/types/pokemon';

/**
 * Type effectiveness chart.
 * effectivenessChart[attackType][defenseType] = multiplier
 * 0 = immune, 0.5 = not very effective, 1 = neutral, 2 = super effective
 */
const chart: Record<PokemonType, Record<PokemonType, number>> = {
  normal:   { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 0.5, ghost: 0, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  fire:     { normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 2, ice: 2, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 2, rock: 0.5, ghost: 1, dragon: 0.5, dark: 1, steel: 2, fairy: 1 },
  water:    { normal: 1, fire: 2, water: 0.5, electric: 1, grass: 0.5, ice: 1, fighting: 1, poison: 1, ground: 2, flying: 1, psychic: 1, bug: 1, rock: 2, ghost: 1, dragon: 0.5, dark: 1, steel: 1, fairy: 1 },
  electric: { normal: 1, fire: 1, water: 2, electric: 0.5, grass: 0.5, ice: 1, fighting: 1, poison: 1, ground: 0, flying: 2, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 0.5, dark: 1, steel: 1, fairy: 1 },
  grass:    { normal: 1, fire: 0.5, water: 2, electric: 1, grass: 0.5, ice: 1, fighting: 1, poison: 0.5, ground: 2, flying: 0.5, psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 0.5, dark: 1, steel: 0.5, fairy: 1 },
  ice:      { normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 2, ice: 0.5, fighting: 1, poison: 1, ground: 2, flying: 2, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 1, steel: 0.5, fairy: 1 },
  fighting: { normal: 2, fire: 1, water: 1, electric: 1, grass: 1, ice: 2, fighting: 1, poison: 0.5, ground: 1, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dragon: 1, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { normal: 1, fire: 1, water: 1, electric: 1, grass: 2, ice: 1, fighting: 1, poison: 0.5, ground: 0.5, flying: 1, psychic: 1, bug: 1, rock: 0.5, ghost: 0.5, dragon: 1, dark: 1, steel: 0, fairy: 2 },
  ground:   { normal: 1, fire: 2, water: 1, electric: 2, grass: 0.5, ice: 1, fighting: 1, poison: 2, ground: 1, flying: 0, psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 1, dark: 1, steel: 2, fairy: 1 },
  flying:   { normal: 1, fire: 1, water: 1, electric: 0.5, grass: 2, ice: 1, fighting: 2, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 2, rock: 0.5, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  psychic:  { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 2, poison: 2, ground: 1, flying: 1, psychic: 0.5, bug: 1, rock: 1, ghost: 1, dragon: 1, dark: 0, steel: 0.5, fairy: 1 },
  bug:      { normal: 1, fire: 0.5, water: 1, electric: 1, grass: 2, ice: 1, fighting: 0.5, poison: 0.5, ground: 1, flying: 0.5, psychic: 2, bug: 1, rock: 1, ghost: 0.5, dragon: 1, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { normal: 1, fire: 2, water: 1, electric: 1, grass: 1, ice: 2, fighting: 0.5, poison: 1, ground: 0.5, flying: 2, psychic: 1, bug: 2, rock: 1, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  ghost:    { normal: 0, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 2, bug: 1, rock: 1, ghost: 2, dragon: 1, dark: 0.5, steel: 1, fairy: 1 },
  dragon:   { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 1, steel: 0.5, fairy: 0 },
  dark:     { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 0.5, poison: 1, ground: 1, flying: 1, psychic: 2, bug: 1, rock: 1, ghost: 2, dragon: 1, dark: 0.5, steel: 1, fairy: 0.5 },
  steel:    { normal: 1, fire: 0.5, water: 0.5, electric: 0.5, grass: 1, ice: 2, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 2, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 2 },
  fairy:    { normal: 1, fire: 0.5, water: 1, electric: 1, grass: 1, ice: 1, fighting: 2, poison: 0.5, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 2, steel: 0.5, fairy: 1 },
};

/**
 * Get the type effectiveness multiplier for an attack type against one or two defender types.
 */
export function getEffectiveness(
  attackType: PokemonType,
  defenderTypes: [PokemonType] | [PokemonType, PokemonType],
): number {
  let multiplier = chart[attackType][defenderTypes[0]];
  if (defenderTypes.length === 2) {
    multiplier *= chart[attackType][defenderTypes[1]];
  }
  return multiplier;
}

/**
 * Get all weaknesses for a Pokémon's type combination (effectiveness > 1).
 */
export function getWeaknesses(
  types: [PokemonType] | [PokemonType, PokemonType],
): Map<PokemonType, number> {
  const weaknesses = new Map<PokemonType, number>();
  for (const attackType of POKEMON_TYPES) {
    const eff = getEffectiveness(attackType, types);
    if (eff > 1) {
      weaknesses.set(attackType, eff);
    }
  }
  return weaknesses;
}

/**
 * Get all resistances for a Pokémon's type combination (0 < effectiveness < 1).
 */
export function getResistances(
  types: [PokemonType] | [PokemonType, PokemonType],
): Map<PokemonType, number> {
  const resistances = new Map<PokemonType, number>();
  for (const attackType of POKEMON_TYPES) {
    const eff = getEffectiveness(attackType, types);
    if (eff > 0 && eff < 1) {
      resistances.set(attackType, eff);
    }
  }
  return resistances;
}

/**
 * Get all immunities for a Pokémon's type combination (effectiveness === 0).
 */
export function getImmunities(
  types: [PokemonType] | [PokemonType, PokemonType],
): PokemonType[] {
  return POKEMON_TYPES.filter((attackType) => getEffectiveness(attackType, types) === 0);
}

/**
 * Aggregate team weaknesses. Returns a map of attack types to how many team members are weak to it.
 */
export function getTeamWeaknesses(
  memberTypes: ([PokemonType] | [PokemonType, PokemonType])[],
): Map<PokemonType, number> {
  const counts = new Map<PokemonType, number>();
  for (const attackType of POKEMON_TYPES) {
    let weakCount = 0;
    for (const types of memberTypes) {
      if (getEffectiveness(attackType, types) > 1) {
        weakCount++;
      }
    }
    if (weakCount > 0) {
      counts.set(attackType, weakCount);
    }
  }
  return counts;
}

/**
 * Aggregate team resistances. Returns a map of attack types to how many team members resist it.
 */
export function getTeamResistances(
  memberTypes: ([PokemonType] | [PokemonType, PokemonType])[],
): Map<PokemonType, number> {
  const counts = new Map<PokemonType, number>();
  for (const attackType of POKEMON_TYPES) {
    let resistCount = 0;
    for (const types of memberTypes) {
      if (getEffectiveness(attackType, types) < 1) {
        resistCount++;
      }
    }
    if (resistCount > 0) {
      counts.set(attackType, resistCount);
    }
  }
  return counts;
}

/**
 * Find critical shared weaknesses (3+ team members weak to same type).
 */
export function getCriticalWeaknesses(
  memberTypes: ([PokemonType] | [PokemonType, PokemonType])[],
  threshold = 3,
): Map<PokemonType, number> {
  const teamWeaknesses = getTeamWeaknesses(memberTypes);
  const critical = new Map<PokemonType, number>();
  for (const [type, count] of teamWeaknesses) {
    if (count >= threshold) {
      critical.set(type, count);
    }
  }
  return critical;
}
