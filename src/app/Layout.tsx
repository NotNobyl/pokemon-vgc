import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { DataSeeder } from '@/shared/components/DataSeeder';

/** Primary tabs stay in the bottom bar (daily-use). */
const primaryNav = [
  { to: '/teams', label: 'Teams', icon: '⚔️' },
  { to: '/live', label: 'Live', icon: '🔴' },
  { to: '/matchup', label: 'Matchup', icon: '🎯' },
  { to: '/lab', label: 'Lab', icon: '🧪' },
];

/** Secondary tabs live behind the "More" menu to keep the bar uncluttered. */
const moreNav = [
  { to: '/meta', label: 'Meta', icon: '📊' },
  { to: '/guides', label: 'Guides', icon: '📖' },
  { to: '/data', label: 'Data', icon: '⚙️' },
];

export function Layout() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">VGC Companion</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <DataSeeder />
        <Outlet />
      </main>

      {/* More menu (slide-up sheet) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 bg-gray-800 border-t border-gray-700 p-4 pb-6 safe-bottom rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-3">
              {moreNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-3 rounded-lg transition-colors ${
                      isActive ? 'text-blue-400 bg-gray-700' : 'text-gray-300 hover:bg-gray-700'
                    }`
                  }
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bg-gray-800 border-t border-gray-700 flex justify-around py-2 px-2 safe-bottom">
        {primaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center px-3 py-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-gray-200'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs mt-0.5">{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={`flex flex-col items-center px-3 py-1 rounded-lg transition-colors ${
            moreOpen ? 'text-blue-400 bg-gray-700' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="More"
          aria-expanded={moreOpen}
        >
          <span className="text-xl">⋯</span>
          <span className="text-xs mt-0.5">More</span>
        </button>
      </nav>
    </div>
  );
}
