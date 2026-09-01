/**
 * Speed-creep benchmarks (pure).
 *
 * Given a Pokémon's EXACT Champions speed and a set of common meta threats with
 * their exact speeds (computed from their most common Stat Point spread +
 * alignment via champions-stat), report who it outspeeds / underspeeds / ties,
 * and the Scarf / Tailwind / Trick Room implications. These are exact because
 * the Champions SP model is verified — no longer an approximation.
 */

export interface SpeedBenchmarkTarget {
  name: string;
  speed: number;
}

export interface SpeedBenchmarkResult {
  mySpeed: number;
  outspeeds: string[];
  underspeeds: string[];
  ties: string[];
  /** Fraction (0..1) of the benchmark field this Pokémon outspeeds at base. */
  outspeedFraction: number;
  /** Threats it fails to outspeed at base but WOULD with a Choice Scarf (1.5x). */
  scarfFlips: string[];
  /** Threats it fails to outspeed at base but WOULD under Tailwind (2x). */
  tailwindFlips: string[];
  notes: string[];
}

const SCARF = 1.5;
const TAILWIND = 2;

/**
 * Compute speed benchmarks for one Pokémon against a field of threats.
 * `underTailwind`/`scarf` project the mon's own speed with those effects.
 */
export function speedBenchmarks(
  mySpeed: number,
  field: SpeedBenchmarkTarget[],
): SpeedBenchmarkResult {
  const outspeeds: string[] = [];
  const underspeeds: string[] = [];
  const ties: string[] = [];
  const scarfFlips: string[] = [];
  const tailwindFlips: string[] = [];

  const myScarf = Math.floor(mySpeed * SCARF);
  const myTailwind = Math.floor(mySpeed * TAILWIND);

  for (const t of field) {
    if (mySpeed > t.speed) outspeeds.push(t.name);
    else if (mySpeed < t.speed) {
      underspeeds.push(t.name);
      if (myScarf > t.speed) scarfFlips.push(t.name);
      if (myTailwind > t.speed) tailwindFlips.push(t.name);
    } else ties.push(t.name);
  }

  const outspeedFraction = field.length > 0 ? outspeeds.length / field.length : 0;

  const notes: string[] = [];
  if (field.length > 0) {
    notes.push(
      `Outspeeds ${outspeeds.length}/${field.length} of the benchmark field at base speed.`,
    );
    if (scarfFlips.length > 0) {
      notes.push(`Choice Scarf would flip: ${scarfFlips.slice(0, 5).join(', ')}.`);
    }
    if (tailwindFlips.length > 0) {
      notes.push(`Under Tailwind you'd additionally outspeed: ${tailwindFlips.slice(0, 5).join(', ')}.`);
    }
    if (outspeedFraction <= 0.25) {
      notes.push('Slow — strong Trick Room candidate, or bring speed control.');
    }
  }

  return {
    mySpeed,
    outspeeds,
    underspeeds,
    ties,
    outspeedFraction,
    scarfFlips,
    tailwindFlips,
    notes,
  };
}
