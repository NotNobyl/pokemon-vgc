import { useState } from 'react';
import type { Archetype } from '@/types/team';
import { useTeamStore } from '@/stores/team-store';
import { useTeamPokemon } from '../hooks/useTeamPokemon';
import PokemonSlot from './PokemonSlot';
import PokemonEditor from './PokemonEditor';
import SynergyView from './SynergyView';
import SpeedTierView from './SpeedTierView';
import RoleCoverageView from './RoleCoverageView';

interface TeamDetailProps {
  teamId: string;
  onBack: () => void;
}

const ARCHETYPES: Archetype[] = [
  'trick-room', 'rain', 'sun', 'sand', 'snow',
  'tailwind', 'bulky-balance', 'hyper-offense', 'goodstuffs',
];

type AnalysisTab = 'synergy' | 'speed' | 'roles';

export default function TeamDetail({ teamId, onBack }: TeamDetailProps) {
  const { teams, updateTeam, removeMember } = useTeamStore();
  const team = teams.find((t) => t.id === teamId);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(team?.name ?? '');
  const [activeTab, setActiveTab] = useState<AnalysisTab>('synergy');

  const { pokemonMap, loading } = useTeamPokemon(team?.members ?? []);

  if (!team) {
    return (
      <div className="space-y-4">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
        <p className="text-gray-400">Team not found.</p>
      </div>
    );
  }

  const handleNameSave = async () => {
    if (nameInput.trim() && nameInput !== team.name) {
      await updateTeam(teamId, { name: nameInput.trim() });
    }
    setEditingName(false);
  };

  const handleArchetypeToggle = async (arch: Archetype) => {
    const newArchetypes = team.archetype.includes(arch)
      ? team.archetype.filter((a) => a !== arch)
      : [...team.archetype, arch];
    await updateTeam(teamId, { archetype: newArchetypes });
  };

  const handleRemoveMember = async (memberId: string) => {
    await removeMember(teamId, memberId);
  };

  const editingMember = editingMemberId
    ? team.members.find((m) => m.id === editingMemberId)
    : undefined;

  const editingPokemon = editingMember
    ? pokemonMap.get(editingMember.pokemonId)
    : undefined;

  const tabs: { key: AnalysisTab; label: string }[] = [
    { key: 'synergy', label: 'Synergy' },
    { key: 'speed', label: 'Speed' },
    { key: 'roles', label: 'Roles' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button className="btn-secondary text-sm" onClick={onBack}>← Back</button>
        {editingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              className="input flex-1"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleNameSave();
                if (e.key === 'Escape') setEditingName(false);
              }}
              autoFocus
            />
            <button className="btn-primary text-sm" onClick={() => void handleNameSave()}>Save</button>
          </div>
        ) : (
          <h2
            className="text-xl font-bold text-gray-100 cursor-pointer hover:text-blue-400"
            onClick={() => { setEditingName(true); setNameInput(team.name); }}
          >
            {team.name}
          </h2>
        )}
      </div>

      {/* Archetype Tags */}
      <div className="flex flex-wrap gap-2">
        {ARCHETYPES.map((arch) => (
          <button
            key={arch}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              team.archetype.includes(arch)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
            onClick={() => void handleArchetypeToggle(arch)}
          >
            {arch}
          </button>
        ))}
      </div>

      {/* Pokemon Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {team.members.map((member) => {
          const pokemon = pokemonMap.get(member.pokemonId);
          if (!pokemon || loading) {
            return (
              <div key={member.id} className="card animate-pulse">
                <div className="h-20 bg-gray-700 rounded" />
              </div>
            );
          }
          return (
            <PokemonSlot
              key={member.id}
              member={member}
              pokemon={pokemon}
              onEdit={() => setEditingMemberId(member.id)}
              onRemove={() => void handleRemoveMember(member.id)}
            />
          );
        })}
        {team.members.length < 6 && (
          <button
            className="card flex items-center justify-center min-h-[120px] border-dashed border-gray-600 hover:border-blue-500 hover:bg-gray-750 transition-colors"
            onClick={() => setAddingNew(true)}
          >
            <span className="text-3xl text-gray-500">+</span>
          </button>
        )}
      </div>

      {/* Analysis Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-gray-800 text-blue-400 border border-gray-700 border-b-transparent'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Content */}
      <div className="card">
        {activeTab === 'synergy' && <SynergyView members={team.members} />}
        {activeTab === 'speed' && <SpeedTierView members={team.members} />}
        {activeTab === 'roles' && <RoleCoverageView members={team.members} />}
      </div>

      {/* Pokemon Editor Modal */}
      {(editingMemberId || addingNew) && (
        <PokemonEditor
          teamId={teamId}
          member={editingMember}
          pokemonData={editingPokemon}
          onClose={() => {
            setEditingMemberId(null);
            setAddingNew(false);
          }}
        />
      )}
    </div>
  );
}
