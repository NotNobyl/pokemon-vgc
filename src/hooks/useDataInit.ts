import { useCallback, useEffect, useState } from 'react';
import { getPokemonCount } from '@/db/pokemon-cache';
import { fetchAndSeedPokemon } from '@/scripts/seed-pokemon';

interface SeedProgress {
  current: number;
  total: number;
}

interface UseDataInitResult {
  isReady: boolean;
  needsSeed: boolean;
  seedProgress: SeedProgress | null;
  startSeed: () => Promise<void>;
}

export function useDataInit(): UseDataInitResult {
  const [isReady, setIsReady] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [seedProgress, setSeedProgress] = useState<SeedProgress | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkData() {
      const count = await getPokemonCount();
      if (!cancelled) {
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
    setSeedProgress({ current: 0, total: 0 });

    await fetchAndSeedPokemon((current, total) => {
      setSeedProgress({ current, total });
    });

    setSeedProgress(null);
    setNeedsSeed(false);
  }, []);

  return { isReady, needsSeed, seedProgress, startSeed };
}
