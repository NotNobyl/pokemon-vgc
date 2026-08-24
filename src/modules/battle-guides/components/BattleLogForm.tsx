import { useState, useEffect } from 'react';
import type { TeamMember } from '@/types/team';
import type { BattleLog } from '@/types/battle-log';
import { COMMON_TAGS } from '@/types/battle-log';
import { useBattleLogStore } from '@/stores/battle-log-store';

interface BattleLogFormProps {
  teamId: string;
  teamMembers: TeamMember[];
}

export default function BattleLogForm({ teamId, teamMembers }: BattleLogFormProps) {
  const { addLog, deleteLog, loadLogs, getRecentLogs, loading } = useBattleLogStore();

  const [result, setResult] = useState<'win' | 'loss'>('win');
  const [brought, setBrought] = useState<string[]>([]);
  const [noteRight, setNoteRight] = useState('');
  const [noteWrong, setNoteWrong] = useState('');
  const [noteKey, setNoteKey] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

  useEffect(() => {
    loadLogs(teamId);
  }, [teamId, loadLogs]);

  const recentLogs = getRecentLogs(10);

  function handleBroughtToggle(memberId: string) {
    setBrought((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      if (prev.length >= 4) return prev;
      return [...prev, memberId];
    });
  }

  function handleTagToggle(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleAddCustomTag() {
    const trimmed = customTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
      setCustomTag('');
    }
  }

  async function handleSave() {
    const notes: string[] = [];
    if (noteRight.trim()) notes.push(noteRight.trim());
    if (noteWrong.trim()) notes.push(noteWrong.trim());
    if (noteKey.trim()) notes.push(noteKey.trim());

    const log: BattleLog = {
      id: crypto.randomUUID(),
      teamId,
      date: Date.now(),
      result,
      brought,
      notes,
      tags: selectedTags,
    };

    await addLog(log);

    // Reset form
    setResult('win');
    setBrought([]);
    setNoteRight('');
    setNoteWrong('');
    setNoteKey('');
    setSelectedTags([]);
    setCustomTag('');
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <h3 className="font-semibold text-gray-100 text-lg">Quick Battle Log</h3>

        {/* Result */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Result</label>
          <div className="flex gap-2">
            <button
              onClick={() => setResult('win')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                result === 'win'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Win
            </button>
            <button
              onClick={() => setResult('loss')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                result === 'loss'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Loss
            </button>
          </div>
        </div>

        {/* Brought */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">
            Brought ({brought.length}/4)
          </label>
          <div className="flex flex-wrap gap-2">
            {teamMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => handleBroughtToggle(member.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  brought.includes(member.id)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } ${brought.length >= 4 && !brought.includes(member.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={brought.length >= 4 && !brought.includes(member.id)}
              >
                {member.nickname ?? `#${member.pokemonId}`}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400 block">Notes</label>
          <input
            type="text"
            placeholder="What went right?"
            value={noteRight}
            onChange={(e) => setNoteRight(e.target.value)}
            className="w-full bg-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="What went wrong?"
            value={noteWrong}
            onChange={(e) => setNoteWrong(e.target.value)}
            className="w-full bg-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Key moment"
            value={noteKey}
            onChange={(e) => setNoteKey(e.target.value)}
            className="w-full bg-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COMMON_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Custom tag..."
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomTag(); }}
              className="flex-1 bg-gray-700 text-gray-100 rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleAddCustomTag}
              className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
        >
          Save Battle Log
        </button>
      </div>

      {/* Recent Logs */}
      <div>
        <h3 className="font-semibold text-gray-100 text-lg mb-3">Recent Battles</h3>
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && recentLogs.length === 0 && (
          <p className="text-gray-500 text-sm">No battle logs yet. Record your first match above!</p>
        )}
        <div className="space-y-2">
          {recentLogs.map((log) => (
            <div key={log.id} className="bg-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      log.result === 'win'
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-red-600/20 text-red-400'
                    }`}
                  >
                    {log.result}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(log.date)}</span>
                </div>
                <button
                  onClick={() => deleteLog(log.id)}
                  className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                  aria-label="Delete log"
                >
                  ✕
                </button>
              </div>
              {log.brought.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {log.brought.map((memberId) => {
                    const member = teamMembers.find((m) => m.id === memberId);
                    return (
                      <span key={memberId} className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                        {member?.nickname ?? `#${memberId.slice(0, 4)}`}
                      </span>
                    );
                  })}
                </div>
              )}
              {log.notes.length > 0 && (
                <div className="text-xs text-gray-400 space-y-0.5">
                  {log.notes.map((note, i) => (
                    <p key={i}>• {note}</p>
                  ))}
                </div>
              )}
              {log.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {log.tags.map((tag) => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
