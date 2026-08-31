import { useEffect } from 'react';
import { useUsageStore, CURRENT_FORMAT } from '@/stores/usage-store';
import { useDataInit } from '@/hooks/useDataInit';

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toLocaleString();
}

function freshnessLabel(iso: string | null): { text: string; className: string } {
  if (!iso) return { text: 'No data cached', className: 'text-gray-400' };
  const ageMs = Date.now() - new Date(iso).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 3) return { text: 'Fresh', className: 'text-green-400' };
  if (ageDays <= 14) return { text: 'Aging', className: 'text-yellow-400' };
  return { text: 'Stale', className: 'text-red-400' };
}

export default function DataPage() {
  const {
    index,
    season,
    cachedCount,
    lastSyncAt,
    isSyncing,
    syncProgress,
    syncError,
    lastSyncSummary,
    attribution,
    attributionUrl,
    hydrate,
    loadIndex,
    syncAll,
    cancelSync,
  } = useUsageStore();

  const {
    pokemonCount,
    seedProgress,
    lastSeedMessage,
    reseed,
  } = useDataInit();
  const isReseeding = seedProgress !== null;

  useEffect(() => {
    void hydrate();
    // Try to resolve the current season/species list on mount (best-effort).
    void loadIndex();
  }, [hydrate, loadIndex]);

  const freshness = freshnessLabel(lastSyncAt);
  const progressPct =
    syncProgress && syncProgress.total > 0
      ? Math.round((syncProgress.current / syncProgress.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Data &amp; Settings</h2>

      {/* Champions Battle Data sync */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg mb-1">📊 Champions Battle Data</h3>
            <p className="text-gray-400 text-sm">
              Real in-game Pokémon Champions usage: moves, items, abilities,
              teammates, natures, and stat-point spreads.
            </p>
          </div>
          <span className={`text-sm font-medium ${freshness.className}`}>
            {freshness.text}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-3">
          <dt className="text-gray-400">Format</dt>
          <dd className="text-right">{CURRENT_FORMAT} (Champions)</dd>
          <dt className="text-gray-400">Current season</dt>
          <dd className="text-right">{season ?? '—'}</dd>
          <dt className="text-gray-400">Pokémon in index</dt>
          <dd className="text-right">{index ? index.entries.length : '—'}</dd>
          <dt className="text-gray-400">Cached usage records</dt>
          <dd className="text-right">{cachedCount}</dd>
          <dt className="text-gray-400">Last synced</dt>
          <dd className="text-right">{formatTimestamp(lastSyncAt)}</dd>
        </dl>

        {syncError && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {syncError} Cached data (if any) is still available offline.
          </p>
        )}

        {isSyncing && syncProgress && (
          <div className="mt-3" aria-live="polite">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>
                Syncing {syncProgress.currentName} ({syncProgress.current}/
                {syncProgress.total})
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {lastSyncSummary && !isSyncing && (
          <p className="mt-3 text-sm text-gray-300">
            Synced {lastSyncSummary.succeeded} Pokémon
            {lastSyncSummary.failed > 0
              ? `, ${lastSyncSummary.failed} failed (will retry next sync).`
              : '.'}
          </p>
        )}

        <div className="flex gap-2 mt-4">
          {!isSyncing ? (
            <button
              className="btn-primary"
              onClick={() => void syncAll()}
              disabled={isSyncing}
            >
              {cachedCount > 0 ? 'Refresh usage data' : 'Sync usage data'}
            </button>
          ) : (
            <button className="btn-secondary" onClick={cancelSync}>
              Cancel sync
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => void loadIndex()}
            disabled={isSyncing}
          >
            Check for updates
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {attribution} —{' '}
          <a
            href={attributionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-300"
          >
            championsbattledata.com
          </a>
          . Unofficial fan project; not affiliated with Nintendo/Game Freak/TPCi.
        </p>
      </div>

      {/* Manual import fallback (offline resilience) */}
      <div className="card">
        <h3 className="font-semibold text-lg mb-2">📥 Manual Import (fallback)</h3>
        <p className="text-gray-400 text-sm">
          If the API is unreachable, you can paste usage data you pulled on your
          phone. Coming next — the sync above is the primary path.
        </p>
        <button className="btn-secondary mt-3" disabled title="Coming soon">
          Paste / import CSV
        </button>
      </div>

      <div className="card">
        <h3 className="font-semibold text-lg mb-2">📦 Pokédex</h3>
        <p className="text-gray-400 text-sm">
          {pokemonCount} Pokémon cached. The full Champions roster is ~237. If
          you're missing Pokémon (or added forms like Hisuian Arcanine aren't
          showing), reload the dex.
        </p>

        {isReseeding && seedProgress && (
          <p className="mt-2 text-sm text-gray-300" aria-live="polite">
            Reloading Champions dex…
          </p>
        )}

        {!isReseeding && lastSeedMessage && (
          <p className="mt-2 text-sm text-green-400" aria-live="polite">
            {lastSeedMessage}
          </p>
        )}

        <button
          className="btn-secondary mt-3"
          onClick={() => void reseed()}
          disabled={isReseeding}
        >
          {isReseeding ? 'Reloading…' : 'Reload Pokédex'}
        </button>
        <p className="mt-2 text-[11px] text-gray-500">
          Clears the cached dex and re-downloads all Champions Pokémon (needs
          internet). Your saved teams are not affected.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-lg mb-2">🎮 Regulation</h3>
        <p className="text-gray-400 text-sm">
          Select and manage format regulation configs.
        </p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-lg mb-2">💾 Backup &amp; Restore</h3>
        <p className="text-gray-400 text-sm">Export/import all app data.</p>
      </div>
    </div>
  );
}
