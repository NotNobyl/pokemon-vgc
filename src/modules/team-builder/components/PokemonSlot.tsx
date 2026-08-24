import type { Pokemon } from '@/types/pokemon';
import type { TeamMember } from '@/types/team';

interface PokemonSlotProps {
  member: TeamMember;
  pokemon: Pokemon;
  onEdit: () => void;
  onRemove: () => void;
}

export default function PokemonSlot({ member, pokemon, onEdit, onRemove }: PokemonSlotProps) {
  return (
    <div
      className="card relative cursor-pointer hover:border-blue-500 transition-colors"
      onClick={onEdit}
    >
      <button
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-red-600 text-gray-400 hover:text-white transition-colors text-sm"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${pokemon.name}`}
      >
        ✕
      </button>

      <h4 className="font-semibold text-gray-100 capitalize truncate pr-6">
        {member.nickname || pokemon.name}
      </h4>

      <div className="flex gap-1 mt-1">
        {pokemon.types.map((type) => (
          <span
            key={type}
            className={`px-2 py-0.5 rounded text-xs font-medium text-white bg-${type}`}
          >
            {type}
          </span>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-1 capitalize">{member.ability}</p>
      {member.item && (
        <p className="text-xs text-gray-500 capitalize">{member.item}</p>
      )}

      <div className="mt-2 space-y-0.5">
        {member.moves.slice(0, 4).map((move, i) => (
          <p key={i} className="text-xs text-gray-300 capitalize truncate">
            {move || '—'}
          </p>
        ))}
      </div>
    </div>
  );
}
