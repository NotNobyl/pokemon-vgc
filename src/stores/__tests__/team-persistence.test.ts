import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { useTeamStore } from '@/stores/team-store';
import { db } from '@/db/database';
import type { TeamMember } from '@/types/team';
import { DEFAULT_EVS, DEFAULT_IVS } from '@/types/team';

function mkMember(pokemonId: number): TeamMember {
  return {
    id: crypto.randomUUID(),
    pokemonId,
    ability: 'intimidate',
    item: 'sitrus-berry',
    nature: 'adamant',
    moves: ['tackle'],
    evs: { ...DEFAULT_EVS },
    ivs: { ...DEFAULT_IVS },
    level: 50,
    available: true,
  };
}

/**
 * Reproduces the reported bug: build a team with 6 Pokémon, then navigate
 * away and back (which remounts TeamsPage and re-runs loadTeams()). The team
 * and all members must survive because every mutation is persisted to
 * IndexedDB.
 */
describe('team persistence across navigation', () => {
  beforeEach(async () => {
    await db.teams.clear();
    // Reset the in-memory store between tests.
    useTeamStore.setState({ teams: [], activeTeamId: null, loading: false });
  });

  it('keeps a team with 6 members after navigating away and back', async () => {
    const store = useTeamStore.getState();

    // 1. Create a team.
    const team = await store.createTeam('Test Team', 'reg-m-a');

    // 2. Add all six Pokémon.
    for (const id of [1, 2, 3, 4, 5, 6]) {
      await useTeamStore.getState().addMember(team.id, mkMember(id));
    }

    // Sanity: in-memory store has 6 members now.
    expect(
      useTeamStore.getState().teams.find((t) => t.id === team.id)?.members.length,
    ).toBe(6);

    // 3. Simulate navigating AWAY (TeamsPage unmounts). The Zustand store is
    //    app-level so it stays in memory, but we also simulate the worst case:
    //    a fresh read from persistence as if the store had been re-created.
    useTeamStore.setState({ teams: [], activeTeamId: null });

    // 4. Simulate navigating BACK: TeamsPage remounts and calls loadTeams().
    await useTeamStore.getState().loadTeams();

    // 5. Confirm the team AND all 6 members survive.
    const reloaded = useTeamStore.getState().teams.find((t) => t.id === team.id);
    expect(reloaded).toBeDefined();
    expect(reloaded?.name).toBe('Test Team');
    expect(reloaded?.members.length).toBe(6);
  });

  it('persists directly to IndexedDB on every member add', async () => {
    const store = useTeamStore.getState();
    const team = await store.createTeam('Direct DB Team', 'reg-m-a');
    await useTeamStore.getState().addMember(team.id, mkMember(10));

    // Read straight from IndexedDB, bypassing the in-memory store entirely.
    const fromDb = await db.teams.get(team.id);
    expect(fromDb?.members.length).toBe(1);
    expect(fromDb?.members[0].pokemonId).toBe(10);
  });
});
