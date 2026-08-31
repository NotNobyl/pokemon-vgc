/**
 * Live Match mode types.
 *
 * A LiveMatch is an in-progress ranked/tournament game the player is tracking
 * turn-by-turn. It stitches together the existing engines: opponent scouting +
 * likely sets (matchup-lab), bring-4 recommendation, and turn-by-turn heuristic
 * move suggestions (move-advisor). On finish it's converted into a BattleLog
 * with rule-based improvement notes.
 *
 * All suggestions are HEURISTIC and all opponent-set info is either observed
 * (revealed in-game by the user) or predicted from usage data with confidence —
 * never presented as certain.
 */

/** A single revealed fact about an opponent Pokémon, logged as the game shows it. */
export interface RevealedInfo {
  moves: string[];
  item?: string;
  ability?: string;
  teraType?: string;
}

/** An opponent roster entry (species-only is fine; details fill in as revealed). */
export interface OpponentEntry {
  /** Local dex name / display name entered at team preview. */
  name: string;
  /** Showdown id resolved from the dex, used to look up usage. */
  showdownId?: string;
  revealed: RevealedInfo;
  /** Whether the player believes this mon was brought (selected in their 4). */
  brought?: boolean;
}

/** A logged turn during the live match. */
export interface LiveTurn {
  turn: number;
  /** Free-text note the player jots for this turn. */
  note?: string;
  /** My active Pokémon (team member ids) this turn, up to 2. */
  myActive: string[];
  /** Their active Pokémon (opponent names) this turn, up to 2. */
  theirActive: string[];
  /** The move suggestion the tool gave (heuristic), for later reflection. */
  suggestedLine?: string;
  /** What the player actually did, for reflection. */
  actualLine?: string;
}

export type LiveMatchPhase = 'setup' | 'bring4' | 'live' | 'finished';

export interface LiveMatch {
  id: string;
  /** My team id being played. */
  teamId: string;
  regulationId: string;
  format: 'Doubles' | 'Singles';
  phase: LiveMatchPhase;
  /** Opponent's revealed 6 (team preview). */
  opponents: OpponentEntry[];
  /** My recommended bring-4 (team member ids), from the matchup engine. */
  recommendedBring4: string[];
  /** My actual bring-4 (team member ids) — may differ from recommended. */
  myBring4: string[];
  /** Recommended lead pair (opponent-facing display or my member ids). */
  recommendedLeads: string[];
  turns: LiveTurn[];
  result?: 'win' | 'loss';
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export const LIVE_MATCH_SCHEMA_VERSION = 1;
