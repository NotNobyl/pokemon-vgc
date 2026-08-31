import { describe, expect, it } from 'vitest';
import { migrateTeam, migrateTeams, needsMigration } from '@/stores/team-migration';
import { TEAM_SCHEMA_VERSION } from '@/types/team';

describe('team-migration', () => {
  it('migrates an old record with no schemaVersion or updatedAt', () => {
    const old = {
      id: 'abc',
      name: 'Old Team',
      regulationId: 'reg-m-a',
      archetype: ['tailwind'],
      members: [],
      createdAt: 1000,
      // no updatedAt, no schemaVersion (the original bug shape)
    };
    const result = migrateTeam(old);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.schemaVersion).toBe(TEAM_SCHEMA_VERSION);
    // updatedAt backfilled from createdAt.
    expect(result.updatedAt).toBe(1000);
    expect(result.version).toBe(1);
  });

  it('drops unusable members but keeps the team', () => {
    const result = migrateTeam({
      id: 'x',
      name: 'Partial',
      members: [
        { pokemonId: 5, id: 'm1' },
        { nickname: 'no-species' }, // missing pokemonId -> dropped
      ],
    });
    if ('error' in result) throw new Error('should have migrated');
    expect(result.members).toHaveLength(1);
    expect(result.members[0].pokemonId).toBe(5);
  });

  it('isolates corrupt records without dropping valid ones', () => {
    const { teams, corrupt } = migrateTeams([
      { id: 'good', name: 'Good', members: [] },
      null, // corrupt
      { name: 'no-id', members: [] }, // corrupt (missing id)
      'not-an-object', // corrupt
    ]);
    expect(teams).toHaveLength(1);
    expect(teams[0].id).toBe('good');
    expect(corrupt).toHaveLength(3);
    // Raw corrupt records are preserved for recovery.
    expect(corrupt[0].raw).toBeNull();
    expect(corrupt.every((c) => typeof c.reason === 'string')).toBe(true);
  });

  it('needsMigration detects older/absent schema versions', () => {
    expect(needsMigration({ schemaVersion: undefined })).toBe(true);
    expect(needsMigration({ schemaVersion: 0 })).toBe(true);
    expect(needsMigration({ schemaVersion: TEAM_SCHEMA_VERSION })).toBe(false);
  });
});
