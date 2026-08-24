import type { PokemonType } from '@/types/pokemon';
import { POKEMON_TYPES } from '@/types/pokemon';
import { getEffectiveness, getCriticalWeaknesses, getTeamWeaknesses, getTeamResistances } from './type-chart';

export interface SynergyReport {
  weaknesses: Map<PokemonType, number>;
  resistances: Map<PokemonType, number>;
  criticalWeaknesses: Map<PokemonType, number>;
  uncoveredTypes: PokemonType[];
  offensiveCoverage: Map<PokemonType, boolean>;
}

/**
 * Generate a full synergy report for a team's type composition.
 */
export function analyzeSynergy(
  memberTypes: ([PokemonType] | [PokemonType, PokemonType])[],
  moveTypes: PokemonType[][],  // each member's move types for offensive coverage
): SynergyReport {
  const weaknesses = getTeamWeaknesses(memberTypes);
  const resistances = getTeamResistances(memberTypes);
  const criticalWeaknesses = getCriticalWeaknesses(memberTypes, 3);

  // Offensive coverage: can any team member hit this type super-effectively?
  const offensiveCoverage = new Map<PokemonType, boolean>();
  for (const defType of POKEMON_TYPES) {
    let covered = false;
    for (const memberMoves of moveTypes) {
      for (const moveType of memberMoves) {
        if (getEffectiveness(moveType, [defType]) > 1) {
          covered = true;
          break;
        }
      }
      if (covered) break;
    }
    offensiveCoverage.set(defType, covered);
  }

  // Types that we have no super-effective coverage against and 2+ members are weak to
  const uncoveredTypes = POKEMON_TYPES.filter(
    (type) => !offensiveCoverage.get(type) && (weaknesses.get(type) ?? 0) >= 2,
  );

  return {
    weaknesses,
    resistances,
    criticalWeaknesses,
    uncoveredTypes,
    offensiveCoverage,
  };
}

export interface RoleCoverage {
  hasSpeedControl: boolean;
  speedControlMoves: string[];
  hasFakeOut: boolean;
  fakeOutUsers: string[];
  hasRedirection: boolean;
  redirectionUsers: string[];
  hasWeatherSetter: boolean;
  weatherSetters: string[];
  hasIntimidation: boolean;
  intimidateUsers: string[];
  hasPriorityMoves: boolean;
  priorityUsers: string[];
}

const SPEED_CONTROL_MOVES = [
  'tailwind', 'trick room', 'icy wind', 'electroweb', 'thunder wave',
  'string shot', 'cotton spore', 'scary face', 'bulldoze',
];

const REDIRECTION_MOVES = ['follow me', 'rage powder', 'ally switch'];

const WEATHER_MOVES = [
  'sunny day', 'rain dance', 'sandstorm', 'snowscape', 'hail',
];

const WEATHER_ABILITIES = [
  'drought', 'drizzle', 'sand stream', 'snow warning', 'orichalcum pulse',
  'desolate land', 'primordial sea',
];

const PRIORITY_MOVES = [
  'fake out', 'quick attack', 'mach punch', 'bullet punch', 'aqua jet',
  'ice shard', 'shadow sneak', 'sucker punch', 'extreme speed', 'accelerock',
  'grassy glide', 'jet punch', 'first impression',
];

/**
 * Check team role coverage — which key VGC roles are filled.
 */
export function checkRoleCoverage(
  team: { name: string; moves: string[]; ability: string }[],
): RoleCoverage {
  const result: RoleCoverage = {
    hasSpeedControl: false,
    speedControlMoves: [],
    hasFakeOut: false,
    fakeOutUsers: [],
    hasRedirection: false,
    redirectionUsers: [],
    hasWeatherSetter: false,
    weatherSetters: [],
    hasIntimidation: false,
    intimidateUsers: [],
    hasPriorityMoves: false,
    priorityUsers: [],
  };

  for (const member of team) {
    const movesLower = member.moves.map((m) => m.toLowerCase());
    const abilityLower = member.ability.toLowerCase();

    // Speed control
    const speedMoves = movesLower.filter((m) => SPEED_CONTROL_MOVES.includes(m));
    if (speedMoves.length > 0) {
      result.hasSpeedControl = true;
      result.speedControlMoves.push(...speedMoves.map((m) => `${member.name}: ${m}`));
    }

    // Fake Out
    if (movesLower.includes('fake out')) {
      result.hasFakeOut = true;
      result.fakeOutUsers.push(member.name);
    }

    // Redirection
    const redirectMoves = movesLower.filter((m) => REDIRECTION_MOVES.includes(m));
    if (redirectMoves.length > 0) {
      result.hasRedirection = true;
      result.redirectionUsers.push(member.name);
    }

    // Weather
    const weatherMoves = movesLower.filter((m) => WEATHER_MOVES.includes(m));
    if (weatherMoves.length > 0 || WEATHER_ABILITIES.includes(abilityLower)) {
      result.hasWeatherSetter = true;
      result.weatherSetters.push(member.name);
    }

    // Intimidate
    if (abilityLower === 'intimidate') {
      result.hasIntimidation = true;
      result.intimidateUsers.push(member.name);
    }

    // Priority
    const priorityMoves = movesLower.filter((m) => PRIORITY_MOVES.includes(m));
    if (priorityMoves.length > 0) {
      result.hasPriorityMoves = true;
      result.priorityUsers.push(member.name);
    }
  }

  return result;
}
