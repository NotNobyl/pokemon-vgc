import { useEffect, useMemo, useState } from 'react';
import type { PokemonType } from '@/types/pokemon';
import type { Team } from '@/types/team';
import { useTeamStore } from '@/stores/team-store';
import { getAllPokemon, getMovesByNames } from '@/db/pokemon-cache';
import { getAllUsageForFormat } from '@/db/usage-cache';
import { CURRENT_FORMAT, useUsageStore } from '@/stores/usage-store';
import { rankByTeammateCoOccurrence } from '@/engine/meta-aggregator';
import { scoreTeam, type ScorableMember, type TeamScore } from '@/engine/team-score';
import { rankTeams, compareScoredTeams, type ScoredTeam } from '@/engine/team-compare';

type Mode = 'breakdown' | 'compare';

/**
 * Team Intelligence Lab — Slice 3a.
 * Score breakdown for a selected team + Compare Teams, using the versioned,
 * explainable team score model. Meta support is inferred from usage
 * co-occurrence (labeled), never fabricated win rates.
 */
export default function LabPage() {
  const { teams, loadTeams } = useTeamStore();
  const season = useUsageStore((s) => s.season);

  const [mode, setMode] = useState<Mode>('breakdown');
  const [teamId, setTeamId] = useState<string>('');
  const [compareId, setCompareId] = useState<string>('');
  const [scorable, setScorable] = useState<Map<string, ScorableMember[]>>(new Map());
  const [popularity, setPopularity] = useState<Map<string, number>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  // Build the meta popularity lookup (teammate co-occurrence, normalized 0..1).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const records = await getAllUsageForFormat(CURRENT_FORMAT, season ?? 'Current');
      const ranking = rankByTeammateCoOccurrence(records);
      const map = new Map<string, number>();
      for (const entry of ranking) map.set(entry.key, entry.score / 100);
      if (!cancelled) setPopularity(map);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [season]);

  // Resolve all teams' members into scorable form (types + move types).
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (teams.length === 0) {
        setReady(true);
        return;
      }
      const allPokemon = await getAllPokemon();
      const byId = new Map(allPokemon.map((p) => [p.id, p]));
      const result = new Map<string, ScorableMember[]>();

      for (const team of teams) {
        const members: ScorableMember[] = [];
        for (const m of team.members) {
          const p = byId.get(m.pokemonId);
          if (!p) continue;
          const moveRecords = await getMovesByNames(m.moves);
          const moveTypes = moveRecords.map((mv) => mv.type);
          members.push({
            name: p.name,
            types: p.types as PokemonType[],
            moves: m.moves,
            moveTypes,
            ability: m.ability,
            item: m.item,
          });
        }
        result.set(team.id, members);
      }
      if (!cancelled) {
        setScorable(result);
        setReady(true);
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [teams]);

  const metaLookup = useMemo(
    () => ({ popularity: (name: string) => popularity.get(name) ?? null }),
    [popularity],
  );

  const selectedTeam: Team | undefined = teams.find((t) => t.id === teamId);
  const selectedScore: TeamScore | null = useMemo(() => {
    if (!selectedTeam) return null;
    const members = scorable.get(selectedTeam.id);
    if (!members || members.length === 0) return null;
    return scoreTeam(members, undefined, metaLookup);
  }, [selectedTeam, scorable, metaLookup]);

  const ranked: ScoredTeam[] = useMemo(() => {
    return rankTeams(
      teams
        .filter((t) => (scorable.get(t.id)?.length ?? 0) > 0)
        .map((t) => ({ id: t.id, name: t.name, members: scorable.get(t.id)! })),
      undefined,
      metaLookup,
    );
  }, [teams, scorable, metaLookup]);

  const comparison = useMemo(() => {
    if (!teamId || !compareId || teamId === compareId) return null;
    const a = ranked.find((r) => r.id === teamId);
    const b = ranked.find((r) => r.id === compareId);
    if (!a || !b) return null;
    return compareScoredTeams(a, b);
  }, [teamId, compareId, ranked]);

  if (!ready) return <div className="text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Team Intelligence Lab</h2>

      <div className="flex gap-1">
        {(['breakdown', 'compare'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              mode === m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {m === 'breakdown' ? 'Score Breakdown' : 'Compare Teams'}
          </button>
        ))}
      </div>

      {teams.length === 0 ? (
        <div className="card text-gray-400">Build a team first to analyze it here.</div>
      ) : (
        <>
          {/* Team selectors */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="input flex-1"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">Select a team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {mode === 'compare' && (
              <select
                className="input flex-1"
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
              >
                <option value="">Compare with…</option>
                {teams.filter((t) => t.id !== teamId).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Breakdown */}
          {mode === 'breakdown' && selectedScore && (
            <ScoreCard score={selectedScore} season={season} />
          )}

          {/* Compare */}
          {mode === 'compare' && comparison && (
            <div className="card space-y-3">
              <h3 className="font-semibold">{comparison.summary}</h3>
              <div className="space-y-1">
                {comparison.categoryDeltas.map((d) => (
                  <div key={d.key} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{d.label}</span>
                    <span className="text-gray-400 w-10 text-right">{d.a.toFixed(0)}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-gray-200 w-10 text-right">{d.b.toFixed(0)}</span>
                    <span
                      className={`w-14 text-right ${
                        d.delta > 0 ? 'text-green-400' : d.delta < 0 ? 'text-red-400' : 'text-gray-500'
                      }`}
                    >
                      {d.delta > 0 ? '+' : ''}{d.delta.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ranking (always useful) */}
          <div className="card">
            <h3 className="font-semibold mb-2">All teams ranked</h3>
            <p className="text-xs text-gray-500 mb-2">
              Same scoring model applied to every saved team.
            </p>
            <ol className="space-y-1">
              {ranked.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 py-1">
                  <span className="text-gray-500 w-5 text-right text-sm">{i + 1}</span>
                  <button
                    className="flex-1 text-left hover:text-blue-400"
                    onClick={() => { setMode('breakdown'); setTeamId(r.id); }}
                  >
                    {r.name}
                  </button>
                  <span className="text-sm font-medium">{r.score.total.toFixed(0)}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

function ScoreCard({ score, season }: { score: TeamScore; season: string | null }) {
  const confColor =
    score.confidenceLabel === 'high'
      ? 'text-green-400'
      : score.confidenceLabel === 'moderate'
        ? 'text-yellow-400'
        : 'text-red-400';
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-3xl font-bold">{score.total.toFixed(0)}</span>
          <span className="text-gray-400 text-sm"> / 100</span>
        </div>
        <span className={`text-xs ${confColor}`}>
          {score.confidenceLabel} confidence
        </span>
      </div>

      <div className="space-y-1">
        {score.categories.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-sm" title={c.detail}>
            <span className="flex-1">{c.label}</span>
            <div className="w-28 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${c.score >= 66 ? 'bg-green-500' : c.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${c.score}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-300">{c.score.toFixed(0)}</span>
          </div>
        ))}
      </div>

      {score.strengths.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Strengths</div>
          <ul className="text-sm text-green-300 space-y-0.5">
            {score.strengths.map((s, i) => <li key={i}>+ {s}</li>)}
          </ul>
        </div>
      )}
      {score.weaknesses.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Weaknesses</div>
          <ul className="text-sm text-red-300 space-y-0.5">
            {score.weaknesses.map((w, i) => <li key={i}>− {w}</li>)}
          </ul>
        </div>
      )}

      <div className="pt-2 border-t border-gray-800">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
          Evidence (model v{score.modelVersion} · {season ?? 'Current'})
        </div>
        <ul className="text-xs text-gray-400 space-y-0.5">
          {score.evidence.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      </div>
    </div>
  );
}
