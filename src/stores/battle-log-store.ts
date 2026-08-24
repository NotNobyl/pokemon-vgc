import { create } from 'zustand';
import { db } from '@/db/database';
import type { BattleLog } from '@/types/battle-log';

interface BattleLogState {
  logs: BattleLog[];
  loading: boolean;

  loadLogs: (teamId?: string) => Promise<void>;
  addLog: (log: BattleLog) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  getRecentLogs: (count: number) => BattleLog[];
  getPatterns: (lastN: number) => Map<string, number>;
}

export const useBattleLogStore = create<BattleLogState>()((set, get) => ({
  logs: [],
  loading: false,

  loadLogs: async (teamId) => {
    set({ loading: true });
    let logs: BattleLog[];
    if (teamId) {
      logs = await db.battleLogs.where('teamId').equals(teamId).reverse().sortBy('date');
    } else {
      logs = await db.battleLogs.orderBy('date').reverse().toArray();
    }
    set({ logs, loading: false });
  },

  addLog: async (log) => {
    await db.battleLogs.put(log);
    set((state) => ({ logs: [log, ...state.logs] }));
  },

  deleteLog: async (id) => {
    await db.battleLogs.delete(id);
    set((state) => ({ logs: state.logs.filter((l) => l.id !== id) }));
  },

  getRecentLogs: (count) => {
    return get().logs.slice(0, count);
  },

  getPatterns: (lastN) => {
    const recent = get().logs.slice(0, lastN);
    const losses = recent.filter((l) => l.result === 'loss');
    const tagCounts = new Map<string, number>();
    for (const log of losses) {
      for (const tag of log.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    return tagCounts;
  },
}));
