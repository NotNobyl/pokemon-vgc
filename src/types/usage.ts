/**
 * Usage / meta data types.
 *
 * Source-agnostic by design so a future Showdown adapter can populate the same
 * structures. For now the only populated source is the Champions Battle Data API
 * (https://championsbattledata.com), which serves REAL in-game Pokémon Champions
 * battle data.
 *
 * Every stored record carries provenance so recommendations can be
 * confidence-scored and never presented as certain just because one source
 * lists them.
 */

/** Which battle format the usage data describes. Champions-only for now. */
export type UsageFormat = 'Doubles' | 'Singles';

/** Which upstream source produced a datapoint. */
export type UsageSourceId =
  | 'champions-battle-data' // championsbattledata.com — real in-game data
  | 'showdown' // reserved for a future Smogon/Showdown adapter
  | 'manual-import'; // user-pasted / CSV fallback

/**
 * The kind of usage datapoint. Mirrors the categories the Champions Battle Data
 * API returns for each Pokémon.
 */
export type UsageCategory =
  | 'move'
  | 'held_item'
  | 'teammate'
  | 'ability'
  | 'stat_alignment' // nature-equivalent in Champions
  | 'stat_points'; // Champions stat-point spread (0..32 per stat)

/** Champions stat-point spread (0..32 per stat). Distinct from S/V EVs. */
export interface StatPoints {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

/**
 * A single usage row: e.g. "Earthquake, move, 90.3%".
 * Percentage is normalized to a 0..100 number; the original label is kept for
 * display fidelity. For teammates the source often omits a percentage.
 */
export interface UsageRow {
  category: UsageCategory;
  rank: number;
  /** Display name (move/item/ability/teammate/nature). Empty for stat_points. */
  name: string;
  /** Normalized 0..100, or null when the source provides none (e.g. teammates). */
  percentage: number | null;
  /** Original percentage label as returned by the source, for display. */
  percentageLabel?: string;
  /** For stat_alignment rows: the stat the nature raises/lowers. */
  statUp?: string;
  statDown?: string;
  /** For stat_points rows: the parsed Champions spread. */
  statPoints?: StatPoints;
}

/**
 * Provenance metadata attached to every cached usage record. Satisfies the
 * data-ingestion directive: record source, format, regulation/season,
 * retrieval time, sample size, rating bracket, and transform version.
 */
export interface UsageProvenance {
  source: UsageSourceId;
  /** Human attribution string to display in the UI. */
  attribution: string;
  /** The exact URL the data was retrieved from (or 'manual-import'). */
  sourceUrl: string;
  format: UsageFormat;
  /** Champions season identifier, e.g. "M5", or "Current". */
  season: string;
  /** ISO timestamp when this record was retrieved/cached. */
  retrievedAt: string;
  /**
   * The date the underlying data represents, if known (daily snapshots).
   * Champions dates arrive as DD_MM_YYYY; stored ISO here.
   */
  dataDate?: string;
  /** Sample size if the source reports one. Champions currently does not. */
  sampleSize?: number;
  /** Rating bracket if known (e.g. "1500+"). Champions currently does not. */
  ratingBracket?: string;
  /** Version of our transform logic, so cached rows can be re-normalized. */
  transformVersion: number;
}

/**
 * A cached, normalized usage record for one Pokémon in one format+season, with
 * provenance. This is what lives in IndexedDB.
 */
export interface PokemonUsage {
  /** Composite primary key: `${showdownId}|${format}|${season}`. */
  key: string;
  /** Showdown internal id, e.g. "garchomp", "taurospaldeaaqua". */
  showdownId: string;
  /** Display name, e.g. "Garchomp". */
  displayName: string;
  format: UsageFormat;
  season: string;
  rows: UsageRow[];
  provenance: UsageProvenance;
}

/**
 * Inputs to the source-confidence model. A recommendation's confidence is a
 * function of these, never a flat "the site says so".
 */
export interface ConfidenceInputs {
  /** 0..1 authority weight of the source (official/in-game highest). */
  sourceAuthority: number;
  /** Age of the data in days (fresher => higher confidence). */
  ageDays: number;
  /** Does the data's format match the context being evaluated? */
  formatMatch: boolean;
  /** Does the data's season/regulation match? */
  seasonMatch: boolean;
  /** Sample size if known (undefined => unknown, mild penalty). */
  sampleSize?: number;
  /** How complete the record is (0..1), e.g. has moves+items+abilities. */
  completeness: number;
  /** Number of independent sources that agree (>=1). */
  agreeingSources: number;
}

/** A coarse confidence label plus the 0..1 score behind it. */
export interface ConfidenceResult {
  score: number; // 0..1
  label: 'low' | 'moderate' | 'high';
  /** Short human explanation of the main drivers. */
  reason: string;
}
