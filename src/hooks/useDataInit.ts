import { useCallback, useEffect, useState } from 'react';
import { clearPokemon, getPokemonCount } from '@/db/pokemon-cache';
import { seedPokemonFromChampions } from '@/scripts/seed-champions-dex';

interface SeedProgress {
  current: number;
  total: number;
}

interface UseDataInitResult {
  isReady: boolean;
  needsSeed: boolean;
  seedProgress: SeedProgress | null;
  pokemonCount: number;
  lastSeedMessage: string | null;
  startSeed: () => Promise<void>;
  reseed: () => Promise<void>;
}

export function useDataInit(): UseDataInitResult {
  const [isReady, setIsReady] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [seedProgress, setSeedProgress] = useState<SeedProgress | null>(null);
  const [pokemonCount, setPokemonCount] = useState(0);
  const [lastSeedMessage, setLastSeedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkData() {
      const count = await getPokemonCount();
      if (!cancelled) {
        setPokemonCount(count);
        setNeedsSeed(count === 0);
        setIsReady(true);
      }
    }

    void checkData();

    return () => {
      cancelled = true;
    };
  }, []);

  const startSeed = useCallback(async () => {
    setSeedProgress({ current: 0, total: 1 });

    const result = await seedPokemonFromChampions((current, total) => {
      setSeedProgress({ current, total });
    });

    const count = await getPokemonCount();
    setPokemonCount(count);
    setLastSeedMessage(formatSeedMessage(result));
    setSeedProgress(null);
    setNeedsSeed(false);
  }, []);

  /**
   * Clear the cached dex and reload it fresh from the Champions API. Needed to
   * recover from an incomplete earlier seed (e.g. the id-collision bug that
   * dropped most Pokémon).
   */
  const reseed = useCallback(async () => {
    setSeedProgress({ current: 0, total: 1 });
    await clearPokemon();
    const result = await seedPokemonFromChampions((current, total) => {
      setSeedProgress({ current, total });
    });
    const count = await getPokemonCount();
    setPokemonCount(count);
    setLastSeedMessage(formatSeedMessage(result));
    setSeedProgress(null);
    setNeedsSeed(false);
  }, []);

  return {
    isReady,
    needsSeed,
    seedProgress,
    pokemonCount,
    lastSeedMessage,
    startSeed,
    reseed,
  };
}

/** Human-readable, non-alarming summary of a seed run. */
function formatSeedMessage(result: {
  seeded: number;
  duplicatesSkipped: number;
}): string {
  const base = `Loaded ${result.seeded} Pokémon`;
  if (result.duplicatesSkipped > 0) {
    return `${base} (${result.duplicatesSkipped} duplicate ${
      result.duplicatesSkipped === 1 ? 'entry' : 'entries'
    } skipped — same Pokémon listed twice by the source).`;
  }
  return `${base}.`;
}
