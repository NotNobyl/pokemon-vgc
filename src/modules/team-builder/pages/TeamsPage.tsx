import { useState, useEffect } from 'react';
import { useTeamStore } from '@/stores/team-store';
import { useSettingsStore } from '@/stores/settings-store';
import TeamDetail from '../components/TeamDetail';

export default function TeamsPage() {
  const { teams, loading, loadTeams, createTeam, deleteTeam, duplicateTeam } = useTeamStore();
  const { selectedRegulationId } = useSettingsStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async () => {
    const name = newName.trim();
    if (!name) return;
    const team = await createTeam(name, selectedRegulationId);
    setNewName('');
    setCreating(false);
    setSelectedTeamId(team.id);
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicateTeam(id);
    if (copy) setSelectedTeamId(copy.id);
  };

  const handleDelete = async (id: string) => {
    await deleteTeam(id);
    setConfirmDeleteId(null);
  };

  if (selectedTeamId) {
    return <TeamDetail teamId={selectedTeamId} onBack={() => setSelectedTeamId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-100">My Teams</h2>
        <button className="btn-primary" onClick={() => setCreating((c) => !c)}>
          + New Team
        </button>
      </div>

      {creating && (
        <div className="card flex flex-col sm:flex-row gap-2">
          <input
            className="input flex-1"
            placeholder="Team name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateTeam();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!newName.trim()} onClick={() => void handleCreateTeam()}>
              Create
            </button>
            <button className="btn-secondary" onClick={() => { setCreating(false); setNewName(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <p className="text-gray-400">Loading teams...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="card">
          <p className="text-gray-400">No teams yet. Create your first team to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="card cursor-pointer hover:border-blue-500 transition-colors relative"
              onClick={() => setSelectedTeamId(team.id)}
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-100 truncate pr-2">{team.name}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="text-gray-500 hover:text-blue-400 transition-colors text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDuplicate(team.id);
                    }}
                    aria-label={`Duplicate ${team.name}`}
                    title="Duplicate"
                  >
                    ⧉
                  </button>
                  <button
                    className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(team.id);
                    }}
                    aria-label={`Delete ${team.name}`}
                  >
                    🗑
                  </button>
                </div>
              </div>

              {team.archetype.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {team.archetype.map((arch) => (
                    <span
                      key={arch}
                      className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                    >
                      {arch}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
                <span>{team.members.length}/6 Pokémon</span>
                <span>{new Date(team.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Delete confirmation */}
              {confirmDeleteId === team.id && (
                <div
                  className="absolute inset-0 bg-gray-900/90 rounded-xl flex items-center justify-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-sm text-gray-200">Delete?</span>
                  <button
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                    onClick={() => void handleDelete(team.id)}
                  >
                    Yes
                  </button>
                  <button
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
