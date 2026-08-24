import type { BaseStats, Nature, PokemonType } from './pokemon';

export interface StatSpread {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface TeamMember {
  id: string;
  pokemonId: number;
  nickname?: string;
  ability: string;
  item: string;
  teraType?: PokemonType;
  moves: string[];
  evs: StatSpread;
  ivs: StatSpread;
  nature: Nature;
  level: number;
  available: boolean;
}

export interface Team {
  id: string;
  name: string;
  regulationId: string;
  archetype: string[];
  members: TeamMember[];
  createdAt: number;
  updatedAt: number;
}

export type Archetype =
  | 'trick-room'
  | 'rain'
  | 'sun'
  | 'sand'
  | 'snow'
  | 'tailwind'
  | 'bulky-balance'
  | 'hyper-offense'
  | 'goodstuffs';

export const DEFAULT_EVS: StatSpread = {
  hp: 0, attack: 0, defense: 0,
  specialAttack: 0, specialDefense: 0, speed: 0,
};

export const DEFAULT_IVS: StatSpread = {
  hp: 31, attack: 31, defense: 31,
  specialAttack: 31, specialDefense: 31, speed: 31,
};

export const SPREAD_PRESETS: Record<string, { name: string; evs: StatSpread; nature: Nature }> = {
  'fast-physical': {
    name: 'Fast Physical Attacker',
    evs: { hp: 4, attack: 252, defense: 0, specialAttack: 0, specialDefense: 0, speed: 252 },
    nature: 'jolly',
  },
  'fast-special': {
    name: 'Fast Special Attacker',
    evs: { hp: 4, attack: 0, defense: 0, specialAttack: 252, specialDefense: 0, speed: 252 },
    nature: 'timid',
  },
  'bulky-physical': {
    name: 'Bulky Physical Wall',
    evs: { hp: 252, attack: 0, defense: 252, specialAttack: 0, specialDefense: 4, speed: 0 },
    nature: 'impish',
  },
  'bulky-special': {
    name: 'Bulky Special Wall',
    evs: { hp: 252, attack: 0, defense: 4, specialAttack: 0, specialDefense: 252, speed: 0 },
    nature: 'calm',
  },
  'trick-room-attacker': {
    name: 'Trick Room Attacker',
    evs: { hp: 252, attack: 252, defense: 4, specialAttack: 0, specialDefense: 0, speed: 0 },
    nature: 'brave',
  },
  'trick-room-support': {
    name: 'Trick Room Support',
    evs: { hp: 252, attack: 0, defense: 128, specialAttack: 0, specialDefense: 128, speed: 0 },
    nature: 'relaxed',
  },
  'offensive-bulky': {
    name: 'Offensive Bulky',
    evs: { hp: 244, attack: 12, defense: 0, specialAttack: 252, specialDefense: 0, speed: 0 },
    nature: 'modest',
  },
};

export function calcStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  natureMultiplier: number,
  isHp: boolean,
): number {
  if (isHp) {
    if (base === 1) return 1; // Shedinja
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }
  return Math.floor(
    (Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) * natureMultiplier,
  );
}

export function calcAllStats(
  baseStats: BaseStats,
  evs: StatSpread,
  ivs: StatSpread,
  level: number,
  natureMultiplier: Record<keyof BaseStats, number>,
): StatSpread {
  return {
    hp: calcStat(baseStats.hp, ivs.hp, evs.hp, level, 1, true),
    attack: calcStat(baseStats.attack, ivs.attack, evs.attack, level, natureMultiplier.attack, false),
    defense: calcStat(baseStats.defense, ivs.defense, evs.defense, level, natureMultiplier.defense, false),
    specialAttack: calcStat(baseStats.specialAttack, ivs.specialAttack, evs.specialAttack, level, natureMultiplier.specialAttack, false),
    specialDefense: calcStat(baseStats.specialDefense, ivs.specialDefense, evs.specialDefense, level, natureMultiplier.specialDefense, false),
    speed: calcStat(baseStats.speed, ivs.speed, evs.speed, level, natureMultiplier.speed, false),
  };
}
