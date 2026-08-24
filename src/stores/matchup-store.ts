import { create } from 'zustand';
import { db } from '@/db/database';
import type { OpponentTeam } from '@/types/matchup';

interface MatchupState {
  scoutingLog: OpponentTeam[];
  loading: boolean;

  loadScoutingLog: () => Promise<void>;
  addOpponentTeam: (team: OpponentTeam) => Promise<void>;
  deleteOpponentTeam: (id: string) => Promise<void>;
  updateOpponentTeam: (id: string, updates: Partial<OpponentTeam>) => Promise<void>;
}

export const useMatchupStore = create<MatchupState>()((set, get) => ({
  scoutingLog: [],
  loading: false,

  loadScoutingLog: async () => {
    set({ loading: true });
    const log = await db.scoutingLog.orderBy('date').reverse().toArray();
    set({ scoutingLog: log, loading: false });
  },

  addOpponentTeam: async (team) => {
    await db.scoutingLog.put(team);
    set((state) => ({ scoutingLog: [team, ...state.scoutingLog] }));
  },

  deleteOpponentTeam: async (id) => {
    await db.scoutingLog.delete(id);
    set((state) => ({
      scoutingLog: state.scoutingLog.filter((t) => t.id !== id),
    }));
  },

  updateOpponentTeam: async (id, updates) => {
    const team = get().scoutingLog.find((t) => t.id === id);
    if (!team) return;
    const updated = { ...team, ...updates };
    await db.scoutingLog.put(updated);
    set((state) => ({
      scoutingLog: state.scoutingLog.map((t) => (t.id === id ? updated : t)),
    }));
  },
}));
