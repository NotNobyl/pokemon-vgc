import { describe, expect, it } from 'vitest';
import {
  championsStat,
  championsSpeed,
  validateStatPoints,
  CHAMPIONS_TOTAL_SP,
  CHAMPIONS_MAX_SP_PER_STAT,
} from '@/engine/champions-stat';
import { speedBenchmarks } from '@/engine/speed-benchmarks';

describe('championsStat', () => {
  it('adds SP as flat points at L50 (1 SP = 1 point) with maxed IV', () => {
    // base 100, 0 SP, neutral: floor((200+31)*0.5)+5 = floor(115.5)+5 = 115+5 = 120
    expect(championsStat(100, 0, false, false, false)).toBe(120);
    // +32 SP flat -> 152
    expect(championsStat(100, 32, false, false, false)).toBe(152);
  });

  it('applies nature ±10% to non-HP stats only', () => {
    // base 100, 0 SP: neutral 120; +nature floor(120*1.1)=132; -nature floor(120*0.9)=108
    expect(championsStat(100, 0, false, true, false)).toBe(132);
    expect(championsStat(100, 0, false, false, true)).toBe(108);
  });

  it('never applies nature to HP', () => {
    // HP base 100: floor((200+31)*0.5)+50+10 = 115+60 = 175; +32 = 207; nature ignored
    expect(championsStat(100, 32, true, true, false)).toBe(207);
  });

  it('computes a known Flutter-Mane-like fast speed (base 135, timid, 32 SP)', () => {
    // floor((270+31)*0.5)+5 = 155; +32 = 187; *1.1 = floor(205.7) = 205
    expect(championsSpeed(135, 32, 'timid')).toBe(205);
  });

  it('caps SP per stat at 32', () => {
    expect(championsStat(100, 999, false, false, false)).toBe(championsStat(100, 32, false, false, false));
  });
});

describe('validateStatPoints', () => {
  it('accepts a legal spread', () => {
    const r = validateStatPoints({ hp: 32, attack: 0, defense: 2, spAttack: 32, spDefense: 0, speed: 0 });
    expect(r.valid).toBe(true);
    expect(r.total).toBe(66);
  });
  it('rejects over-total and over-cap', () => {
    const over = validateStatPoints({ hp: 32, attack: 32, defense: 32, spAttack: 0, spDefense: 0, speed: 0 });
    expect(over.valid).toBe(false);
    expect(over.total).toBeGreaterThan(CHAMPIONS_TOTAL_SP);
    const cap = validateStatPoints({ hp: 40, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 });
    expect(cap.errors.some((e) => e.includes(String(CHAMPIONS_MAX_SP_PER_STAT)))).toBe(true);
  });
});

describe('speedBenchmarks', () => {
  it('reports outspeeds / underspeeds / ties and scarf flips', () => {
    const r = speedBenchmarks(150, [
      { name: 'Slower', speed: 120 },
      { name: 'Faster', speed: 170 },
      { name: 'Tie', speed: 150 },
    ]);
    expect(r.outspeeds).toContain('Slower');
    expect(r.underspeeds).toContain('Faster');
    expect(r.ties).toContain('Tie');
    // 150*1.5=225 > 170 -> Scarf flips Faster.
    expect(r.scarfFlips).toContain('Faster');
    expect(r.outspeedFraction).toBeCloseTo(1 / 3);
  });

  it('flags very slow mons as Trick Room candidates', () => {
    const r = speedBenchmarks(40, [
      { name: 'A', speed: 150 },
      { name: 'B', speed: 130 },
      { name: 'C', speed: 120 },
      { name: 'D', speed: 100 },
    ]);
    expect(r.notes.some((n) => /Trick Room/i.test(n))).toBe(true);
  });
});
