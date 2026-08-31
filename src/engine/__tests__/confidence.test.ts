import { describe, expect, it } from 'vitest';
import { computeConfidence } from '@/engine/confidence';

describe('computeConfidence', () => {
  it('rates fresh, matched, authoritative, complete data as high', () => {
    const r = computeConfidence({
      sourceAuthority: 1.0,
      ageDays: 1,
      formatMatch: true,
      seasonMatch: true,
      sampleSize: 10000,
      completeness: 1,
      agreeingSources: 1,
    });
    expect(r.label).toBe('high');
    expect(r.score).toBeGreaterThan(0.7);
  });

  it('penalizes season/format mismatch', () => {
    const matched = computeConfidence({
      sourceAuthority: 1,
      ageDays: 1,
      formatMatch: true,
      seasonMatch: true,
      completeness: 1,
      agreeingSources: 1,
    });
    const mismatched = computeConfidence({
      sourceAuthority: 1,
      ageDays: 1,
      formatMatch: false,
      seasonMatch: false,
      completeness: 1,
      agreeingSources: 1,
    });
    expect(mismatched.score).toBeLessThan(matched.score);
  });

  it('decays with age', () => {
    const fresh = computeConfidence({
      sourceAuthority: 1,
      ageDays: 1,
      formatMatch: true,
      seasonMatch: true,
      completeness: 1,
      agreeingSources: 1,
    });
    const old = computeConfidence({
      sourceAuthority: 1,
      ageDays: 40,
      formatMatch: true,
      seasonMatch: true,
      completeness: 1,
      agreeingSources: 1,
    });
    expect(old.score).toBeLessThan(fresh.score);
  });

  it('clamps to the 0..1 range', () => {
    const r = computeConfidence({
      sourceAuthority: 1,
      ageDays: 0,
      formatMatch: true,
      seasonMatch: true,
      sampleSize: 1_000_000,
      completeness: 1,
      agreeingSources: 10,
    });
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
