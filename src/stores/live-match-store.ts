import { create } from 'zustand';
import { db } from '@/db/database';
import type {
  LiveMatch,
  LiveTurn,
  OpponentEntry,
  RevealedInfo,
} from '@/types/live-match';
import { LIVE_MATCH_SCHEMA_VERSION } from '@/types/live-match';

interface LiveMatchState {
  active: LiveMatch | null;
  loading: boolean;

  /** Load the most recent unfinished match (survives navigation/refresh). */
  loadActive: () => Promise<void>;
  startMatch: (teamId: string, regulationId: string) => Promise<LiveMatch>;
  setOpponents: (opponents: OpponentEntry[]) => Promise<void>;
  setRecommendation: (bring4: string[], leads: string[]) => Promise<void>;
  setMyBring4: (memberIds: string[]) => Promise<void>;
  setPhase: (phase: LiveMatch['phase']) => Promise<void>;
  revealOpponentInfo: (name: string, info: Partial<RevealedInfo>) => Promise<void>;
  toggleBrought: (name: string) => Promise<void>;
  addTurn: (turn: LiveTurn) => Promise<void>;
  updateTurn: (turnNumber: number, updates: Partial<LiveTurn>) => Promise<void>;
  finish: (result: 'win' | 'loss') => Promise<LiveMatch | null>;
  cancel: () => Promise<void>;
}

async function persist(match: LiveMatch): Promise<LiveMatch> {
  const updated = { ...match, updatedAt: Date.now() };
  await db.liveMatches.put(updated);
  return updated;
}

export const useLiveMatchStore = create<LiveMatchState>()((set, get) => ({
  active: null,
  loading: false,

  loadActive: async () => {
    set({ loading: true });
    try {
      const all = await db.liveMatches.toArray();
      // Most recent not-finished match is the active session.
      const active =
        all
          .filter((m) => m.phase !== 'finished')
          .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
      set({ active, loading: false });
    } catch (err) {
      console.error('[live-match] loadActive failed:', err);
      set({ loading: false });
    }
  },

  startMatch: async (teamId, regulationId) => {
    const now = Date.now();
    const match: LiveMatch = {
      id: crypto.randomUUID(),
      teamId,
      regulationId,
      format: 'Doubles',
      phase: 'setup',
      opponents: [],
      recommendedBring4: [],
      myBring4: [],
      recommendedLeads: [],
      turns: [],
      createdAt: now,
      updatedAt: now,
      schemaVersion: LIVE_MATCH_SCHEMA_VERSION,
    };
    const saved = await persist(match);
    set({ active: saved });
    return saved;
  },

  setOpponents: async (opponents) => {
    const m = get().active;
    if (!m) return;
    set({ active: await persist({ ...m, opponents, phase: 'bring4' }) });
  },

  setRecommendation: async (recommendedBring4, recommendedLeads) => {
    const m = get().active;
    if (!m) return;
    set({ active: await persist({ ...m, recommendedBring4, recommendedLeads }) });
  },

  setMyBring4: async (memberIds) => {
    const m = get().active;
    if (!m) return;
    set({ active: await persist({ ...m, myBring4: memberIds }) });
  },

  setPhase: async (phase) => {
    const m = get().active;
    if (!m) return;
    set({ active: await persist({ ...m, phase }) });
  },

  revealOpponentInfo: async (name, info) => {
    const m = get().active;
    if (!m) return;
    const opponents = m.opponents.map((o) =>
      o.name === name
        ? {
            ...o,
            revealed: {
              ...o.revealed,
              ...info,
              moves: info.moves
                ? Array.from(new Set([...o.revealed.moves, ...info.moves]))
                : o.revealed.moves,
            },
          }
        : o,
    );
    set({ active: await persist({ ...m, opponents }) });
  },

  toggleBrought: async (name) => {
    const m = get().active;
    if (!m) return;
    const opponents = m.opponents.map((o) =>
      o.name === name ? { ...o, brought: !o.brought } : o,
    );
    set({ active: await persist({ ...m, opponents }) });
  },

  addTurn: async (turn) => {
    const m = get().active;
    if (!m) return;
    set({ active: await persist({ ...m, turns: [...m.turns, turn] }) });
  },

  updateTurn: async (turnNumber, updates) => {
    const m = get().active;
    if (!m) return;
    const turns = m.turns.map((t) =>
      t.turn === turnNumber ? { ...t, ...updates } : t,
    );
    set({ active: await persist({ ...m, turns }) });
  },

  finish: async (result) => {
    const m = get().active;
    if (!m) return null;
    const finished = await persist({ ...m, result, phase: 'finished' });
    set({ active: null });
    return finished;
  },

  cancel: async () => {
    const m = get().active;
    if (!m) return;
    await db.liveMatches.delete(m.id);
    set({ active: null });
  },
}));
