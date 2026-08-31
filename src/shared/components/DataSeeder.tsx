import { useState } from 'react';
import { useDataInit } from '@/hooks/useDataInit';

export function DataSeeder() {
  const { isReady, needsSeed, seedProgress, startSeed } = useDataInit();
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-gray-400">Checking database…</p>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="card border-green-700 bg-green-900/30 text-center">
        <p className="font-semibold text-green-400">
          ✓ Pokémon data loaded. You can search in the Team Builder now.
        </p>
      </div>
    );
  }

  if (!needsSeed) {
    return null;
  }

  const isSeeding = seedProgress !== null;

  const handleStart = async () => {
    try {
      await startSeed();
      setIsDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred');
    }
  };

  const progressPercent =
    seedProgress && seedProgress.total > 0
      ? Math.round((seedProgress.current / seedProgress.total) * 100)
      : 0;

  return (
    <div className="card border-blue-700 bg-blue-900/20">
      <h2 className="mb-1 text-lg font-semibold text-gray-100">
        Load your Pokédex
      </h2>
      <p className="mb-3 text-sm text-gray-400">
        The Pokémon database is empty, so search won't return results yet. Load
        the full Pokémon Champions dex once (needs internet) to enable Team
        Builder search. Data: Pokémon Champions Battle Data.
      </p>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {isSeeding ? (
        <div>
          <div className="mb-2 flex justify-between text-sm text-gray-400">
            <span>Loading Champions dex…</span>
            <span>
              {seedProgress.total > 0
                ? `${seedProgress.current}/${seedProgress.total}`
                : ''}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleStart()}
          className="btn-primary w-full"
        >
          Load Champions Pokédex
        </button>
      )}
    </div>
  );
}
