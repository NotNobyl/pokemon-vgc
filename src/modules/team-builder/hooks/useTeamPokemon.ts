import { useState, useEffect } from 'react';
import type { Pokemon } from '@/types/pokemon';
import type { TeamMember } from '@/types/team';
import { getPokemonById } from '@/db/pokemon-cache';

export function useTeamPokemon(members: TeamMember[]) {
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPokemon() {
      if (members.length === 0) {
        setPokemonMap(new Map());
        return;
      }

      setLoading(true);
      const map = new Map<number, Pokemon>();

      const uniqueIds = [...new Set(members.map((m) => m.pokemonId))];
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
  }, [members]);

  return { pokemonMap, loading };
}
