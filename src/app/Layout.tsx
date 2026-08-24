import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/teams', label: 'Teams', icon: '⚔️' },
  { to: '/matchup', label: 'Matchup', icon: '🎯' },
  { to: '/guides', label: 'Guides', icon: '📖' },
  { to: '/data', label: 'Data', icon: '⚙️' },
];

export function Layout() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">VGC Companion</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-gray-800 border-t border-gray-700 flex justify-around py-2 px-2 safe-bottom">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center px-3 py-1 rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-400 bg-gray-700'
                  : 'text-gray-400 hover:text-gray-200'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs mt-0.5">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
