/**
 * Champions Stat Point calculator (pure, deterministic).
 *
 * VERIFIED model (corroborated by Bulbapedia, Game8, GameRant, ScreenRant,
 * Chouten, PokemonDB — see docs):
 *  - Level 50. IVs are effectively maxed (the SP system replaces EVs/IVs).
 *  - 66 total Stat Points per Pokémon, max 32 per stat.
 *  - "1 SP = 1 final stat point at level 50" — transparent, flat addition
 *    (unlike S/V where 4 EVs = 1 point). What you invest is what you get.
 *  - Stat Alignment == Nature (±10% to one raised / one lowered stat; HP never
 *    affected).
 *
 * Therefore the final stat is:
 *   nonHP: floor( (baseLevel50WithMaxIV + statPoints) * natureMultiplier )
 *   HP:    baseLevel50WithMaxIV + statPoints        (nature never affects HP)
 * where baseLevel50WithMaxIV is the standard L50 value with IV=31, EV=0.
 */

import type { BaseStats, Nature } from '@/types/pokemon';
import { NATURE_MAP } from '@/types/pokemon';

export const CHAMPIONS_TOTAL_SP = 66;
export const CHAMPIONS_MAX_SP_PER_STAT = 32;
export const CHAMPIONS_LEVEL = 50;
const IV = 31; // effectively maxed in Champions

export interface StatPointSpread {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

/** Base level-50 stat value with maxed IV and no EVs, BEFORE SP + nature. */
function baseL50(base: number, isHp: boolean): number {
  const core = Math.floor(((2 * base + IV) * CHAMPIONS_LEVEL) / 100);
  return isHp ? core + CHAMPIONS_LEVEL + 10 : core + 5;
}

/**
 * Final Champions stat. `statPoints` is the flat 0..32 allocation for this stat.
 * `natureUp`/`natureDown` indicate whether this stat is raised/lowered by the
 * Stat Alignment.
 */
export function championsStat(
  base: number,
  statPoints: number,
  isHp: boolean,
  natureUp: boolean,
  natureDown: boolean,
): number {
  const sp = Math.max(0, Math.min(CHAMPIONS_MAX_SP_PER_STAT, statPoints));
  const raw = baseL50(base, isHp) + sp; // 1 SP = 1 flat point
  if (isHp) return raw; // nature never affects HP
  const mult = natureUp ? 1.1 : natureDown ? 0.9 : 1;
  return Math.floor(raw * mult);
}

/** Resolve which stats a Stat Alignment (nature) raises/lowers. */
export function natureEffect(nature: Nature): {
  plus?: keyof BaseStats;
  minus?: keyof BaseStats;
} {
  return NATURE_MAP[nature] ?? {};
}

/** Compute the final Champions Speed stat given base, SP, and alignment. */
export function championsSpeed(
  baseSpeed: number,
  speedPoints: number,
  nature: Nature,
): number {
  const eff = natureEffect(nature);
  return championsStat(
    baseSpeed,
    speedPoints,
    false,
    eff.plus === 'speed',
    eff.minus === 'speed',
  );
}

/** Validate a spread against Champions caps. */
export function validateStatPoints(spread: StatPointSpread): {
  valid: boolean;
  total: number;
  errors: string[];
} {
  const errors: string[] = [];
  const values = Object.entries(spread) as [keyof StatPointSpread, number][];
  const total = values.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of values) {
    if (v < 0) errors.push(`${k} cannot be negative`);
    if (v > CHAMPIONS_MAX_SP_PER_STAT) {
      errors.push(`${k} exceeds the ${CHAMPIONS_MAX_SP_PER_STAT} per-stat cap`);
    }
  }
  if (total > CHAMPIONS_TOTAL_SP) {
    errors.push(`Total ${total} exceeds the ${CHAMPIONS_TOTAL_SP} Stat Point limit`);
  }
  return { valid: errors.length === 0, total, errors };
}
