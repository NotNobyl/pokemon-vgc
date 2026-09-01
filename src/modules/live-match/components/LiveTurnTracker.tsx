import { useEffect, useState } from 'react';
import type { PokemonUsage } from '@/types/usage';
import type { LiveTurn } from '@/types/live-match';
import { useLiveMatchStore } from '@/stores/live-match-store';
import { useBattleLogStore } from '@/stores/battle-log-store';
import {
  getUsageForShowdownId,
  topRows,
  usageConfidence,
  useUsageStore,
} from '@/stores/usage-store';
import { candidateKeys } from '@/data/sources/showdown-mapping';
import { buildLikelySet } from '@/engine/matchup-lab';
import { generateImprovementNotes } from '@/engine/improvement-notes';
import type { BattleLog } from '@/types/battle-log';

/**
 * Slice B + C: running turn tracker with usage-backed opponent predictions and
 * per-Pokémon reveal logging, plus finish -> game log with improvement notes.
 */
export default function LiveTurnTracker() {
  const { active, revealOpponentInfo, toggleBrought, addTurn, finish } = useLiveMatchStore();
  const { addLog } = useBattleLogStore();
  const season = useUsageStore((s) => s.season);

  const [usageByName, setUsageByName] = useState<Map<string, PokemonUsage>>(new Map());
  const [turnNote, setTurnNote] = useState('');
  const [savedLog, setSavedLog] = useState<BattleLog | null>(null);
  const [pendingResult, setPendingResult] = useState<'win' | 'loss' | null>(null);

  // Load cached usage for each opponent (for predictions).
  // Opponent identity key — only re-fetch usage when the ROSTER changes, not on
  // every reveal/turn write (which previously re-fetched all usage and caused
  // the back-and-forth jank).
  const opponentKey = active ? active.opponents.map((o) => o.name).join('|') : '';

  useEffect(() => {
    let cancelled = false;
    const names = opponentKey ? opponentKey.split('|') : [];
    async function load() {
      if (names.length === 0) {
        setUsageByName(new Map());
        return;
      }
      const map = new Map<string, PokemonUsage>();
      for (const name of names) {
        for (const key of candidateKeys(name)) {
          const u = await getUsageForShowdownId(key);
          if (u) {
            map.set(name, u);
            break;
          }
        }
      }
      if (!cancelled) setUsageByName(map);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [opponentKey]);

  if (!active) return null;

  const likelyMoves = (oppName: string): string[] => {
    const u = usageByName.get(oppName);
    if (!u) return [];
    const set = buildLikelySet(oppName, u);
    return set.topMoves.map((m) => m.name);
  };

  const handleFinish = async (result: 'win' | 'loss') => {
    const notes = generateImprovementNotes(active, likelyMoves);
    const log: BattleLog = {
      id: crypto.randomUUID(),
      teamId: active.teamId,
      date: Date.now(),
      result,
      brought: active.myBring4,
      opponentBrought: active.opponents.filter((o) => o.brought).map((o) => o.name),
      notes: notes.map((n) => n.text),
      tags: notes.map((n) => n.tag),
    };
    await addLog(log);
    const finished = await finish(result);
    if (finished) setSavedLog(log);
  };

  // Finished state: show the saved log + improvement notes.
  if (active.phase === 'finished' || savedLog) {
    return (
      <div className="card space-y-3">
        <h3 className="font-semibold">Match saved to game log</h3>
        {savedLog && (
          <>
            <p className={`text-sm font-medium ${savedLog.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
              Result: {savedLog.result.toUpperCase()}
            </p>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Improvement notes (heuristic)
              </div>
              <ul className="space-y-1">
                {savedLog.notes.map((n, i) => (
                  <li key={i} className="text-sm text-gray-200 flex gap-2">
                    <span className="text-blue-400">•</span>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Opponent predictions */}
      <div className="card">
        <h3 className="font-semibold mb-1">Opponent likely sets</h3>
        <p className="text-xs text-gray-500 mb-3">
          Predicted from usage ({season ?? 'Current'}). Log what's revealed as
          the game shows it — predictions are not certainties.
        </p>
        <div className="space-y-3">
          {active.opponents.map((opp) => {
            const u = usageByName.get(opp.name);
            const conf = usageConfidence(u, season);
            const moves = topRows(u, 'move', 4);
            const items = topRows(u, 'held_item', 2);
            const abilities = topRows(u, 'ability', 1);
            return (
              <div key={opp.name} className={`border-b border-gray-800 pb-2 last:border-0 ${opp.brought ? '' : 'opacity-60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="capitalize font-medium flex-1">{opp.name}</span>
                  <button
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      opp.brought
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                    onClick={() => void toggleBrought(opp.name)}
                    title="Mark whether the opponent brought this Pokémon"
                  >
                    {opp.brought ? '✓ brought' : 'bench'}
                  </button>
                  {conf && (
                    <span
                      className={`text-xs ${
                        conf.label === 'high'
                          ? 'text-green-400'
                          : conf.label === 'moderate'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      }`}
                      title={conf.reason}
                    >
                      {conf.label}
                    </span>
                  )}
                </div>
                {u ? (
                  <div className="text-xs text-gray-300 mt-1 space-y-0.5">
                    {moves.length > 0 && (
                      <div>
                        <span className="text-gray-500">Likely moves: </span>
                        {moves.map((m) => `${m.name} (${m.percentage?.toFixed(0)}%)`).join(', ')}
                      </div>
                    )}
                    {items.length > 0 && (
                      <div>
                        <span className="text-gray-500">Items: </span>
                        {items.map((m) => `${m.name} (${m.percentage?.toFixed(0)}%)`).join(', ')}
                      </div>
                    )}
                    {abilities.length > 0 && (
                      <div>
                        <span className="text-gray-500">Ability: </span>
                        {abilities.map((m) => m.name).join(', ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 mt-1">
                    No cached usage — sync on the Data tab for predictions.
                  </div>
                )}

                {/* Reveal logging */}
                <RevealRow
                  revealedMoves={opp.revealed.moves}
                  onRevealMove={(move) =>
                    void revealOpponentInfo(opp.name, { moves: [move] })
                  }
                  onRevealItem={(item) => void revealOpponentInfo(opp.name, { item })}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Turn log */}
      <div className="card">
        <h3 className="font-semibold mb-2">Turn notes</h3>
        {active.turns.length > 0 && (
          <ul className="space-y-1 mb-2 text-sm">
            {active.turns.map((t) => (
              <li key={t.turn} className="text-gray-300">
                <span className="text-gray-500">T{t.turn}:</span> {t.note}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={`Turn ${active.turns.length + 1} note…`}
            value={turnNote}
            onChange={(e) => setTurnNote(e.target.value)}
          />
          <button
            className="btn-secondary"
            disabled={!turnNote.trim()}
            onClick={() => {
              const turn: LiveTurn = {
                turn: active.turns.length + 1,
                note: turnNote.trim(),
                myActive: active.myBring4.slice(0, 2),
                theirActive: [],
              };
              void addTurn(turn);
              setTurnNote('');
            }}
          >
            Log turn
          </button>
        </div>
      </div>

      {/* Finish */}
      <div className="card">
        <h3 className="font-semibold mb-2">Finish match</h3>
        {pendingResult ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-300">
              Log this match as a <strong className={pendingResult === 'win' ? 'text-green-400' : 'text-red-400'}>{pendingResult.toUpperCase()}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                className={`flex-1 px-4 py-3 rounded-lg font-medium text-white ${pendingResult === 'win' ? 'bg-green-700 hover:bg-green-600' : 'bg-red-700 hover:bg-red-600'}`}
                onClick={() => void handleFinish(pendingResult)}
              >
                Confirm {pendingResult}
              </button>
              <button className="btn-secondary" onClick={() => setPendingResult(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              className="flex-1 px-4 py-3 bg-green-700/80 hover:bg-green-600 text-white rounded-lg font-medium"
              onClick={() => setPendingResult('win')}
            >
              Win
            </button>
            <button
              className="flex-1 px-4 py-3 bg-red-700/80 hover:bg-red-600 text-white rounded-lg font-medium"
              onClick={() => setPendingResult('loss')}
            >
              Loss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RevealRow({
  revealedMoves,
  onRevealMove,
  onRevealItem,
}: {
  revealedMoves: string[];
  onRevealMove: (move: string) => void;
  onRevealItem: (item: string) => void;
}) {
  const [move, setMove] = useState('');
  const [item, setItem] = useState('');
  return (
    <div className="mt-2 space-y-1">
      {revealedMoves.length > 0 && (
        <div className="text-xs text-blue-300">
          Revealed: {revealedMoves.join(', ')}
        </div>
      )}
      <div className="flex gap-1">
        <input
          className="input text-xs flex-1 py-1"
          placeholder="Revealed move"
          value={move}
          onChange={(e) => setMove(e.target.value)}
        />
        <button
          className="text-xs px-2 bg-gray-700 rounded"
          disabled={!move.trim()}
          onClick={() => {
            onRevealMove(move.trim());
            setMove('');
          }}
        >
          +
        </button>
        <input
          className="input text-xs flex-1 py-1"
          placeholder="Revealed item"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />
        <button
          className="text-xs px-2 bg-gray-700 rounded"
          disabled={!item.trim()}
          onClick={() => {
            onRevealItem(item.trim());
            setItem('');
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
