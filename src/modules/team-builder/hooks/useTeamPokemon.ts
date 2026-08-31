import { useState, useEffect, useMemo } from 'react';
import type { Pokemon } from '@/types/pokemon';
import type { TeamMember } from '@/types/team';
import { getPokemonById } from '@/db/pokemon-cache';

export function useTeamPokemon(members: TeamMember[]) {
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [loading, setLoading] = useState(false);

  // Stable dependency: only refetch when the SET of species ids changes, not on
  // every render (members is a new array reference each render, which
  // previously caused a redundant IndexedDB read on every parent re-render —
  // and this hook is called by several components for the same team).
  const idKey = useMemo(
    () => [...new Set(members.map((m) => m.pokemonId))].sort((a, b) => a - b).join(','),
    [members],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPokemon() {
      const uniqueIds = idKey ? idKey.split(',').map(Number) : [];
      if (uniqueIds.length === 0) {
        setPokemonMap(new Map());
        return;
      }

      setLoading(true);
      const map = new Map<number, Pokemon>();
      const results = await Promise.all(uniqueIds.map((id) => getPokemonById(id)));

      for (const pokemon of results) {
        if (pokemon && !cancelled) {
          map.set(pokemon.id, pokemon);
        }
      }

      if (!cancelled) {
        setPokemonMap(map);
        setLoading(false);
      }
    }

    void loadPokemon();

    return () => {
      cancelled = true;
    };
  }, [idKey]);

  return { pokemonMap, loading };
}
