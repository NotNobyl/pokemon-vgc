import type { BaseStats, Nature } from '@/types/pokemon';
import { NATURE_MAP } from '@/types/pokemon';
import type { StatSpread } from '@/types/team';
import { calcStat } from '@/types/team';

export interface SpeedModifiers {
  statStage: number;          // -6 to +6
  choiceScarf: boolean;
  tailwind: boolean;
  trickRoom: boolean;
  paralysis: boolean;
  unburden: boolean;          // 2x if item consumed
  swiftSwim: boolean;         // 2x in rain
  chlorophyll: boolean;       // 2x in sun
  sandRush: boolean;          // 2x in sand
  slushRush: boolean;         // 2x in snow
  weather: 'sun' | 'rain' | 'sand' | 'snow' | 'none';
}

export const DEFAULT_SPEED_MODIFIERS: SpeedModifiers = {
  statStage: 0,
  choiceScarf: false,
  tailwind: false,
  trickRoom: false,
  paralysis: false,
  unburden: false,
  swiftSwim: false,
  chlorophyll: false,
  sandRush: false,
  slushRush: false,
  weather: 'none',
};

const STAT_STAGE_MULTIPLIERS: Record<string, number> = {
  '-6': 2/8, '-5': 2/7, '-4': 2/6, '-3': 2/5, '-2': 2/4, '-1': 2/3,
  '0': 1,
  '1': 3/2, '2': 4/2, '3': 5/2, '4': 6/2, '5': 7/2, '6': 8/2,
};

/**
 * Calculate the base speed stat for a Pokémon given its base stats, EVs, IVs, nature, and level.
 */
export function calcBaseSpeed(
  baseStats: BaseStats,
  evs: StatSpread,
  ivs: StatSpread,
  nature: Nature,
  level: number,
): number {
  const natureMod = NATURE_MAP[nature];
  let multiplier = 1;
  if (natureMod.plus === 'speed') multiplier = 1.1;
  if (natureMod.minus === 'speed') multiplier = 0.9;
  return calcStat(baseStats.speed, ivs.speed, evs.speed, level, multiplier, false);
}

/**
 * Calculate effective speed after all modifiers.
 */
export function calcEffectiveSpeed(
  baseSpeed: number,
  modifiers: Partial<SpeedModifiers> = {},
): number {
  const mods = { ...DEFAULT_SPEED_MODIFIERS, ...modifiers };

  let speed = baseSpeed;

  // Stat stage
  const stageMultiplier = STAT_STAGE_MULTIPLIERS[mods.statStage.toString()] ?? 1;
  speed = Math.floor(speed * stageMultiplier);

  // Paralysis (0.5x, applied after stat stage)
  if (mods.paralysis) {
    speed = Math.floor(speed * 0.5);
  }

  // Choice Scarf (1.5x)
  if (mods.choiceScarf) {
    speed = Math.floor(speed * 1.5);
  }

  // Tailwind (2x)
  if (mods.tailwind) {
    speed = Math.floor(speed * 2);
  }

  // Unburden (2x)
  if (mods.unburden) {
    speed = Math.floor(speed * 2);
  }

  // Weather abilities
  if (mods.swiftSwim && mods.weather === 'rain') {
    speed = Math.floor(speed * 2);
  }
  if (mods.chlorophyll && mods.weather === 'sun') {
    speed = Math.floor(speed * 2);
  }
  if (mods.sandRush && mods.weather === 'sand') {
    speed = Math.floor(speed * 2);
  }
  if (mods.slushRush && mods.weather === 'snow') {
    speed = Math.floor(speed * 2);
  }

  return speed;
}

/**
 * Compare speeds and determine turn order.
 * In Trick Room, slower moves first (but we return the effective speeds — UI handles display).
 */
export function compareSpeed(
  speed1: number,
  speed2: number,
  trickRoom: boolean,
): 'first' | 'second' | 'tie' {
  if (speed1 === speed2) return 'tie';
  if (trickRoom) {
    return speed1 < speed2 ? 'first' : 'second';
  }
  return speed1 > speed2 ? 'first' : 'second';
}

export interface SpeedTierEntry {
  name: string;
  baseSpeed: number;
  effectiveSpeed: number;
  modifiers: string[];
}

/**
 * Generate speed tiers for a set of Pokémon under various conditions.
 */
export function generateSpeedTiers(
  pokemon: { name: string; baseSpeed: number }[],
  scenarios: { label: string; modifiers: Partial<SpeedModifiers> }[],
): { scenario: string; tiers: SpeedTierEntry[] }[] {
  return scenarios.map((scenario) => {
    const tiers = pokemon
      .map((mon) => ({
        name: mon.name,
        baseSpeed: mon.baseSpeed,
        effectiveSpeed: calcEffectiveSpeed(mon.baseSpeed, scenario.modifiers),
        modifiers: [scenario.label],
      }))
      .sort((a, b) => b.effectiveSpeed - a.effectiveSpeed);

    return { scenario: scenario.label, tiers };
  });
}

/** Common speed scenarios for VGC */
export const COMMON_SPEED_SCENARIOS = [
  { label: 'Base', modifiers: {} },
  { label: 'Tailwind', modifiers: { tailwind: true } },
  { label: 'Choice Scarf', modifiers: { choiceScarf: true } },
  { label: '+1 Speed', modifiers: { statStage: 1 } },
  { label: 'Trick Room', modifiers: { trickRoom: true } },
  { label: 'Paralyzed', modifiers: { paralysis: true } },
] as const;
