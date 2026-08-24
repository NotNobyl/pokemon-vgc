import { useState, useMemo } from 'react';
import glossaryData from '@/data/glossary.json';

interface GlossaryEntry {
  term: string;
  definition: string;
  category: string;
}

const entries = glossaryData as GlossaryEntry[];

export default function Glossary() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(entries.map((e) => e.category));
    return ['all', ...Array.from(cats).sort()];
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        search === '' ||
        entry.term.toLowerCase().includes(search.toLowerCase()) ||
        entry.definition.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [search, categoryFilter]);

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Search terms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">No terms match your search.</p>
        )}
        {filtered.map((entry) => (
          <div key={entry.term} className="bg-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedTerm(expandedTerm === entry.term ? null : entry.term)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-100 font-medium text-sm">{entry.term}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400 capitalize">
                  {entry.category}
                </span>
              </div>
              <span className="text-gray-500 text-xs">
                {expandedTerm === entry.term ? '▼' : '▶'}
              </span>
            </button>
            {expandedTerm === entry.term && (
              <div className="px-3 pb-3 text-sm text-gray-300 border-t border-gray-700 pt-2">
                {entry.definition}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
