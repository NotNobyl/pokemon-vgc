/**
 * Team record migration + validation.
 *
 * Goals (per persistence requirements):
 *  - Migrate older saved teams to the current schema WITHOUT data loss.
 *  - Never silently delete or reset a team because its schema changed.
 *  - Isolate corrupt/unmigratable records instead of dropping them, so valid
 *    teams remain available and the bad ones can be surfaced for recovery.
 */

import type { Team, TeamMember } from '@/types/team';
import { TEAM_SCHEMA_VERSION, DEFAULT_EVS, DEFAULT_IVS } from '@/types/team';

export interface MigrationResult {
  /** Valid, current-schema teams ready to use. */
  teams: Team[];
  /** Records that could not be migrated; preserved raw for recovery. */
  corrupt: { raw: unknown; reason: string }[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Best-effort normalize a single member; returns null if unusable. */
function migrateMember(raw: unknown): TeamMember | null {
  if (!isObject(raw)) return null;
  const pokemonId = raw.pokemonId;
  if (typeof pokemonId !== 'number') return null; // can't reference a species
  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    pokemonId,
    nickname: typeof raw.nickname === 'string' ? raw.nickname : undefined,
    ability: typeof raw.ability === 'string' ? raw.ability : '',
    item: typeof raw.item === 'string' ? raw.item : '',
    teraType: raw.teraType as TeamMember['teraType'],
    moves: Array.isArray(raw.moves) ? (raw.moves.filter((m) => typeof m === 'string') as string[]) : [],
    evs: isObject(raw.evs) ? ({ ...DEFAULT_EVS, ...raw.evs } as TeamMember['evs']) : { ...DEFAULT_EVS },
    ivs: isObject(raw.ivs) ? ({ ...DEFAULT_IVS, ...raw.ivs } as TeamMember['ivs']) : { ...DEFAULT_IVS },
    nature: (typeof raw.nature === 'string' ? raw.nature : 'hardy') as TeamMember['nature'],
    level: typeof raw.level === 'number' ? raw.level : 50,
    available: typeof raw.available === 'boolean' ? raw.available : true,
  };
}

/**
 * Migrate a single raw record to the current Team schema.
 * Returns the migrated team, or a reason string if it's unmigratable.
 */
export function migrateTeam(raw: unknown): Team | { error: string } {
  if (!isObject(raw)) return { error: 'record is not an object' };
  if (typeof raw.id !== 'string') return { error: 'missing string id' };
  if (typeof raw.name !== 'string') return { error: 'missing team name' };

  // Members: migrate each; a member that can't be migrated is dropped from the
  // team (not the whole team), but we keep the team itself.
  const rawMembers = Array.isArray(raw.members) ? raw.members : [];
  const members = rawMembers
    .map(migrateMember)
    .filter((m): m is TeamMember => m !== null);

  const now = Date.now();
  return {
    id: raw.id,
    name: raw.name,
    regulationId: typeof raw.regulationId === 'string' ? raw.regulationId : 'reg-m-a',
    archetype: Array.isArray(raw.archetype)
      ? (raw.archetype.filter((a) => typeof a === 'string') as string[])
      : [],
    members,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    // The original bug: records could lack updatedAt. Backfill from createdAt.
    updatedAt:
      typeof raw.updatedAt === 'number'
        ? raw.updatedAt
        : typeof raw.createdAt === 'number'
          ? raw.createdAt
          : now,
    schemaVersion: TEAM_SCHEMA_VERSION,
    version: typeof raw.version === 'number' ? raw.version : 1,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    source: typeof raw.source === 'string' ? raw.source : 'manual',
  };
}

/**
 * Migrate a list of raw records. Valid teams are returned; unmigratable records
 * are isolated (preserved raw) rather than dropped.
 */
export function migrateTeams(rawRecords: unknown[]): MigrationResult {
  const teams: Team[] = [];
  const corrupt: { raw: unknown; reason: string }[] = [];
  for (const raw of rawRecords) {
    const result = migrateTeam(raw);
    if ('error' in result) {
      corrupt.push({ raw, reason: result.error });
    } else {
      teams.push(result);
    }
  }
  return { teams, corrupt };
}

/** True if a record needs migration (older/absent schema version). */
export function needsMigration(team: Pick<Team, 'schemaVersion'>): boolean {
  return (team.schemaVersion ?? 0) < TEAM_SCHEMA_VERSION;
}
