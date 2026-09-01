import { useEffect, useMemo, useState } from 'react';
import { useBattleLogStore } from '@/stores/battle-log-store';
import { useTeamStore } from '@/stores/team-store';
import {
  computePersonalReport,
  patternWarrantsChange,
  type RecordStat,
} from '@/engine/personal-stats';

/**
 * Personal match-history analytics: win-rate by team and by lead, with
 * shrinkage + minimum-sample handling so tiny hot/cold streaks don't mislead.
 * All figures are OBSERVED (personal) — never blended with global usage stats.
 */
export default function PersonalStats() {
  const { logs, loadLogs } = useBattleLogStore();
  const { teams, loadTeams } = useTeamStore();
  const [minSample, setMinSample] = useState(5);

  useEffect(() => {
    void loadLogs();
    void loadTeams();
  }, [loadLogs, loadTeams]);

  const teamName = useMemo(() => {
    const map = new Map(teams.map((t) => [t.id, t.name]));
    return (id: string) => map.get(id) ?? 'Unknown team';
  }, [teams]);

  const report = useMemo(
    () => computePersonalReport(logs, teamName, minSample),
    [logs, teamName, minSample],
  );

  if (report.totalGames === 0) {
    return (
      <div className="card text-gray-400 text-sm">
        No battles logged yet. Finish a game in <strong>Live Match</strong> (or
        the Battle Log tab) and your personal win rates will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Overall</h3>
          <span className="text-sm text-gray-300">
            {report.wins}W – {report.losses}L ({Math.round(report.overallWinRate * 100)}%)
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Observed from your logged games only. Win rates below are
          shrinkage-adjusted so small samples aren't over-trusted.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-gray-400">Reliable after:</span>
          {[3, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setMinSample(n)}
              className={`px-2 py-0.5 rounded text-xs ${
                minSample === n ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {n} games
            </button>
          ))}
        </div>
      </div>

      <StatList title="By team" rows={report.byTeam} />
      <StatList title="By lead pair" rows={report.byLead} />

      {report.lossPatterns.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-2">Recurring loss patterns</h3>
          <ul className="space-y-1">
            {report.lossPatterns.map((p) => (
              <li key={p.tag} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{p.tag}</span>
                <span className="text-gray-400">{p.count}×</span>
                {patternWarrantsChange(p.count) && (
                  <span className="text-[11px] text-yellow-400">worth addressing</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-2">
            A pattern is flagged "worth addressing" only after 3+ losses — one or
            two losses aren't enough to change a team.
          </p>
        </div>
      )}
    </div>
  );
}

function StatList({ title, rows }: { title: string; rows: RecordStat[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="card">
      <h3 className="font-semibold mb-2">{title}</h3>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="flex-1 capitalize">{r.label}</span>
              <span className="text-gray-300">
                {r.wins}W–{r.losses}L
              </span>
              <span className="w-12 text-right font-medium">
                {Math.round(r.adjustedWinRate * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${r.adjustedWinRate >= 0.55 ? 'bg-green-500' : r.adjustedWinRate >= 0.45 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${r.adjustedWinRate * 100}%` }}
                />
              </div>
              {!r.reliable && (
                <span className="text-[11px] text-gray-500">
                  provisional ({r.games} games)
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
