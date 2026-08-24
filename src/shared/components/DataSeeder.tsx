import { useState } from 'react';
import { useDataInit } from '@/hooks/useDataInit';

export function DataSeeder() {
  const { isReady, needsSeed, seedProgress, startSeed } = useDataInit();
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Checking database...</p>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-700">
          ✓ Pokémon data loaded successfully!
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
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-gray-800">
        Your Pokédex is empty
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Load common VGC Pokémon data from PokeAPI to get started.
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      {isSeeding ? (
        <div>
          <div className="mb-2 flex justify-between text-sm text-gray-600">
            <span>Loading Pokémon...</span>
            <span>
              {seedProgress.current}/{seedProgress.total}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
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
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Load Pokémon data
        </button>
      )}
    </div>
  );
}
