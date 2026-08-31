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
  startSeed: () => Promise<void>;
  reseed: () => Promise<void>;
}

export function useDataInit(): UseDataInitResult {
  const [isReady, setIsReady] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [seedProgress, setSeedProgress] = useState<SeedProgress | null>(null);
  const [pokemonCount, setPokemonCount] = useState(0);

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

    await seedPokemonFromChampions((current, total) => {
      setSeedProgress({ current, total });
    });

    const count = await getPokemonCount();
    setPokemonCount(count);
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
    await seedPokemonFromChampions((current, total) => {
      setSeedProgress({ current, total });
    });
    const count = await getPokemonCount();
    setPokemonCount(count);
    setSeedProgress(null);
    setNeedsSeed(false);
  }, []);

  return {
    isReady,
    needsSeed,
    seedProgress,
    pokemonCount,
    startSeed,
    reseed,
  };
}
