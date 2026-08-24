import { useState } from 'react';
import type { TeamMember } from '@/types/team';
import { calcBaseSpeed, calcEffectiveSpeed } from '@/engine/speed-calc';
import { useTeamPokemon } from '../hooks/useTeamPokemon';

interface SpeedTierViewProps {
  members: TeamMember[];
}

const SCENARIOS = [
  { label: 'Base', modifiers: {} },
  { label: 'Tailwind', modifiers: { tailwind: true } },
  { label: 'Trick Room', modifiers: { trickRoom: true } },
  { label: 'Choice Scarf', modifiers: { choiceScarf: true } },
  { label: '+1 Speed', modifiers: { statStage: 1 } },
] as const;

export default function SpeedTierView({ members }: SpeedTierViewProps) {
  const { pokemonMap, loading } = useTeamPokemon(members);
  const [selectedScenario, setSelectedScenario] = useState(0);

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading speed data...</p>;
  }

  if (members.length === 0) {
    return <p className="text-gray-400 text-sm">Add Pokémon to see speed tiers.</p>;
  }

  const scenario = SCENARIOS[selectedScenario];

  const speedEntries = members
    .map((m) => {
      const pokemon = pokemonMap.get(m.pokemonId);
      if (!pokemon) return null;

      const baseSpeed = calcBaseSpeed(pokemon.baseStats, m.evs, m.ivs, m.nature, m.level);
      const effectiveSpeed = calcEffectiveSpeed(baseSpeed, scenario.modifiers);

      return {
        name: pokemon.name,
        baseSpeed,
        effectiveSpeed,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      if (scenario.label === 'Trick Room') {
        return a.effectiveSpeed - b.effectiveSpeed;
      }
      return b.effectiveSpeed - a.effectiveSpeed;
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-100">Speed Tiers</h4>
        <select
          className="input text-sm py-1"
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(Number(e.target.value))}
        >
          {SCENARIOS.map((s, i) => (
            <option key={s.label} value={i}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        {speedEntries.map((entry, i) => (
          <div
            key={`${entry.name}-${i}`}
            className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg border border-gray-700"
          >
            <span className="text-gray-100 capitalize font-medium">{entry.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs">Base: {entry.baseSpeed}</span>
              <span className="text-blue-400 font-mono font-bold">{entry.effectiveSpeed}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
