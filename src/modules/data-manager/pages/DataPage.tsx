export default function DataPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Data & Settings</h2>
      <div className="grid grid-cols-1 gap-4">
        <div className="card">
          <h3 className="font-semibold text-lg mb-2">🎮 Regulation</h3>
          <p className="text-gray-400">Select and manage format regulation configs.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold text-lg mb-2">📦 Pokédex Data</h3>
          <p className="text-gray-400">Manage cached Pokémon, moves, and abilities.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold text-lg mb-2">📈 Usage Stats Import</h3>
          <p className="text-gray-400">Import competitive usage stats from CSV.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold text-lg mb-2">💾 Backup & Restore</h3>
          <p className="text-gray-400">Export/import all app data.</p>
        </div>
      </div>
    </div>
  );
}
