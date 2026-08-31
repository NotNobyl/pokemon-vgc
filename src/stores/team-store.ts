import { create } from 'zustand';
import { db } from '@/db/database';
import type { Team, TeamMember } from '@/types/team';
import { TEAM_SCHEMA_VERSION } from '@/types/team';
import { migrateTeams } from './team-migration';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Cross-tab sync channel. Guarded for environments without BroadcastChannel. */
const teamChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('vgc-teams')
    : null;

interface CorruptRecord {
  raw: unknown;
  reason: string;
}

interface TeamState {
  teams: Team[];
  activeTeamId: string | null;
  loading: boolean;
  saveStatus: SaveStatus;
  /** Records that failed migration; surfaced for recovery, never dropped. */
  corruptRecords: CorruptRecord[];

  loadTeams: () => Promise<void>;
  createTeam: (name: string, regulationId: string) => Promise<Team>;
  deleteTeam: (id: string) => Promise<void>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  addMember: (teamId: string, member: TeamMember) => Promise<void>;
  removeMember: (teamId: string, memberId: string) => Promise<void>;
  updateMember: (teamId: string, memberId: string, updates: Partial<TeamMember>) => Promise<void>;
  setActiveTeam: (id: string | null) => void;
  duplicateTeam: (id: string) => Promise<Team | null>;
}

/** Notify other tabs that teams changed so they can reload. */
function broadcastChange(): void {
  try {
    teamChannel?.postMessage({ type: 'teams-changed', at: Date.now() });
    // Storage-event fallback for browsers without BroadcastChannel.
    if (!teamChannel && typeof localStorage !== 'undefined') {
      localStorage.setItem('vgc-teams-ping', String(Date.now()));
    }
  } catch {
    // Non-fatal: cross-tab sync is best-effort.
  }
}

/**
 * Persist a team to IndexedDB with save-status tracking. Stamps schema version
 * and bumps the edit version for last-write conflict detection.
 */
async function persistTeam(
  set: (partial: Partial<TeamState>) => void,
  team: Team,
): Promise<Team> {
  set({ saveStatus: 'saving' });
  const stamped: Team = {
    ...team,
    schemaVersion: TEAM_SCHEMA_VERSION,
    version: (team.version ?? 0) + 1,
    updatedAt: Date.now(),
  };
  try {
    await db.teams.put(stamped);
    set({ saveStatus: 'saved' });
    broadcastChange();
    return stamped;
  } catch (err) {
    console.error('[team-store] save failed:', err);
    set({ saveStatus: 'error' });
    throw err;
  }
}

export const useTeamStore = create<TeamState>()((set, get) => ({
  teams: [],
  activeTeamId: null,
  loading: false,
  saveStatus: 'idle',
  corruptRecords: [],

  loadTeams: async () => {
    set({ loading: true });
    try {
      // Always read via toArray() (not orderBy): orderBy on an index SKIPS
      // records missing that key, which would hide corrupt/legacy rows so they
      // could be neither shown nor isolated. toArray returns every row; we sort
      // in memory and migrate + isolate corrupt records ourselves.
      const raw: unknown[] = await db.teams.toArray();
      const { teams, corrupt } = migrateTeams(raw);
      teams.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      set({ teams, corruptRecords: corrupt, loading: false });
    } catch (err) {
      // Never overwrite in-memory teams with an empty list on failure.
      console.error('[team-store] loadTeams failed:', err);
      set({ loading: false });
    }
  },

  createTeam: async (name, regulationId) => {
    const now = Date.now();
    const team: Team = {
      id: crypto.randomUUID(),
      name,
      regulationId,
      archetype: [],
      members: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: TEAM_SCHEMA_VERSION,
      version: 1,
      source: 'manual',
    };
    const saved = await persistTeam((p) => set(p), team);
    set((state) => ({ teams: [saved, ...state.teams] }));
    return saved;
  },

  deleteTeam: async (id) => {
    await db.teams.delete(id);
    broadcastChange();
    set((state) => ({
      teams: state.teams.filter((t) => t.id !== id),
      activeTeamId: state.activeTeamId === id ? null : state.activeTeamId,
    }));
  },

  updateTeam: async (id, updates) => {
    const team = get().teams.find((t) => t.id === id);
    if (!team) return;
    const saved = await persistTeam((p) => set(p), { ...team, ...updates });
    set((state) => ({
      teams: state.teams.map((t) => (t.id === id ? saved : t)),
    }));
  },

  addMember: async (teamId, member) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team || team.members.length >= 6) return;
    const saved = await persistTeam((p) => set(p), {
      ...team,
      members: [...team.members, member],
    });
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? saved : t)),
    }));
  },

  removeMember: async (teamId, memberId) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team) return;
    const saved = await persistTeam((p) => set(p), {
      ...team,
      members: team.members.filter((m) => m.id !== memberId),
    });
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? saved : t)),
    }));
  },

  updateMember: async (teamId, memberId, updates) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team) return;
    const saved = await persistTeam((p) => set(p), {
      ...team,
      members: team.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m)),
    });
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? saved : t)),
    }));
  },

  duplicateTeam: async (id) => {
    const team = get().teams.find((t) => t.id === id);
    if (!team) return null;
    const now = Date.now();
    const copy: Team = {
      ...team,
      id: crypto.randomUUID(),
      name: `${team.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      version: 1,
      // Regenerate member ids so edits don't collide across the two teams.
      members: team.members.map((m) => ({ ...m, id: crypto.randomUUID() })),
    };
    const saved = await persistTeam((p) => set(p), copy);
    set((state) => ({ teams: [saved, ...state.teams] }));
    return saved;
  },

  setActiveTeam: (id) => set({ activeTeamId: id }),
}));

// Reload teams when another tab reports a change.
if (teamChannel) {
  teamChannel.onmessage = (e) => {
    if (e.data?.type === 'teams-changed') {
      void useTeamStore.getState().loadTeams();
    }
  };
} else if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'vgc-teams-ping') {
      void useTeamStore.getState().loadTeams();
    }
  });
}
