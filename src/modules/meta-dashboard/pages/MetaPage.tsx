import { useState } from 'react';
import { useMeta } from '../hooks/useMeta';
import { useUsageStore } from '@/stores/usage-store';
import type { LeaderEntry } from '@/engine/meta-aggregator';

type Tab = 'ranking' | 'cores' | 'items' | 'moves' | 'abilities';

export default function MetaPage() {
  const { data, loading, season } = useMeta();
  const attribution = useUsageStore((s) => s.attribution);
  const attributionUrl = useUsageStore((s) => s.attributionUrl);
  const [tab, setTab] = useState<Tab>('ranking');

  if (loading) {
    return <div className="text-gray-400">Loading meta data…</div>;
  }

  if (!data || data.records.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Meta Dashboard</h2>
        <div className="card text-gray-300">
          No usage data cached yet. Go to the <strong>Data</strong> tab and sync
          Champions Battle Data, then come back here.
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ranking', label: 'Usage' },
    { id: 'cores', label: 'Cores' },
    { id: 'items', label: 'Items' },
    { id: 'moves', label: 'Moves' },
    { id: 'abilities', label: 'Abilities' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold">Meta Dashboard</h2>
        <span className="text-sm text-gray-400">
          Doubles · {season ?? 'Current'} · {data.records.length} mons
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ranking' && (
        <div className="card">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold">Most-used Pokémon</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Ranked by <strong>teammate co-occurrence</strong> — how often each
            Pokémon appears as a common partner across the meta. This is a
            derived popularity signal, not an official usage percentage (the
            source does not publish one).
          </p>
          <ol className="space-y-1">
            {data.ranking.slice(0, 40).map((entry, i) => (
              <li
                key={entry.key}
                className="flex items-center gap-3 py-1 border-b border-gray-800 last:border-0"
              >
                <span className="text-gray-500 w-6 text-right text-sm">
                  {i + 1}
                </span>
                <span className="capitalize flex-1">{entry.displayName}</span>
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${entry.score}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">
                  {entry.coOccurrence}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === 'cores' && (
        <div className="card">
          <h3 className="font-semibold mb-1">Common cores (pairs)</h3>
          <p className="text-xs text-gray-500 mb-3">
            Pokémon pairs that frequently list each other as teammates. ★ marks
            mutual cores (both list the other).
          </p>
          <ul className="space-y-1">
            {data.cores.map((core, i) => (
              <li
                key={`${core.members[0]}-${core.members[1]}-${i}`}
                className="flex items-center gap-2 py-1 border-b border-gray-800 last:border-0"
              >
                <span className="text-gray-500 w-6 text-right text-sm">
                  {i + 1}
                </span>
                <span className="capitalize flex-1">
                  {core.mutual && <span className="text-yellow-400">★ </span>}
                  {core.members[0]} + {core.members[1]}
                </span>
                <span className="text-xs text-gray-400">{core.strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'items' && <LeaderList title="Most common items" rows={data.itemLeaders} />}
      {tab === 'moves' && <LeaderList title="Most common moves" rows={data.moveLeaders} />}
      {tab === 'abilities' && (
        <LeaderList title="Most common abilities" rows={data.abilityLeaders} />
      )}

      <p className="text-xs text-gray-500">
        {attribution} —{' '}
        <a
          href={attributionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-300"
        >
          championsbattledata.com
        </a>
      </p>
    </div>
  );
}

function LeaderList({ title, rows }: { title: string; rows: LeaderEntry[] }) {
  return (
    <div className="card">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">
        Ranked by how many Pokémon run it across the synced meta.
      </p>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li
            key={r.name}
            className="flex items-center gap-3 py-1 border-b border-gray-800 last:border-0"
          >
            <span className="text-gray-500 w-6 text-right text-sm">{i + 1}</span>
            <span className="capitalize flex-1">{r.name}</span>
            <span className="text-xs text-gray-400">
              {r.count} mons
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
