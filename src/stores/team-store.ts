import { create } from 'zustand';
import { db } from '@/db/database';
import type { Team, TeamMember } from '@/types/team';

interface TeamState {
  teams: Team[];
  activeTeamId: string | null;
  loading: boolean;

  loadTeams: () => Promise<void>;
  createTeam: (name: string, regulationId: string) => Promise<Team>;
  deleteTeam: (id: string) => Promise<void>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  addMember: (teamId: string, member: TeamMember) => Promise<void>;
  removeMember: (teamId: string, memberId: string) => Promise<void>;
  updateMember: (teamId: string, memberId: string, updates: Partial<TeamMember>) => Promise<void>;
  setActiveTeam: (id: string | null) => void;
}

export const useTeamStore = create<TeamState>()((set, get) => ({
  teams: [],
  activeTeamId: null,
  loading: false,

  loadTeams: async () => {
    set({ loading: true });
    const teams = await db.teams.orderBy('updatedAt').reverse().toArray();
    set({ teams, loading: false });
  },

  createTeam: async (name, regulationId) => {
    const team: Team = {
      id: crypto.randomUUID(),
      name,
      regulationId,
      archetype: [],
      members: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.teams.put(team);
    set((state) => ({ teams: [team, ...state.teams] }));
    return team;
  },

  deleteTeam: async (id) => {
    await db.teams.delete(id);
    set((state) => ({
      teams: state.teams.filter((t) => t.id !== id),
      activeTeamId: state.activeTeamId === id ? null : state.activeTeamId,
    }));
  },

  updateTeam: async (id, updates) => {
    const team = get().teams.find((t) => t.id === id);
    if (!team) return;
    const updated = { ...team, ...updates, updatedAt: Date.now() };
    await db.teams.put(updated);
    set((state) => ({
      teams: state.teams.map((t) => (t.id === id ? updated : t)),
    }));
  },

  addMember: async (teamId, member) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team || team.members.length >= 6) return;
    const updated = {
      ...team,
      members: [...team.members, member],
      updatedAt: Date.now(),
    };
    await db.teams.put(updated);
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? updated : t)),
    }));
  },

  removeMember: async (teamId, memberId) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team) return;
    const updated = {
      ...team,
      members: team.members.filter((m) => m.id !== memberId),
      updatedAt: Date.now(),
    };
    await db.teams.put(updated);
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? updated : t)),
    }));
  },

  updateMember: async (teamId, memberId, updates) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team) return;
    const updated = {
      ...team,
      members: team.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m)),
      updatedAt: Date.now(),
    };
    await db.teams.put(updated);
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? updated : t)),
    }));
  },

  setActiveTeam: (id) => set({ activeTeamId: id }),
}));
