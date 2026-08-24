import type { TeamMember } from '@/types/team';
import { checkRoleCoverage } from '@/engine/synergy-analyzer';
import { useTeamPokemon } from '../hooks/useTeamPokemon';

interface RoleCoverageViewProps {
  members: TeamMember[];
}

interface RoleDisplay {
  label: string;
  filled: boolean;
  providers: string[];
}

export default function RoleCoverageView({ members }: RoleCoverageViewProps) {
  const { pokemonMap, loading } = useTeamPokemon(members);

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading role data...</p>;
  }

  if (members.length === 0) {
    return <p className="text-gray-400 text-sm">Add Pokémon to see role coverage.</p>;
  }

  const teamData = members
    .map((m) => {
      const pokemon = pokemonMap.get(m.pokemonId);
      if (!pokemon) return null;
      return {
        name: pokemon.name,
        moves: m.moves,
        ability: m.ability,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const coverage = checkRoleCoverage(teamData);

  const roles: RoleDisplay[] = [
    { label: 'Speed Control', filled: coverage.hasSpeedControl, providers: coverage.speedControlMoves },
    { label: 'Fake Out', filled: coverage.hasFakeOut, providers: coverage.fakeOutUsers },
    { label: 'Redirection', filled: coverage.hasRedirection, providers: coverage.redirectionUsers },
    { label: 'Weather Setter', filled: coverage.hasWeatherSetter, providers: coverage.weatherSetters },
    { label: 'Intimidate', filled: coverage.hasIntimidation, providers: coverage.intimidateUsers },
    { label: 'Priority Moves', filled: coverage.hasPriorityMoves, providers: coverage.priorityUsers },
  ];

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-100">Role Coverage</h4>
      <div className="space-y-2">
        {roles.map((role) => (
          <div
            key={role.label}
            className="flex items-start gap-3 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700"
          >
            <span className={`text-lg ${role.filled ? 'text-green-400' : 'text-red-400'}`}>
              {role.filled ? '✓' : '✗'}
            </span>
            <div className="flex-1">
              <p className={`font-medium ${role.filled ? 'text-gray-100' : 'text-gray-400'}`}>
                {role.label}
              </p>
              {role.providers.length > 0 && (
                <p className="text-xs text-gray-400 capitalize mt-0.5">
                  {role.providers.join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
