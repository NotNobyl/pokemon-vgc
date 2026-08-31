import type {
  ConfidenceInputs,
  ConfidenceResult,
  UsageProvenance,
  UsageSourceId,
} from '@/types/usage';

/**
 * Source authority weights (0..1). In-game Champions battle data is the most
 * authoritative because it reflects real ranked play from the official client.
 * A future Showdown adapter reflects a different (simulator) population, so it
 * is weighted lower for Champions contexts. Manual imports are user-asserted.
 */
export const SOURCE_AUTHORITY: Record<UsageSourceId, number> = {
  'champions-battle-data': 1.0,
  showdown: 0.7,
  'manual-import': 0.5,
};

/**
 * Compute a 0..1 confidence score from weighted, independent factors. This is
 * deliberately transparent and explainable rather than a black box — the UI
 * surfaces the reason so the player can judge for themselves.
 */
export function computeConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const {
    sourceAuthority,
    ageDays,
    formatMatch,
    seasonMatch,
    sampleSize,
    completeness,
    agreeingSources,
  } = inputs;

  // Recency: full credit within 3 days, decaying to ~0.3 by 30 days.
  const recency = clamp01(1 - Math.max(0, ageDays - 3) / 27);

  // Format / season alignment are hard-ish gates.
  const formatFactor = formatMatch ? 1 : 0.4;
  const seasonFactor = seasonMatch ? 1 : 0.5;

  // Sample size: unknown => mild penalty (0.7); otherwise saturating curve.
  const sampleFactor =
    sampleSize === undefined
      ? 0.7
      : clamp01(Math.log10(Math.max(1, sampleSize)) / 4); // 10k samples ~= 1.0

  // Agreement across independent sources gives a modest boost.
  const agreementFactor = clamp01(0.8 + 0.1 * Math.max(0, agreeingSources - 1));

  const score = clamp01(
    sourceAuthority *
      recency *
      formatFactor *
      seasonFactor *
      (0.6 + 0.4 * completeness) *
      (0.7 + 0.3 * sampleFactor) *
      agreementFactor,
  );

  const label: ConfidenceResult['label'] =
    score >= 0.7 ? 'high' : score >= 0.45 ? 'moderate' : 'low';

  const reasons: string[] = [];
  if (!seasonMatch) reasons.push('data is from a different regulation/season');
  if (!formatMatch) reasons.push('data is from a different format');
  if (ageDays > 14) reasons.push(`data is ${Math.round(ageDays)} days old`);
  if (sampleSize === undefined) reasons.push('sample size not reported');
  if (completeness < 0.6) reasons.push('record is incomplete');
  if (reasons.length === 0) {
    reasons.push('fresh, format- and season-matched authoritative data');
  }

  return { score, label, reason: reasons.join('; ') };
}

/** Build confidence inputs from a provenance record + current context. */
export function confidenceFromProvenance(
  provenance: UsageProvenance,
  context: {
    currentFormat: string;
    currentSeason: string;
    completeness: number;
    agreeingSources?: number;
    now?: Date;
  },
): ConfidenceResult {
  const now = context.now ?? new Date();
  const retrieved = new Date(provenance.retrievedAt);
  const ageDays = Math.max(
    0,
    (now.getTime() - retrieved.getTime()) / (1000 * 60 * 60 * 24),
  );

  return computeConfidence({
    sourceAuthority: SOURCE_AUTHORITY[provenance.source],
    ageDays,
    formatMatch: provenance.format === context.currentFormat,
    seasonMatch:
      provenance.season === context.currentSeason ||
      provenance.season === 'Current',
    sampleSize: provenance.sampleSize,
    completeness: context.completeness,
    agreeingSources: context.agreeingSources ?? 1,
  });
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
