import { useState, useEffect } from 'react';
import { useBattleLogStore } from '@/stores/battle-log-store';

interface PatternTrackerProps {
  teamId?: string;
}

const ACTIONABLE_ADVICE: Record<string, string> = {
  'mispredicted-protect': 'Consider being more patient with attacks when opponent is in a Protect-likely position.',
  'bad-lead': 'Review your lead choices against common team archetypes.',
  'wrong-bring-4': 'Take more time in Team Preview to identify threats.',
  'lost-speed-control': 'Prioritize maintaining speed control — consider leading with your speed setter.',
  'mispredicted-switch': 'Pay attention to opponent switching patterns — note what they protect when.',
  'misplayed-endgame': 'Practice counting remaining KOs and positioning for 2v1 or 2v2 endgames.',
  'opponent-outplayed': 'Focus on one read per turn rather than going for too many predictions.',
};

export default function PatternTracker({ teamId }: PatternTrackerProps) {
  const { logs, loadLogs, getPatterns, getRecentLogs } = useBattleLogStore();
  const [sampleSize, setSampleSize] = useState(20);

  useEffect(() => {
    loadLogs(teamId);
  }, [teamId, loadLogs]);

  const patterns = getPatterns(sampleSize);
  const recentLogs = getRecentLogs(sampleSize);
  const wins = recentLogs.filter((l) => l.result === 'win').length;
  const losses = recentLogs.filter((l) => l.result === 'loss').length;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Sort patterns by frequency
  const sortedPatterns = Array.from(patterns.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedPatterns.length > 0 ? sortedPatterns[0][1] : 1;
  const topPatterns = sortedPatterns.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Win/Loss Ratio */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-3">Win/Loss Ratio</h3>
        {total === 0 ? (
          <p className="text-gray-500 text-sm">No battles logged yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Last {sampleSize} games</span>
              <span className="font-bold text-gray-100">{winRate}% win rate</span>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
              <div
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${winRate}%` }}
              />
              <div
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${100 - winRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span className="text-green-400">{wins}W</span>
              <span className="text-red-400">{losses}L</span>
            </div>
          </div>
        )}
      </div>

      {/* Sample Size Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Analyze last:</span>
        {[10, 20, 50].map((n) => (
          <button
            key={n}
            onClick={() => setSampleSize(n)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              sampleSize === n
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Top Mistakes with Advice */}
      {topPatterns.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold text-gray-100 mb-3">Top Recurring Mistakes</h3>
          <div className="space-y-3">
            {topPatterns.map(([tag, count], index) => (
              <div key={tag} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-400 w-5">#{index + 1}</span>
                  <span className="text-sm text-gray-200 font-medium">{tag}</span>
                  <span className="text-xs text-gray-500">({count}x in losses)</span>
                </div>
                {ACTIONABLE_ADVICE[tag] && (
                  <p className="text-xs text-gray-400 ml-7 italic">
                    💡 {ACTIONABLE_ADVICE[tag]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pattern Bar Chart */}
      {sortedPatterns.length > 0 ? (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold text-gray-100 mb-3">Tag Frequency (Losses)</h3>
          <div className="space-y-2">
            {sortedPatterns.map(([tag, count]) => (
              <div key={tag} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{tag}</span>
                  <span className="text-gray-500">{count}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-500 text-sm text-center">
            {logs.length === 0
              ? 'Log some battles to see patterns emerge.'
              : 'No tagged losses in this sample. Keep it up!'}
          </p>
        </div>
      )}
    </div>
  );
}
