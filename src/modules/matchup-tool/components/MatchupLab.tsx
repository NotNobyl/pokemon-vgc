import { useEffect, useMemo, useState } from 'react';
import type { Pokemon, PokemonType } from '@/types/pokemon';
import type { Team } from '@/types/team';
import type { PokemonUsage, StatPoints } from '@/types/usage';
import { getAllPokemon, getPokemonById, searchPokemon } from '@/db/pokemon-cache';
import { getUsageForShowdownId, useUsageStore } from '@/stores/usage-store';
import { candidateKeys } from '@/data/sources/showdown-mapping';
import { buildMatchupReport, type MatchupReport } from '@/engine/matchup-lab';
import { getEffectiveness } from '@/engine/type-chart';

interface MatchupLabProps {
  myTeam?: Team;
}

function fmtSpread(sp: StatPoints | null): string {
  if (!sp) return '—';
  return `HP ${sp.hp}/Atk ${sp.attack}/Def ${sp.defense}/SpA ${sp.spAttack}/SpD ${sp.spDefense}/Spe ${sp.speed}`;
}
function pct(n: number | null): string {
  return n == null ? '—' : `${n.toFixed(1)}%`;
}

export default function MatchupLab({ myTeam }: MatchupLabProps) {
  const season = useUsageStore((s) => s.season);
  const attribution = useUsageStore((s) => s.attribution);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Pokemon[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [usageMap, setUsageMap] = useState<Map<string, PokemonUsage>>(new Map());
  const [report, setReport] = useState<MatchupReport | null>(null);
  const [myTeamTypes, setMyTeamTypes] = useState<
    { name: string; types: PokemonType[] }[]
  >([]);

  // Load my team's types for the bring-4 coverage calc.
  useEffect(() => {
    void warmOpponentTypeCache();
    let cancelled = false;
    async function load() {
      if (!myTeam) {
        setMyTeamTypes([]);
        return;
      }
      const rows: { name: string; types: PokemonType[] }[] = [];
      for (const m of myTeam.members) {
        const p = await getPokemonById(m.pokemonId);
        if (p) rows.push({ name: p.name, types: p.types });
      }
      if (!cancelled) setMyTeamTypes(rows);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [myTeam]);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length >= 2) setResults(await searchPokemon(q, 8));
    else setResults([]);
  };

  const addToRoster = async (name: string) => {
    if (roster.length >= 6 || roster.includes(name)) return;
    setRoster((r) => [...r, name]);
    setQuery('');
    setResults([]);
    // Resolve + cache usage for this species now.
    let found: PokemonUsage | undefined;
    for (const key of candidateKeys(name)) {
      found = await getUsageForShowdownId(key);
      if (found) break;
    }
    if (found) {
      setUsageMap((m) => new Map(m).set(canonical(name), found!));
    }
  };

  const removeFromRoster = (name: string) => {
    setRoster((r) => r.filter((n) => n !== name));
  };

  const generate = () => {
    const resolve = (name: string) => usageMap.get(canonical(name));
    setReport(buildMatchupReport(roster, resolve));
  };

  // Bring-4 recommendation: score my mons by offensive coverage vs opponent
  // types (uses cached opponent species types resolved from the report).
  const bring4 = useMemo(() => {
    if (!report || myTeamTypes.length === 0) return null;
    return recommendBring4(myTeamTypes, report);
  }, [report, myTeamTypes]);

  return (
    <div className="space-y-4">
      {/* Roster input */}
      <div className="card">
        <h3 className="font-semibold mb-2">Opponent roster (Team Preview)</h3>
        <div className="relative">
          <input
            className="input w-full"
            placeholder="Search opponent Pokémon… (add up to 6)"
            value={query}
            onChange={(e) => void handleSearch(e.target.value)}
            disabled={roster.length >= 6}
          />
          {results.length > 0 && (
            <div className="absolute z-10 w-full bg-gray-700 rounded-lg max-h-48 overflow-y-auto mt-1">
              {results.map((p) => (
                <button
                  key={p.id}
                  className="w-full px-3 py-2 text-left hover:bg-gray-600 capitalize"
                  onClick={() => void addToRoster(p.name)}
                >
                  {p.name}
                  <span className="text-gray-400 text-sm ml-2">
                    {p.types.join(' / ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {roster.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {roster.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1 text-sm capitalize"
              >
                {name}
                <button
                  className="text-gray-400 hover:text-red-400"
                  onClick={() => removeFromRoster(name)}
                  aria-label={`Remove ${name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          className="btn-primary mt-3"
          onClick={generate}
          disabled={roster.length === 0}
        >
          Analyze matchup
        </button>
      </div>

      {report && (
        <>
          {/* Summary */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Scouting report</h3>
              <span
                className={`text-xs ${
                  report.coverage >= 0.8
                    ? 'text-green-400'
                    : report.coverage >= 0.5
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {Math.round(report.coverage * 100)}% data coverage
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">Likely archetype: </span>
              {report.likelyArchetypes.join(', ')}
            </div>
            {report.likelyLeads.length > 0 && (
              <div className="text-sm capitalize">
                <span className="text-gray-400">Likely leads: </span>
                {report.likelyLeads.join(' + ')}
              </div>
            )}
            <ul className="mt-2 space-y-1">
              {report.scoutingNotes.map((n, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2">
                  <span className="text-blue-400">•</span>
                  {n}
                </li>
              ))}
            </ul>
          </div>

          {/* Bring-4 */}
          {bring4 && (
            <div className="card">
              <h3 className="font-semibold mb-1">Recommended bring-4</h3>
              <p className="text-xs text-gray-500 mb-2">
                Scored by offensive type coverage vs this roster. Heuristic —
                adjust for your game plan.
              </p>
              <ol className="space-y-1">
                {bring4.map((b, i) => (
                  <li
                    key={b.name}
                    className={`flex items-center gap-3 py-1 capitalize ${
                      i < 4 ? '' : 'opacity-50'
                    }`}
                  >
                    <span className="text-gray-500 w-5 text-right text-sm">
                      {i + 1}
                    </span>
                    <span className="flex-1">
                      {i < 4 && <span className="text-green-400">✓ </span>}
                      {b.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      coverage {b.score.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-gray-500 mt-2">
                Top 4 marked ✓. Leave the rest unless your plan needs them.
              </p>
            </div>
          )}

          {/* Likely sets */}
          <div className="space-y-3">
            {report.opponents.map((o) => (
              <div key={o.displayName} className="card">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold capitalize">{o.displayName}</h4>
                  {!o.hasData && (
                    <span className="text-xs text-red-400">no data — unknown set</span>
                  )}
                </div>
                {o.hasData && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
                    <SetLine
                      label="Moves"
                      items={o.topMoves.map((m) => `${m.name} (${pct(m.probability)})`)}
                    />
                    <SetLine
                      label="Items"
                      items={o.topItems.map((m) => `${m.name} (${pct(m.probability)})`)}
                    />
                    <SetLine
                      label="Abilities"
                      items={o.topAbilities.map((m) => `${m.name} (${pct(m.probability)})`)}
                    />
                    <SetLine
                      label="Natures"
                      items={o.topNatures.map((m) => `${m.name} (${pct(m.probability)})`)}
                    />
                    <SetLine
                      label="Spreads"
                      items={o.topSpreads.map(
                        (s) => `${fmtSpread(s.spread)} (${pct(s.probability)})`,
                      )}
                    />
                    <SetLine label="Teammates" items={o.topTeammates} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500">
            Likely sets are observed usage, not guarantees. {attribution} · {season ?? 'Current'}.
          </p>
        </>
      )}
    </div>
  );
}

function SetLine({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-gray-200 capitalize">{items.join(', ')}</div>
    </div>
  );
}

function canonical(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface Bring4Entry {
  name: string;
  score: number;
}

/**
 * Score each of my Pokémon by how much super-effective offensive pressure its
 * STAB types apply across the opponent roster. Pure heuristic using the type
 * chart; opponent types are looked up from the cached dex by name.
 */
function recommendBring4(
  myTeam: { name: string; types: PokemonType[] }[],
  report: MatchupReport,
): Bring4Entry[] {
  // Resolve opponent types from the cached dex (best-effort, sync-safe via a
  // module-level cache populated once). Falls back to neutral if unknown.
  const oppTypes = report.opponents.map((o) => opponentTypeCache.get(canonical(o.displayName)) ?? []);

  const scored = myTeam.map((mon) => {
    let score = 0;
    for (const atkType of mon.types) {
      for (const defTypes of oppTypes) {
        if (defTypes.length === 0) continue;
        const eff = getEffectiveness(atkType, defTypes as [PokemonType] | [PokemonType, PokemonType]);
        // Reward super-effective, mild credit for neutral, penalize resisted.
        score += eff >= 2 ? 2 : eff === 1 ? 0.5 : eff > 0 ? -0.5 : -1;
      }
    }
    return { name: mon.name, score };
  });
  return scored.sort((a, b) => b.score - a.score);
}

/** Module-level cache of opponent species -> types, filled by the component. */
const opponentTypeCache = new Map<string, PokemonType[]>();

/** Populate the opponent type cache from the full dex once. */
export async function warmOpponentTypeCache(): Promise<void> {
  if (opponentTypeCache.size > 0) return;
  const all = await getAllPokemon();
  for (const p of all) {
    opponentTypeCache.set(canonical(p.name), p.types);
  }
}
