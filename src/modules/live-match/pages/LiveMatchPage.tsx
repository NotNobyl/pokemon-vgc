import { useEffect, useMemo, useState } from 'react';
import type { Pokemon, PokemonType } from '@/types/pokemon';
import type { Team } from '@/types/team';
import type { OpponentEntry } from '@/types/live-match';
import { useTeamStore } from '@/stores/team-store';
import { useLiveMatchStore } from '@/stores/live-match-store';
import { getAllPokemon, getPokemonById, searchPokemon } from '@/db/pokemon-cache';
import { recommendBring4 } from '@/engine/matchup-lab';
import { getEffectiveness } from '@/engine/type-chart';
import { canonicalize } from '@/data/sources/showdown-mapping';
import LiveTurnTracker from '../components/LiveTurnTracker';

/** Live Match: matchmake -> scout opponent -> bring-4 -> live tracker -> finish. */
export default function LiveMatchPage() {
  const { teams, loadTeams } = useTeamStore();
  const {
    active,
    loadActive,
    startMatch,
    setOpponents,
    setRecommendation,
    setMyBring4,
    setPhase,
    cancel,
  } = useLiveMatchStore();

  const [oppQuery, setOppQuery] = useState('');
  const [oppResults, setOppResults] = useState<Pokemon[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [typeCache, setTypeCache] = useState<Map<string, PokemonType[]>>(new Map());
  const [myMemberTypes, setMyMemberTypes] = useState<
    { teamMemberId: string; name: string; types: string[] }[]
  >([]);

  useEffect(() => {
    void loadTeams();
    void loadActive();
  }, [loadTeams, loadActive]);

  // Warm a name->types cache from the dex for bring-4 scoring.
  useEffect(() => {
    let cancelled = false;
    void getAllPokemon().then((all) => {
      if (cancelled) return;
      const map = new Map<string, PokemonType[]>();
      for (const p of all) map.set(canonicalize(p.name), p.types);
      setTypeCache(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTeam: Team | undefined = teams.find((t) => t.id === active?.teamId);

  // Resolve my team members' types once a team is active.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activeTeam) {
        setMyMemberTypes([]);
        return;
      }
      const rows: { teamMemberId: string; name: string; types: string[] }[] = [];
      for (const m of activeTeam.members) {
        const p = await getPokemonById(m.pokemonId);
        if (p) rows.push({ teamMemberId: m.id, name: p.name, types: p.types });
      }
      if (!cancelled) setMyMemberTypes(rows);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTeam]);

  const handleOppSearch = async (q: string) => {
    setOppQuery(q);
    if (q.length >= 2) setOppResults(await searchPokemon(q, 8));
    else setOppResults([]);
  };

  const addOpp = (name: string) => {
    if (roster.length >= 6 || roster.includes(name)) return;
    setRoster((r) => [...r, name]);
    setOppQuery('');
    setOppResults([]);
  };

  const bring4 = useMemo(() => {
    if (!active || myMemberTypes.length === 0 || active.opponents.length === 0) {
      return null;
    }
    const oppTypes = active.opponents.map(
      (o) => typeCache.get(canonicalize(o.name)) ?? [],
    );
    return recommendBring4(myMemberTypes, oppTypes, (atk, def) =>
      getEffectiveness(atk as PokemonType, def as [PokemonType] | [PokemonType, PokemonType]),
    );
  }, [active, myMemberTypes, typeCache]);

  // Persist the recommendation when it computes.
  useEffect(() => {
    if (bring4 && active && active.recommendedBring4.length === 0) {
      const top4 = bring4.ordered.slice(0, 4).map((x) => x.teamMemberId);
      void setRecommendation(top4, top4.slice(0, 2));
    }
  }, [bring4, active, setRecommendation]);

  // ---- Render by phase ----

  if (!active) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Live Match</h2>
        <div className="card">
          <h3 className="font-semibold mb-2">Start a match</h3>
          <p className="text-gray-400 text-sm mb-3">
            Pick the team you're laddering with. Then scout your opponent's
            Team Preview and get a recommended bring-4.
          </p>
          {teams.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No teams yet — build one in the Teams tab first.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teams.map((t) => (
                <button
                  key={t.id}
                  className="btn-secondary text-left"
                  onClick={() => void startMatch(t.id, t.regulationId)}
                >
                  {t.name}{' '}
                  <span className="text-gray-400 text-xs">
                    ({t.members.length}/6)
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Live Match</h2>
        <button className="text-sm text-red-400 hover:text-red-300" onClick={() => void cancel()}>
          Cancel match
        </button>
      </div>

      <div className="text-sm text-gray-400">
        Playing: <span className="text-gray-200">{activeTeam?.name ?? '—'}</span>
        {' · '}Phase: <span className="text-gray-200 capitalize">{active.phase}</span>
      </div>

      {/* SETUP: scout opponent 6 */}
      {active.phase === 'setup' && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Scout opponent (Team Preview)</h3>
          <div className="relative">
            <input
              className="input w-full"
              placeholder="Add opponent Pokémon (up to 6)…"
              value={oppQuery}
              onChange={(e) => void handleOppSearch(e.target.value)}
              disabled={roster.length >= 6}
            />
            {oppResults.length > 0 && (
              <div className="absolute z-10 w-full bg-gray-700 rounded-lg max-h-48 overflow-y-auto mt-1">
                {oppResults.map((p) => (
                  <button
                    key={p.id}
                    className="w-full px-3 py-2 text-left hover:bg-gray-600 capitalize"
                    onClick={() => addOpp(p.name)}
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
            <div className="flex flex-wrap gap-2">
              {roster.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 bg-gray-700 rounded-full px-3 py-1 text-sm capitalize"
                >
                  {name}
                  <button
                    className="text-gray-400 hover:text-red-400"
                    onClick={() => setRoster((r) => r.filter((n) => n !== name))}
                    aria-label={`Remove ${name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <button
            className="btn-primary"
            disabled={roster.length === 0}
            onClick={() => {
              const opponents: OpponentEntry[] = roster.map((name) => ({
                name,
                showdownId: canonicalize(name),
                revealed: { moves: [] },
              }));
              void setOpponents(opponents);
            }}
          >
            Get bring-4 recommendation
          </button>
        </div>
      )}

      {/* BRING4: recommendation */}
      {active.phase === 'bring4' && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Recommended bring-4</h3>
          <p className="text-xs text-gray-500">
            Heuristic, by offensive type coverage vs their roster. Adjust for your
            game plan.
          </p>
          {bring4 ? (
            <ol className="space-y-1">
              {bring4.ordered.map((b, i) => (
                <li
                  key={b.teamMemberId}
                  className={`flex items-center gap-3 py-1 capitalize ${i < 4 ? '' : 'opacity-50'}`}
                >
                  <span className="text-gray-500 w-5 text-right text-sm">{i + 1}</span>
                  <span className="flex-1">
                    {i < 4 && <span className="text-green-400">✓ </span>}
                    {b.name}
                  </span>
                  <span className="text-xs text-gray-400">{b.score.toFixed(1)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-400 text-sm">Computing…</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              className="btn-primary"
              onClick={() => {
                // Default my bring-4 to the recommendation, then go live.
                if (active.myBring4.length === 0) {
                  void setMyBring4(active.recommendedBring4);
                }
                void setPhase('live');
              }}
            >
              Start turn tracker
            </button>
            <button className="btn-secondary" onClick={() => void setPhase('setup')}>
              Edit opponents
            </button>
          </div>
        </div>
      )}

      {/* LIVE + FINISH handled by the turn tracker component (Slice B/C) */}
      {(active.phase === 'live' || active.phase === 'finished') && (
        <LiveTurnTracker />
      )}
    </div>
  );
}
