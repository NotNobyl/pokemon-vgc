export const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

export type PokemonType = typeof POKEMON_TYPES[number];

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface Pokemon {
  id: number;
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: BaseStats;
  abilities: string[];
  movepool: string[];
  weight: number;
}

export interface Move {
  name: string;
  type: PokemonType;
  category: 'physical' | 'special' | 'status';
  basePower: number;
  accuracy: number;
  priority: number;
  targets: 'single' | 'spread' | 'self' | 'ally';
  flags: {
    contact: boolean;
    sound: boolean;
    bullet: boolean;
    punch: boolean;
    bite: boolean;
  };
  description: string;
}

export type Nature = 
  | 'hardy' | 'lonely' | 'brave' | 'adamant' | 'naughty'
  | 'bold' | 'docile' | 'relaxed' | 'impish' | 'lax'
  | 'timid' | 'hasty' | 'serious' | 'jolly' | 'naive'
  | 'modest' | 'mild' | 'quiet' | 'bashful' | 'rash'
  | 'calm' | 'gentle' | 'sassy' | 'careful' | 'quirky';

export interface NatureModifiers {
  plus?: keyof BaseStats;
  minus?: keyof BaseStats;
}

export const NATURE_MAP: Record<Nature, NatureModifiers> = {
  hardy: {},
  lonely: { plus: 'attack', minus: 'defense' },
  brave: { plus: 'attack', minus: 'speed' },
  adamant: { plus: 'attack', minus: 'specialAttack' },
  naughty: { plus: 'attack', minus: 'specialDefense' },
  bold: { plus: 'defense', minus: 'attack' },
  docile: {},
  relaxed: { plus: 'defense', minus: 'speed' },
  impish: { plus: 'defense', minus: 'specialAttack' },
  lax: { plus: 'defense', minus: 'specialDefense' },
  timid: { plus: 'speed', minus: 'attack' },
  hasty: { plus: 'speed', minus: 'defense' },
  serious: {},
  jolly: { plus: 'speed', minus: 'specialAttack' },
  naive: { plus: 'speed', minus: 'specialDefense' },
  modest: { plus: 'specialAttack', minus: 'attack' },
  mild: { plus: 'specialAttack', minus: 'defense' },
  quiet: { plus: 'specialAttack', minus: 'speed' },
  bashful: {},
  rash: { plus: 'specialAttack', minus: 'specialDefense' },
  calm: { plus: 'specialDefense', minus: 'attack' },
  gentle: { plus: 'specialDefense', minus: 'defense' },
  sassy: { plus: 'specialDefense', minus: 'speed' },
  careful: { plus: 'specialDefense', minus: 'specialAttack' },
  quirky: {},
};
