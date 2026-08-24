import type { Regulation } from '@/types/regulation';
import type { Team, TeamMember } from '@/types/team';

export interface ValidationError {
  field: string;
  memberId?: string;
  message: string;
}

/**
 * Validate a team against a regulation's rules.
 */
export function validateTeam(team: Team, regulation: Regulation): ValidationError[] {
  const errors: ValidationError[] = [];

  // Team size
  if (team.members.length > regulation.teamSize) {
    errors.push({
      field: 'teamSize',
      message: `Team has ${team.members.length} members but regulation allows max ${regulation.teamSize}`,
    });
  }

  // Species clause
  const speciesSeen = new Set<number>();
  for (const member of team.members) {
    if (speciesSeen.has(member.pokemonId)) {
      errors.push({
        field: 'species',
        memberId: member.id,
        message: `Duplicate species: Pokémon #${member.pokemonId} appears more than once`,
      });
    }
    speciesSeen.add(member.pokemonId);
  }

  // Item clause
  const itemsSeen = new Set<string>();
  for (const member of team.members) {
    if (member.item) {
      const itemKey = member.item.toLowerCase();
      if (itemsSeen.has(itemKey)) {
        errors.push({
          field: 'item',
          memberId: member.id,
          message: `Duplicate item: "${member.item}" is already used by another team member`,
        });
      }
      itemsSeen.add(itemKey);
    }
  }

  // Level cap
  for (const member of team.members) {
    if (member.level > regulation.level) {
      errors.push({
        field: 'level',
        memberId: member.id,
        message: `Level ${member.level} exceeds cap of ${regulation.level}`,
      });
    }
  }

  // Banned Pokémon
  for (const member of team.members) {
    if (regulation.bannedPokemon.includes(member.pokemonId)) {
      errors.push({
        field: 'pokemon',
        memberId: member.id,
        message: `Pokémon #${member.pokemonId} is banned in ${regulation.name}`,
      });
    }
  }

  // Allowed Pokémon (if allowedPokemon is non-empty, it's a whitelist)
  if (regulation.allowedPokemon.length > 0) {
    for (const member of team.members) {
      if (!regulation.allowedPokemon.includes(member.pokemonId)) {
        errors.push({
          field: 'pokemon',
          memberId: member.id,
          message: `Pokémon #${member.pokemonId} is not in the allowed list for ${regulation.name}`,
        });
      }
    }
  }

  // Banned items
  for (const member of team.members) {
    if (member.item && regulation.bannedItems.includes(member.item.toLowerCase())) {
      errors.push({
        field: 'item',
        memberId: member.id,
        message: `"${member.item}" is banned in ${regulation.name}`,
      });
    }
  }

  // EV validation (max 510 total, max 252 per stat)
  for (const member of team.members) {
    const evErrors = validateEVs(member);
    errors.push(...evErrors);
  }

  // Move count
  for (const member of team.members) {
    if (member.moves.length > 4) {
      errors.push({
        field: 'moves',
        memberId: member.id,
        message: 'A Pokémon can have at most 4 moves',
      });
    }
    // Check for duplicate moves
    const moveSet = new Set(member.moves.map((m) => m.toLowerCase()));
    if (moveSet.size < member.moves.length) {
      errors.push({
        field: 'moves',
        memberId: member.id,
        message: 'Duplicate moves are not allowed',
      });
    }
  }

  return errors;
}

function validateEVs(member: TeamMember): ValidationError[] {
  const errors: ValidationError[] = [];
  const { evs } = member;
  const total = evs.hp + evs.attack + evs.defense + evs.specialAttack + evs.specialDefense + evs.speed;

  if (total > 510) {
    errors.push({
      field: 'evs',
      memberId: member.id,
      message: `Total EVs (${total}) exceed maximum of 510`,
    });
  }

  const stats = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;
  for (const stat of stats) {
    if (evs[stat] > 252) {
      errors.push({
        field: 'evs',
        memberId: member.id,
        message: `${stat} EVs (${evs[stat]}) exceed maximum of 252`,
      });
    }
    if (evs[stat] < 0) {
      errors.push({
        field: 'evs',
        memberId: member.id,
        message: `${stat} EVs cannot be negative`,
      });
    }
  }

  return errors;
}

/**
 * Check if a specific Pokémon is legal in a regulation.
 */
export function isPokemonLegal(pokemonId: number, regulation: Regulation): boolean {
  if (regulation.bannedPokemon.includes(pokemonId)) return false;
  if (regulation.allowedPokemon.length > 0) {
    return regulation.allowedPokemon.includes(pokemonId);
  }
  return true;
}

/**
 * Check if an item is legal in a regulation.
 */
export function isItemLegal(item: string, regulation: Regulation): boolean {
  return !regulation.bannedItems.includes(item.toLowerCase());
}
