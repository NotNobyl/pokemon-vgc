import Dexie, { type Table } from 'dexie';
import type { BattleLog } from '@/types/battle-log';
import type { OpponentTeam } from '@/types/matchup';
import type { Move, Pokemon } from '@/types/pokemon';
import type { Regulation } from '@/types/regulation';
import type { Team } from '@/types/team';
import type { PokemonUsage } from '@/types/usage';

export class VGCDatabase extends Dexie {
  pokemon!: Table<Pokemon, number>;
  moves!: Table<Move, string>;
  teams!: Table<Team, string>;
  battleLogs!: Table<BattleLog, string>;
  scoutingLog!: Table<OpponentTeam, string>;
  regulations!: Table<Regulation, string>;
  usageData!: Table<PokemonUsage, string>;

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
  }
}

export const db = new VGCDatabase();
