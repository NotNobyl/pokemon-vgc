import { useState, useEffect } from 'react';
import type { TeamMember } from '@/types/team';
import type { Pokemon } from '@/types/pokemon';
import type { OpponentPokemon } from '@/types/matchup';
import { calcAllStats } from '@/types/team';
import { NATURE_MAP } from '@/types/pokemon';
import { getPokemonById } from '@/db/pokemon-cache';
import { calcBaseSpeed, compareSpeed } from '@/engine/speed-calc';

interface LeadSuggestionProps {
  myBring4: TeamMember[];
  opponentTeam: OpponentPokemon[];
}

interface LeadResult {
  leads: [string, string];
  backs: [string, string];
  reasoning: string[];
  score: number;
}

export default function LeadSuggestion({ myBring4, opponentTeam }: LeadSuggestionProps) {
  const [myPokemonData, setMyPokemonData] = useState<Map<number, Pokemon>>(new Map());
  const [oppPokemonData, setOppPokemonData] = useState<Map<number, Pokemon>>(new Map());
  const [suggestion, setSuggestion] = useState<LeadResult | null>(null);

  // Load Pokemon data
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const myMap = new Map<number, Pokemon>();
      const oppMap = new Map<number, Pokemon>();

      for (const m of myBring4) {
        const p = await getPokemonById(m.pokemonId);
        if (p && !cancelled) myMap.set(p.id, p);
      }
      for (const opp of opponentTeam) {
        const p = await getPokemonById(opp.pokemonId);
        if (p && !cancelled) oppMap.set(p.id, p);
      }

      if (!cancelled) {
        setMyPokemonData(myMap);
        setOppPokemonData(oppMap);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [myBring4, opponentTeam]);

  // Generate lead suggestion
  useEffect(() => {
    if (myBring4.length < 4 || myPokemonData.size === 0) {
      setSuggestion(null);
      return;
    }

    // Check if opponent likely has Trick Room
    const oppHasTR = opponentTeam.some((opp) => {
      const p = oppPokemonData.get(opp.pokemonId);
      if (!p) return false;
      // Common TR setters are slow Pokemon with Psychic/Ghost type
      return p.baseStats.speed <= 50 || (opp.knownMoves?.some((m) => m.toLowerCase().includes('trick')) ?? false);
    });

    // Score each possible lead pair
    let bestResult: LeadResult | null = null;

    for (let i = 0; i < myBring4.length; i++) {
      for (let j = i + 1; j < myBring4.length; j++) {
        const leads: [TeamMember, TeamMember] = [myBring4[i], myBring4[j]];
        const backs = myBring4.filter((_, idx) => idx !== i && idx !== j);
        let score = 0;
        const reasoning: string[] = [];

        for (const lead of leads) {
          const pokemon = myPokemonData.get(lead.pokemonId);
          if (!pokemon) continue;

          const natureMod = NATURE_MAP[lead.nature] ?? {};
          const mult: Record<string, number> = { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 };
          if (natureMod.plus) mult[natureMod.plus] = 1.1;
          if (natureMod.minus) mult[natureMod.minus] = 0.9;
          const stats = calcAllStats(pokemon.baseStats, lead.evs, lead.ivs, lead.level, mult as Record<keyof typeof pokemon.baseStats, number>);
          const speed = calcBaseSpeed(pokemon.baseStats, lead.evs, lead.ivs, lead.nature, lead.level);

          // Fake Out bonus
          const hasFakeOut = lead.moves.some((m) => m.toLowerCase().replace(/[\s-]/g, '') === 'fakeout');
          if (hasFakeOut) {
            score += 15;
            reasoning.push(`${pokemon.name} has Fake Out for turn 1 pressure`);
          }

          // Speed control vs TR
          const hasTailwind = lead.moves.some((m) => m.toLowerCase().replace(/[\s-]/g, '') === 'tailwind');
          if (hasTailwind && !oppHasTR) {
            score += 12;
            reasoning.push(`${pokemon.name} can set Tailwind`);
          }

          const hasTrickRoom = lead.moves.some((m) => m.toLowerCase().replace(/[\s-]/g, '') === 'trickroom');
          if (hasTrickRoom && oppHasTR) {
            score += 14;
            reasoning.push(`${pokemon.name} can counter Trick Room`);
          }

          // Speed advantage
          let speedWins = 0;
          for (const opp of opponentTeam) {
            const oppP = oppPokemonData.get(opp.pokemonId);
            if (!oppP) continue;
            const oppSpeed = calcBaseSpeed(
              oppP.baseStats,
              { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 252 },
              { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
              'jolly', 50,
            );
            if (compareSpeed(speed, oppSpeed, false) === 'first') {
              speedWins++;
            }
          }
          if (speedWins >= 3) {
            score += 8;
            reasoning.push(`${pokemon.name} outspeeds most of their team`);
          }

          // Offensive presence
          const isPhysical = stats.attack >= stats.specialAttack;
          const mainStat = isPhysical ? stats.attack : stats.specialAttack;
          if (mainStat >= 150) {
            score += 10;
            reasoning.push(`${pokemon.name} has high offensive stats`);
          }

          // Protect for safety
          const hasProtect = lead.moves.some((m) => {
            const lower = m.toLowerCase().replace(/[\s-]/g, '');
            return lower === 'protect' || lower === 'detect';
          });
          if (hasProtect) {
            score += 3;
          }
        }

        if (!bestResult || score > bestResult.score) {
          const leadNames: [string, string] = [
            myPokemonData.get(leads[0].pokemonId)?.name ?? 'Unknown',
            myPokemonData.get(leads[1].pokemonId)?.name ?? 'Unknown',
          ];
          const backNames: [string, string] = [
            myPokemonData.get(backs[0].pokemonId)?.name ?? 'Unknown',
            myPokemonData.get(backs[1].pokemonId)?.name ?? 'Unknown',
          ];
          bestResult = { leads: leadNames, backs: backNames, reasoning, score };
        }
      }
    }

    setSuggestion(bestResult);
  }, [myBring4, myPokemonData, opponentTeam, oppPokemonData]);

  if (myBring4.length < 4) {
    return (
      <div className="card">
        <p className="text-gray-400">Select 4 Pokémon to bring to get lead suggestions.</p>
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div className="card">
        <p className="text-gray-400">Calculating lead suggestions...</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold">Lead Suggestion</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-700/50 rounded p-3">
          <h4 className="text-sm font-medium text-green-400 mb-2">Lead (Front)</h4>
          <div className="flex gap-2">
            {suggestion.leads.map((name, i) => (
              <span key={i} className="px-3 py-1 bg-green-900/30 border border-green-700 rounded capitalize text-sm">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-gray-700/50 rounded p-3">
          <h4 className="text-sm font-medium text-blue-400 mb-2">Back</h4>
          <div className="flex gap-2">
            {suggestion.backs.map((name, i) => (
              <span key={i} className="px-3 py-1 bg-blue-900/30 border border-blue-700 rounded capitalize text-sm">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {suggestion.reasoning.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-1">Reasoning</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            {suggestion.reasoning.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
