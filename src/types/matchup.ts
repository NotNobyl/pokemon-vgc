import type { PokemonType } from './pokemon';
import type { StatSpread } from './team';

export interface BoardState {
  myActive: [ActivePokemon | null, ActivePokemon | null];
  theirActive: [ActivePokemon | null, ActivePokemon | null];
  myBench: ActivePokemon[];
  theirBench: ActivePokemon[];
  weather: Weather;
  terrain: Terrain;
  screens: { reflect: boolean; lightScreen: boolean; auroraVeil: boolean };
  trickRoom: boolean;
  tailwind: { my: boolean; theirs: boolean };
  turn: number;
}

export interface ActivePokemon {
  teamMemberId: string;
  pokemonId: number;
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  currentHp: number;
  maxHp: number;
  stats: StatSpread;
  statBoosts: StatBoosts;
  status?: StatusCondition;
  terastallized: boolean;
  teraType?: PokemonType;
  ability: string;
  item: string;
  moves: string[];
}

export interface StatBoosts {
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

export const DEFAULT_STAT_BOOSTS: StatBoosts = {
  attack: 0, defense: 0, specialAttack: 0,
  specialDefense: 0, speed: 0, accuracy: 0, evasion: 0,
};

export type Weather = 'sun' | 'rain' | 'sand' | 'snow' | 'none';
export type Terrain = 'electric' | 'grassy' | 'psychic' | 'misty' | 'none';
export type StatusCondition = 'burn' | 'paralysis' | 'sleep' | 'poison' | 'toxic' | 'freeze';

export interface OpponentTeam {
  id: string;
  name: string;
  playerName?: string;
  date: number;
  members: OpponentPokemon[];
  notes?: string;
}

export interface OpponentPokemon {
  pokemonId: number;
  name: string;
  knownMoves?: string[];
  knownItem?: string;
  knownAbility?: string;
  knownTeraType?: PokemonType;
}

export interface DamageResult {
  min: number;
  max: number;
  minPercent: number;
  maxPercent: number;
  koChance: KOChance;
  ohkoPercent?: number;
}

export type KOChance = 'OHKO' | '2HKO' | '3HKO' | '4+HKO';

export interface MoveAdvice {
  slot: 0 | 1;
  move: string;
  target: string;
  score: number;
  reasoning: string;
  damageResult?: DamageResult;
}

export interface ThreatEntry {
  myPokemon: string;
  theirPokemon: string;
  theyThreatenMe: DamageResult | null;
  iThreatenThem: DamageResult | null;
  speedComparison: 'faster' | 'slower' | 'tie';
}
