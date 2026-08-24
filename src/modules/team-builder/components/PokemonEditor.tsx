import { useState, useEffect, useCallback } from 'react';
import type { Pokemon, PokemonType, Nature } from '@/types/pokemon';
import { POKEMON_TYPES } from '@/types/pokemon';
import type { TeamMember, StatSpread } from '@/types/team';
import { DEFAULT_EVS, DEFAULT_IVS } from '@/types/team';
import { searchPokemon, getPokemonById } from '@/db/pokemon-cache';
import { useTeamStore } from '@/stores/team-store';
import { useSettingsStore } from '@/stores/settings-store';
import { getRegulationById } from '@/data/regulation-loader';
import spreadPresetsData from '@/data/spread-presets.json';

const ALL_NATURES: Nature[] = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
];

const spreadPresets = spreadPresetsData as { id: string; name: string; evs: StatSpread; nature: Nature }[];

interface PokemonEditorProps {
  teamId: string;
  member?: TeamMember;
  pokemonData?: Pokemon;
  onClose: () => void;
}

export default function PokemonEditor({ teamId, member, pokemonData, onClose }: PokemonEditorProps) {
  const { addMember, updateMember } = useTeamStore();
  const { selectedRegulationId } = useSettingsStore();
  const regulation = getRegulationById(selectedRegulationId);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Pokemon[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | undefined>(pokemonData);
  const [showSearch, setShowSearch] = useState(!pokemonData);

  const [ability, setAbility] = useState(member?.ability ?? '');
  const [item, setItem] = useState(member?.item ?? '');
  const [nature, setNature] = useState<Nature>(member?.nature ?? 'adamant');
  const [teraType, setTeraType] = useState<PokemonType | undefined>(member?.teraType);
  const [moves, setMoves] = useState<string[]>(member?.moves ?? ['', '', '', '']);
  const [evs, setEvs] = useState<StatSpread>(member?.evs ?? { ...DEFAULT_EVS });
  const [ivs, setIvs] = useState<StatSpread>(member?.ivs ?? { ...DEFAULT_IVS });
  const [moveSearches, setMoveSearches] = useState<string[]>(['', '', '', '']);

  useEffect(() => {
    if (member && !selectedPokemon) {
      void getPokemonById(member.pokemonId).then((p) => {
        if (p) setSelectedPokemon(p);
      });
    }
  }, [member, selectedPokemon]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      const results = await searchPokemon(query, 10);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, []);

  const selectPokemon = (pokemon: Pokemon) => {
    setSelectedPokemon(pokemon);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    if (!ability && pokemon.abilities.length > 0) {
      setAbility(pokemon.abilities[0]);
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = spreadPresets.find((p) => p.id === presetId);
    if (preset) {
      setEvs({ ...preset.evs });
      setNature(preset.nature);
    }
  };

  const updateEv = (stat: keyof StatSpread, value: number) => {
    const clamped = Math.max(0, Math.min(252, value));
    setEvs((prev) => ({ ...prev, [stat]: clamped }));
  };

  const updateIv = (stat: keyof StatSpread, value: number) => {
    const clamped = Math.max(0, Math.min(31, value));
    setIvs((prev) => ({ ...prev, [stat]: clamped }));
  };

  const updateMove = (index: number, value: string) => {
    setMoves((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const updateMoveSearch = (index: number, value: string) => {
    setMoveSearches((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleSave = async () => {
    if (!selectedPokemon) return;

    const memberData: TeamMember = {
      id: member?.id ?? crypto.randomUUID(),
      pokemonId: selectedPokemon.id,
      ability,
      item,
      nature,
      teraType,
      moves: moves.filter((m) => m !== ''),
      evs,
      ivs,
      level: regulation?.level ?? 50,
      available: true,
    };

    if (member) {
      await updateMember(teamId, member.id, memberData);
    } else {
      await addMember(teamId, memberData);
    }
    onClose();
  };

  const evTotal = Object.values(evs).reduce((sum, v) => sum + v, 0);
  const statKeys: (keyof StatSpread)[] = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];
  const statLabels: Record<keyof StatSpread, string> = {
    hp: 'HP', attack: 'Atk', defense: 'Def',
    specialAttack: 'SpA', specialDefense: 'SpD', speed: 'Spe',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-gray-800 w-full sm:w-[540px] max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-100">
            {member ? 'Edit Pokémon' : 'Add Pokémon'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Pokemon Search */}
        {showSearch ? (
          <div className="space-y-2">
            <input
              type="text"
              className="input w-full"
              placeholder="Search Pokémon..."
              value={searchQuery}
              onChange={(e) => void handleSearch(e.target.value)}
              autoFocus
            />
            {searchResults.length > 0 && (
              <div className="bg-gray-700 rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    className="w-full px-3 py-2 text-left text-gray-100 hover:bg-gray-600 capitalize"
                    onClick={() => selectPokemon(p)}
                  >
                    {p.name}
                    <span className="text-gray-400 text-sm ml-2">
                      {p.types.join(' / ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : selectedPokemon ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-100 font-medium capitalize">{selectedPokemon.name}</span>
            <div className="flex gap-1">
              {selectedPokemon.types.map((type) => (
                <span key={type} className={`px-2 py-0.5 rounded text-xs text-white bg-${type}`}>
                  {type}
                </span>
              ))}
            </div>
            <button
              className="ml-auto text-sm text-blue-400 hover:text-blue-300"
              onClick={() => setShowSearch(true)}
            >
              Change
            </button>
          </div>
        ) : null}

        {selectedPokemon && (
          <>
            {/* Ability */}
            <div>
              <label className="text-sm text-gray-400">Ability</label>
              <select
                className="input w-full capitalize"
                value={ability}
                onChange={(e) => setAbility(e.target.value)}
              >
                <option value="">Select ability</option>
                {selectedPokemon.abilities.map((a) => (
                  <option key={a} value={a} className="capitalize">{a}</option>
                ))}
              </select>
            </div>

            {/* Item */}
            <div>
              <label className="text-sm text-gray-400">Item</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g. Choice Scarf"
                value={item}
                onChange={(e) => setItem(e.target.value)}
              />
            </div>

            {/* Nature */}
            <div>
              <label className="text-sm text-gray-400">Nature</label>
              <select
                className="input w-full capitalize"
                value={nature}
                onChange={(e) => setNature(e.target.value as Nature)}
              >
                {ALL_NATURES.map((n) => (
                  <option key={n} value={n} className="capitalize">{n}</option>
                ))}
              </select>
            </div>

            {/* Tera Type */}
            {regulation?.terastallize && (
              <div>
                <label className="text-sm text-gray-400">Tera Type</label>
                <select
                  className="input w-full capitalize"
                  value={teraType ?? ''}
                  onChange={(e) => setTeraType((e.target.value || undefined) as PokemonType | undefined)}
                >
                  <option value="">None</option>
                  {POKEMON_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </select>
              </div>
            )}

            {/* EVs */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">EVs ({evTotal}/508)</label>
                <select
                  className="input text-xs py-1"
                  onChange={(e) => applyPreset(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>Apply preset...</option>
                  {spreadPresets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {statKeys.map((stat) => (
                  <div key={stat}>
                    <label className="text-xs text-gray-500">{statLabels[stat]}</label>
                    <input
                      type="number"
                      className="input w-full text-sm"
                      min={0}
                      max={252}
                      value={evs[stat]}
                      onChange={(e) => updateEv(stat, parseInt(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* IVs */}
            <div>
              <label className="text-sm text-gray-400">IVs</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {statKeys.map((stat) => (
                  <div key={stat}>
                    <label className="text-xs text-gray-500">{statLabels[stat]}</label>
                    <input
                      type="number"
                      className="input w-full text-sm"
                      min={0}
                      max={31}
                      value={ivs[stat]}
                      onChange={(e) => updateIv(stat, parseInt(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Moves */}
            <div>
              <label className="text-sm text-gray-400">Moves</label>
              <div className="space-y-2 mt-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="relative">
                    <input
                      type="text"
                      className="input w-full text-sm capitalize"
                      placeholder={`Move ${i + 1}`}
                      value={moveSearches[i] || moves[i]}
                      onChange={(e) => {
                        updateMoveSearch(i, e.target.value);
                        if (!e.target.value) updateMove(i, '');
                      }}
                      onFocus={() => updateMoveSearch(i, moveSearches[i] || moves[i])}
                      onBlur={() => {
                        setTimeout(() => updateMoveSearch(i, ''), 200);
                      }}
                    />
                    {moveSearches[i] && selectedPokemon.movepool.length > 0 && (
                      <div className="absolute z-10 w-full bg-gray-700 rounded-lg max-h-32 overflow-y-auto mt-1">
                        {selectedPokemon.movepool
                          .filter((m) => m.toLowerCase().includes(moveSearches[i].toLowerCase()))
                          .slice(0, 8)
                          .map((move) => (
                            <button
                              key={move}
                              className="w-full px-3 py-1 text-left text-sm text-gray-100 hover:bg-gray-600 capitalize"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                updateMove(i, move);
                                updateMoveSearch(i, '');
                              }}
                            >
                              {move}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Save */}
            <div className="flex gap-2 pt-2">
              <button className="btn-primary flex-1" onClick={() => void handleSave()}>
                {member ? 'Update' : 'Add to Team'}
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
