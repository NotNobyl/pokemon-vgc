import { describe, expect, it } from 'vitest';
import { migrateTeam, migrateTeams, needsMigration } from '@/stores/team-migration';
import { TEAM_SCHEMA_VERSION, evsToStatPoints } from '@/types/team';

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

  it('backfills Champions Stat Points from EVs on old members', () => {
    const result = migrateTeam({
      id: 't',
      name: 'Old',
      members: [
        {
          pokemonId: 1,
          id: 'm1',
          nature: 'timid',
          evs: { hp: 4, attack: 0, defense: 0, specialAttack: 252, specialDefense: 0, speed: 252 },
        },
      ],
    });
    if ('error' in result) throw new Error('should migrate');
    const m = result.members[0];
    // 252 EV -> 63 -> capped 32; 4 EV -> 1.
    expect(m.statPoints?.specialAttack).toBe(32);
    expect(m.statPoints?.speed).toBe(32);
    expect(m.statPoints?.hp).toBe(1);
    // Total respects the 66 cap.
    const total = Object.values(m.statPoints!).reduce((s, v) => s + v, 0);
    expect(total).toBeLessThanOrEqual(66);
    // Alignment defaults to the member's nature.
    expect(m.statAlignment).toBe('timid');
  });
});

describe('evsToStatPoints', () => {
  it('maps 4 EVs to 1 point and caps at 32 per stat', () => {
    const sp = evsToStatPoints({ hp: 0, attack: 8, defense: 0, specialAttack: 252, specialDefense: 0, speed: 4 });
    expect(sp.attack).toBe(2);
    expect(sp.specialAttack).toBe(32);
    expect(sp.speed).toBe(1);
  });

  it('never exceeds the 66-point total', () => {
    const sp = evsToStatPoints({ hp: 252, attack: 252, defense: 252, specialAttack: 252, specialDefense: 252, speed: 252 });
    const total = Object.values(sp).reduce((s, v) => s + v, 0);
    expect(total).toBeLessThanOrEqual(66);
  });
});
