import Dexie, { type Table } from 'dexie';
import type { BattleLog } from '@/types/battle-log';
import type { OpponentTeam } from '@/types/matchup';
import type { Move, Pokemon } from '@/types/pokemon';
import type { Regulation } from '@/types/regulation';
import type { Team } from '@/types/team';
import type { PokemonUsage } from '@/types/usage';
import type { LiveMatch } from '@/types/live-match';

export class VGCDatabase extends Dexie {
  pokemon!: Table<Pokemon, number>;
  moves!: Table<Move, string>;
  teams!: Table<Team, string>;
  battleLogs!: Table<BattleLog, string>;
  scoutingLog!: Table<OpponentTeam, string>;
  regulations!: Table<Regulation, string>;
  usageData!: Table<PokemonUsage, string>;
  liveMatches!: Table<LiveMatch, string>;

  constructor() {
    super('VGCCompanion');

    this.version(1).stores({
      pokemon: 'id, name, *types',
      moves: 'name, type, category',
      teams: 'id, name, regulationId, *archetype, createdAt',
      battleLogs: 'id, teamId, date, result',
      scoutingLog: 'id, name, date',
      regulations: 'id, name, game',
    });

    // v2: usage/meta data cache with provenance.
    // Keyed by composite `${showdownId}|${format}|${season}`.
    // Secondary indexes support lookups by pokemon, format, season, and freshness.
    this.version(2).stores({
      pokemon: 'id, name, *types',
      moves: 'name, type, category',
      teams: 'id, name, regulationId, *archetype, createdAt',
      battleLogs: 'id, teamId, date, result',
      scoutingLog: 'id, name, date',
      regulations: 'id, name, game',
      usageData:
        'key, showdownId, format, season, provenance.retrievedAt, provenance.source',
    });

    // v3: add `updatedAt` to the teams index.
    // BUGFIX: team-store.loadTeams() does `orderBy('updatedAt')`, but earlier
    // schemas did NOT index updatedAt. That threw a Dexie SchemaError on load,
    // which was swallowed, leaving the team list empty after navigation
    // (reported as "teams disappearing"). Indexing updatedAt fixes the query.
    this.version(3).stores({
      pokemon: 'id, name, *types',
      moves: 'name, type, category',
      teams: 'id, name, regulationId, *archetype, createdAt, updatedAt',
      battleLogs: 'id, teamId, date, result',
      scoutingLog: 'id, name, date',
      regulations: 'id, name, game',
      usageData:
        'key, showdownId, format, season, provenance.retrievedAt, provenance.source',
    });

    // v4: live match sessions (in-progress games tracked turn-by-turn).
    this.version(4).stores({
      pokemon: 'id, name, *types',
      moves: 'name, type, category',
      teams: 'id, name, regulationId, *archetype, createdAt, updatedAt',
      battleLogs: 'id, teamId, date, result',
      scoutingLog: 'id, name, date',
      regulations: 'id, name, game',
      usageData:
        'key, showdownId, format, season, provenance.retrievedAt, provenance.source',
      liveMatches: 'id, teamId, phase, updatedAt',
    });
  }
}

export const db = new VGCDatabase();
