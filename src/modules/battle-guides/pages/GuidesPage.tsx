import { useState, useEffect } from 'react';
import { useTeamStore } from '@/stores/team-store';
import TeamGuide from '../components/TeamGuide';
import BattleLogForm from '../components/BattleLogForm';
import PatternTracker from '../components/PatternTracker';
import PreBattleChecklist from '../components/PreBattleChecklist';
import Glossary from '../components/Glossary';

type Tab = 'guide' | 'log' | 'patterns' | 'checklist' | 'glossary';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'guide', label: 'Team Guide', icon: '📖' },
  { id: 'log', label: 'Battle Log', icon: '📝' },
  { id: 'patterns', label: 'Patterns', icon: '📊' },
  { id: 'checklist', label: 'Checklist', icon: '☑️' },
  { id: 'glossary', label: 'Glossary', icon: '📚' },
];

export default function GuidesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('guide');
  const { teams, loadTeams } = useTeamStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const showTeamSelector = activeTab === 'guide' || activeTab === 'log' || activeTab === 'patterns';

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-100">Battle Guides & Learning</h2>

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto gap-1 pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Team Selector */}
      {showTeamSelector && (
        <div>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full bg-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {teams.length === 0 && <option value="">No teams available</option>}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.members.length} members)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tab Content */}
      <div>
        {activeTab === 'guide' && (
          selectedTeam ? (
            <TeamGuide team={selectedTeam} />
          ) : (
            <div className="text-gray-500 text-center py-8">Select or create a team to see its guide.</div>
          )
        )}

        {activeTab === 'log' && (
          selectedTeam ? (
            <BattleLogForm teamId={selectedTeam.id} teamMembers={selectedTeam.members} />
          ) : (
            <div className="text-gray-500 text-center py-8">Select a team to log battles.</div>
          )
        )}

        {activeTab === 'patterns' && (
          <PatternTracker teamId={selectedTeamId || undefined} />
        )}

        {activeTab === 'checklist' && <PreBattleChecklist />}

        {activeTab === 'glossary' && <Glossary />}
      </div>
    </div>
  );
}
