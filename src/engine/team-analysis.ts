/**
 * Unified team / core strength analyzer (pure, deterministic).
 *
 * Goes beyond type charts to judge whether a core or team actually works:
 *  - Moveset-aware ROLE synergy (speed control, Fake Out, redirection, priority,
 *    weather, Intimidate, Trick Room) via checkRoleCoverage on real moves.
 *  - SPEED profile: classifies members as fast / slow / mid from base speed and
 *    common invested spreads, and flags whether the group is a coherent fast
 *    core, a Trick Room core, or an incoherent mix.
 *  - REDUNDANCY / ANTI-SYNERGY: same speed niche, conflicting weather, heavily
 *    overlapping roles.
 *
 * SPEED CAVEAT: exact Champions speeds depend on Stat Points/nature we don't
 * fully model yet. This uses base stats + a max-invested proxy to classify
 * TIERS only, and the label makes clear it is approximate.
 */

import type { BaseStats, Nature } from '@/types/pokemon';
import { calcBaseSpeed } from './speed-calc';
import { championsSpeed, type StatPointSpread } from './champions-stat';
import { checkRoleCoverage, type RoleCoverage } from './synergy-analyzer';
import { DEFAULT_EVS, DEFAULT_IVS } from '@/types/team';

export interface AnalyzableMember {
  name: string;
  baseStats: BaseStats;
  moves: string[];
  ability: string;
  /** Optional real Champions spread — enables EXACT speed instead of a proxy. */
  statPoints?: StatPointSpread;
  statAlignment?: Nature;
}

export type SpeedClass = 'fast' | 'mid' | 'slow';

export interface SpeedProfile {
  /** Per-member approximate max-invested speed + class. */
  members: { name: string; approxSpeed: number; speedClass: SpeedClass }[];
  fastCount: number;
  slowCount: number;
  /** Does the group read as fast-offense, trick-room, or mixed? */
  archetype: 'fast-offense' | 'trick-room' | 'mixed';
  /** True if members bunch in one speed niche (redundant). */
  speedRedundancy: boolean;
  /** Whether a speed-control plan is present given the archetype. */
  hasSpeedControlPlan: boolean;
  /** True when at least one member's speed came from a real Champions spread. */
  exact: boolean;
  /** True when speeds are proxy estimates (no real spread available). */
  approximate: boolean;
}

export interface CoreAnalysis {
  roles: RoleCoverage;
  /** Count of distinct key roles the group fills. */
  rolesFilled: number;
  speed: SpeedProfile;
  /** Anti-synergy / redundancy issues detected. */
  issues: string[];
  /** Positive synergy notes detected. */
  synergies: string[];
  /** 0..1 overall "does this actually work together" score. */
  coherence: number;
}

/** Max-invested speed proxy: 252 EV, positive nature, level 50. */
function approxMaxSpeed(baseStats: BaseStats): number {
  const evs = { ...DEFAULT_EVS, speed: 252 };
  return calcBaseSpeed(baseStats, evs, { ...DEFAULT_IVS }, 'jolly' as Nature, 50);
}

function classifySpeed(approx: number): SpeedClass {
  // VGC-ish tiers at level 50 max-invested: >=145 fast, <=90 slow-ish, else mid.
  if (approx >= 145) return 'fast';
  if (approx <= 95) return 'slow';
  return 'mid';
}

const WEATHER_ABILITIES: Record<string, string> = {
  drought: 'sun',
  drizzle: 'rain',
  'sand stream': 'sand',
  'snow warning': 'snow',
  'orichalcum pulse': 'sun',
};

/**
 * Analyze a core or team (2–6 members) for real synergy, speed coherence, and
 * anti-synergy. Works for pairs (Overlooked Cores) and full teams (score model).
 */
export function analyzeCore(members: AnalyzableMember[]): CoreAnalysis {
  const roles = checkRoleCoverage(
    members.map((m) => ({ name: m.name, moves: m.moves, ability: m.ability })),
  );
  const rolesFilled = [
    roles.hasSpeedControl,
    roles.hasFakeOut,
    roles.hasRedirection,
    roles.hasIntimidation,
    roles.hasPriorityMoves,
    roles.hasWeatherSetter,
  ].filter(Boolean).length;

  // Speed profile. Use EXACT Champions speed when a real spread is supplied;
  // otherwise fall back to a max-invested proxy (flagged approximate).
  let anyExact = false;
  let anyApprox = false;
  const memberSpeeds = members.map((m) => {
    let approxSpeed: number;
    if (m.statPoints && m.statAlignment) {
      approxSpeed = championsSpeed(m.baseStats.speed, m.statPoints.speed, m.statAlignment);
      anyExact = true;
    } else {
      approxSpeed = approxMaxSpeed(m.baseStats);
      anyApprox = true;
    }
    return { name: m.name, approxSpeed, speedClass: classifySpeed(approxSpeed) };
  });
  const fastCount = memberSpeeds.filter((m) => m.speedClass === 'fast').length;
  const slowCount = memberSpeeds.filter((m) => m.speedClass === 'slow').length;

  const hasTrickRoom = members.some((m) =>
    m.moves.some((mv) => mv.toLowerCase() === 'trick room'),
  );
  let archetype: SpeedProfile['archetype'] = 'mixed';
  if (hasTrickRoom || (slowCount >= members.length / 2 && fastCount === 0)) {
    archetype = 'trick-room';
  } else if (fastCount >= members.length / 2) {
    archetype = 'fast-offense';
  }

  // Speed redundancy: 3+ members within a tight max-speed band.
  const speeds = memberSpeeds.map((m) => m.approxSpeed).sort((a, b) => a - b);
  let speedRedundancy = false;
  for (let i = 0; i + 2 < speeds.length; i++) {
    if (speeds[i + 2] - speeds[i] <= 8) speedRedundancy = true;
  }

  const hasSpeedControlPlan =
    roles.hasSpeedControl || (archetype === 'trick-room' && hasTrickRoom);

  const speed: SpeedProfile = {
    members: memberSpeeds,
    fastCount,
    slowCount,
    archetype,
    speedRedundancy,
    hasSpeedControlPlan,
    exact: anyExact && !anyApprox,
    approximate: anyApprox,
  };

  // Issues + synergies.
  const issues: string[] = [];
  const synergies: string[] = [];

  // Conflicting weather setters.
  const weathers = new Set<string>();
  for (const m of members) {
    const w = WEATHER_ABILITIES[m.ability.toLowerCase()];
    if (w) weathers.add(w);
    const wMove = m.moves.map((x) => x.toLowerCase());
    if (wMove.includes('sunny day')) weathers.add('sun');
    if (wMove.includes('rain dance')) weathers.add('rain');
    if (wMove.includes('sandstorm')) weathers.add('sand');
    if (wMove.includes('snowscape')) weathers.add('snow');
  }
  if (weathers.size >= 2) {
    issues.push(`Conflicting weather (${[...weathers].join(' vs ')}) — they overwrite each other.`);
  }

  // Trick Room coherence: TR present but fast attackers waste it.
  if (hasTrickRoom && fastCount >= 2) {
    issues.push('Trick Room present but multiple fast attackers — they get slower under TR.');
  }

  // No speed control plan on a mixed/offense core.
  if (!hasSpeedControlPlan && archetype !== 'trick-room') {
    issues.push('No speed-control plan (Tailwind/Trick Room/Icy Wind) — you may be outsped.');
  }

  if (speedRedundancy) {
    issues.push('Several members sit in the same speed tier — limited speed-order flexibility.');
  }

  // Positive synergies.
  if (archetype === 'trick-room' && hasTrickRoom && slowCount >= 1) {
    synergies.push('Coherent Trick Room core: setter + slow attackers.');
  }
  if (roles.hasRedirection && fastCount >= 1) {
    synergies.push('Redirection support protects a fast/frail attacker.');
  }
  if (roles.hasFakeOut && roles.hasSpeedControl) {
    synergies.push('Fake Out + speed control enables safe setup turns.');
  }
  if (roles.hasIntimidation && slowCount >= 1) {
    synergies.push('Intimidate eases the core into range for slower pivots.');
  }

  // Coherence score: role coverage + speed plan − issues.
  let coherence =
    0.5 * (rolesFilled / 6) +
    0.3 * (hasSpeedControlPlan ? 1 : 0) +
    0.2 * (synergies.length > 0 ? 1 : 0);
  coherence = Math.max(0, coherence - issues.length * 0.12);
  coherence = Math.min(1, Math.max(0, coherence));

  return { roles, rolesFilled, speed, issues, synergies, coherence };
}
