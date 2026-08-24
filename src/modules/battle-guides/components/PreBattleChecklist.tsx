import { useState } from 'react';

const CHECKLIST_ITEMS = [
  'What is my win condition this game?',
  'Who is their likely lead?',
  'Who outspeeds whom?',
  "What's my bring-4 plan?",
  "What's my backup plan if they lead unexpectedly?",
];

export default function PreBattleChecklist() {
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST_ITEMS.map(() => false));
  const [dismissed, setDismissed] = useState(false);

  function handleToggle(index: number) {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  function handleReset() {
    setChecked(CHECKLIST_ITEMS.map(() => false));
    setDismissed(false);
  }

  const allChecked = checked.every(Boolean);

  if (dismissed) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center space-y-3">
        <p className="text-2xl">⚔️</p>
        <p className="text-gray-100 font-semibold">You're ready! Good luck!</p>
        <button
          onClick={handleReset}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Start new checklist
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="text-center">
        <h3 className="font-semibold text-gray-100 text-lg">⚔️ Pre-Battle Checklist</h3>
        <p className="text-xs text-gray-500 mt-1">Complete before queuing into a ranked match</p>
      </div>

      <div className="space-y-3">
        {CHECKLIST_ITEMS.map((item, index) => (
          <button
            key={index}
            onClick={() => handleToggle(index)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
              checked[index]
                ? 'bg-green-600/10 border border-green-600/30'
                : 'bg-gray-700 hover:bg-gray-650 border border-transparent'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                checked[index]
                  ? 'bg-green-600 border-green-600'
                  : 'border-gray-500'
              }`}
            >
              {checked[index] && (
                <span className="text-white text-sm">✓</span>
              )}
            </div>
            <span className={`text-sm ${checked[index] ? 'text-green-300' : 'text-gray-200'}`}>
              {item}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setDismissed(true)}
        disabled={!allChecked}
        className={`w-full py-3 rounded-lg font-semibold transition-colors ${
          allChecked
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {allChecked ? '🎮 Ready to Battle!' : 'Complete all items first'}
      </button>
    </div>
  );
}
