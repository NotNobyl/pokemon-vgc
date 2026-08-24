import { useState, useCallback } from 'react';
import type { OpponentPokemon } from '@/types/matchup';

export function useOpponentPokemon() {
  const [opponents, setOpponents] = useState<OpponentPokemon[]>([]);

  const addOpponent = useCallback((pokemon: OpponentPokemon) => {
    setOpponents((prev) => {
      if (prev.length >= 6) return prev;
      return [...prev, pokemon];
    });
  }, []);

  const removeOpponent = useCallback((index: number) => {
    setOpponents((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearOpponents = useCallback(() => {
    setOpponents([]);
  }, []);

  return { opponents, addOpponent, removeOpponent, clearOpponents };
}
