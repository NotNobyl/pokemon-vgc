import { useState, useEffect } from 'react';
import type { Team } from '@/types/team';
import type { OpponentTeam } from '@/types/matchup';
import { useTeamStore } from '@/stores/team-store';
import { useMatchupStore } from '@/stores/matchup-store';
import DamageCalc from '../components/DamageCalc';
import ThreatReport from '../components/ThreatReport';
import MoveAdvisorPanel from '../components/MoveAdvisorPanel';
import ScoutingLog from '../components/ScoutingLog';
import MatchupLab from '../components/MatchupLab';

type Tab = 'matchup-lab' | 'damage-calc' | 'threat-report' | 'move-advisor' | 'scouting-log';

const TABS: { id: Tab; label: string }[] = [
  { id: 'matchup-lab', label: 'Matchup Lab' },
  { id: 'damage-calc', label: 'Damage Calc' },
  { id: 'threat-report', label: 'Threat Report' },
  { id: 'move-advisor', label: 'Move Advisor' },
  { id: 'scouting-log', label: 'Scouting Log' },
];

export default function MatchupPage() {
  const [activeTab, setActiveTab] = useState<Tab>('matchup-lab');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState<string>('');
  const { teams, loadTeams } = useTeamStore();
  const { scoutingLog, loadScoutingLog } = useMatchupStore();

  useEffect(() => {
    void loadTeams();
    void loadScoutingLog();
  }, [loadTeams, loadScoutingLog]);

  const selectedTeam: Team | undefined = teams.find((t) => t.id === selectedTeamId);
  const selectedOpponentTeam: OpponentTeam | undefined = scoutingLog.find((t) => t.id === selectedOpponentTeamId);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Matchup Tool</h2>

      {/* Team selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-400">My Team</label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          >
            <option value="">Select a team...</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
        {(activeTab === 'move-advisor') && (
          <div className="flex-1">
            <label className="text-xs text-gray-400">Opponent Team (from Scouting Log)</label>
            <select
              value={selectedOpponentTeamId}
              onChange={(e) => setSelectedOpponentTeamId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="">Select opponent team...</option>
              {scoutingLog.map((team) => (
                <option key={team.id} value={team.id}>{team.name}{team.playerName ? ` (${team.playerName})` : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'matchup-lab' && (
          <MatchupLab myTeam={selectedTeam} />
        )}
        {activeTab === 'damage-calc' && (
          <DamageCalc myTeam={selectedTeam} />
        )}
        {activeTab === 'threat-report' && (
          selectedTeam ? (
            <ThreatReport myTeam={selectedTeam} />
          ) : (
            <div className="card">
              <p className="text-gray-400">Select a team above to generate a threat report.</p>
            </div>
          )
        )}
        {activeTab === 'move-advisor' && (
          selectedTeam ? (
            <MoveAdvisorPanel myTeam={selectedTeam} opponentTeam={selectedOpponentTeam} />
          ) : (
            <div className="card">
              <p className="text-gray-400">Select a team above to use the Move Advisor.</p>
            </div>
          )
        )}
        {activeTab === 'scouting-log' && (
          <ScoutingLog />
        )}
      </div>
    </div>
  );
}
