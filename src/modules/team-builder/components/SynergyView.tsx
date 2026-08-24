import { POKEMON_TYPES } from '@/types/pokemon';
import type { TeamMember } from '@/types/team';
import { getTeamWeaknesses, getTeamResistances, getCriticalWeaknesses } from '@/engine/type-chart';
import { useTeamPokemon } from '../hooks/useTeamPokemon';

interface SynergyViewProps {
  members: TeamMember[];
}

export default function SynergyView({ members }: SynergyViewProps) {
  const { pokemonMap, loading } = useTeamPokemon(members);

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading synergy data...</p>;
  }

  const memberTypes = members
    .map((m) => pokemonMap.get(m.pokemonId)?.types)
    .filter((t): t is NonNullable<typeof t> => !!t);

  if (memberTypes.length === 0) {
    return <p className="text-gray-400 text-sm">Add Pokémon to see type synergy analysis.</p>;
  }

  const weaknesses = getTeamWeaknesses(memberTypes);
  const resistances = getTeamResistances(memberTypes);
  const critical = getCriticalWeaknesses(memberTypes);

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-100">Type Synergy</h4>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {POKEMON_TYPES.map((type) => {
          const weakCount = weaknesses.get(type) ?? 0;
          const resistCount = resistances.get(type) ?? 0;
          const isCritical = critical.has(type);

          return (
            <div
              key={type}
              className={`rounded-lg p-2 text-center border ${
                isCritical
                  ? 'border-red-500 bg-red-900/30'
                  : 'border-gray-700 bg-gray-800'
              }`}
            >
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white bg-${type} capitalize`}>
                {type}
              </span>
              <div className="mt-1 flex justify-center gap-2 text-xs">
                {weakCount > 0 && (
                  <span className={`${isCritical ? 'text-red-400 font-bold' : 'text-red-400'}`}>
                    -{weakCount}
                  </span>
                )}
                {resistCount > 0 && (
                  <span className="text-green-400">+{resistCount}</span>
                )}
                {weakCount === 0 && resistCount === 0 && (
                  <span className="text-gray-500">0</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {critical.size > 0 && (
        <p className="text-red-400 text-sm font-medium">
          ⚠ Critical weaknesses: {[...critical.entries()].map(([t, c]) => `${t} (${c}×)`).join(', ')}
        </p>
      )}
    </div>
  );
}
