import { useState, useEffect, useCallback } from 'react';
import type { Pokemon } from '@/types/pokemon';
import type { OpponentTeam, OpponentPokemon } from '@/types/matchup';
import { searchPokemon } from '@/db/pokemon-cache';
import { useMatchupStore } from '@/stores/matchup-store';

export default function ScoutingLog() {
  const { scoutingLog, loading, loadScoutingLog, addOpponentTeam, deleteOpponentTeam } = useMatchupStore();
  const [showForm, setShowForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [members, setMembers] = useState<OpponentPokemon[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Pokemon[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    void loadScoutingLog();
  }, [loadScoutingLog]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      const results = await searchPokemon(query, 8);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, []);

  const addMember = (pokemon: Pokemon) => {
    if (members.length >= 6) return;
    const opp: OpponentPokemon = {
      pokemonId: pokemon.id,
      name: pokemon.name,
    };
    setMembers((prev) => [...prev, opp]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const saveTeam = async () => {
    if (!teamName.trim() || members.length === 0) return;
    const team: OpponentTeam = {
      id: crypto.randomUUID(),
      name: teamName.trim(),
      playerName: playerName.trim() || undefined,
      date: Date.now(),
      members,
      notes: notes.trim() || undefined,
    };
    await addOpponentTeam(team);
    resetForm();
  };

  const resetForm = () => {
    setTeamName('');
    setPlayerName('');
    setMembers([]);
    setNotes('');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await deleteOpponentTeam(id);
  };

  if (loading) {
    return <div className="card"><p className="text-gray-400">Loading scouting log...</p></div>;
  }

  return (
    <div className="space-y-4">
      {/* Add new team button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Scouting Log</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
        >
          {showForm ? 'Cancel' : '+ Add Team'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Team Name*</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                placeholder="e.g. Round 3 Opponent"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Player Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                placeholder="e.g. Player123"
              />
            </div>
          </div>

          {/* Pokemon slots */}
          <div>
            <label className="text-xs text-gray-400">Pokémon ({members.length}/6)</label>
            <div className="relative mt-1">
              <input
                type="text"
                placeholder="Search to add Pokémon..."
                value={searchQuery}
                onChange={(e) => void handleSearch(e.target.value)}
                disabled={members.length >= 6}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm disabled:opacity-50"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded max-h-40 overflow-y-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addMember(p)}
                      className="w-full px-3 py-1 text-left text-sm hover:bg-gray-600 capitalize"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {members.map((m, i) => (
                  <div key={`${m.pokemonId}-${i}`} className="flex items-center gap-1 bg-gray-700 px-2 py-1 rounded">
                    <span className="text-sm capitalize">{m.name}</span>
                    <button onClick={() => removeMember(i)} className="text-red-400 hover:text-red-300 text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
              rows={2}
              placeholder="Any observations about this team..."
            />
          </div>

          <button
            onClick={() => void saveTeam()}
            disabled={!teamName.trim() || members.length === 0}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium text-sm"
          >
            Save Team
          </button>
        </div>
      )}

      {/* Saved teams list */}
      {scoutingLog.length === 0 && !showForm && (
        <div className="card">
          <p className="text-gray-400 text-center">No opponent teams saved yet. Add one to start scouting!</p>
        </div>
      )}

      {scoutingLog.map((team) => (
        <div key={team.id} className="card">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
          >
            <div>
              <h4 className="font-medium">{team.name}</h4>
              <p className="text-xs text-gray-400">
                {team.playerName && `vs ${team.playerName} · `}
                {new Date(team.date).toLocaleDateString()}
                {' · '}
                {team.members.length} Pokémon
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(team.id);
                }}
                className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
              >
                Delete
              </button>
              <span className="text-gray-400">{expandedId === team.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {expandedId === team.id && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex flex-wrap gap-2">
                {team.members.map((m, i) => (
                  <div key={`${m.pokemonId}-${i}`} className="bg-gray-700 px-3 py-1 rounded text-sm capitalize">
                    {m.name}
                    {m.knownItem && <span className="text-xs text-gray-400 ml-1">@ {m.knownItem}</span>}
                    {m.knownAbility && <span className="text-xs text-gray-400 ml-1">[{m.knownAbility}]</span>}
                  </div>
                ))}
              </div>
              {team.notes && (
                <p className="text-xs text-gray-400 mt-2">{team.notes}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
