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
import {
  buildProvenTeams,
  buildAroundCore,
  improveCurrentTeam,
  evidenceLabelText,
  type TeamCandidate,
  type ImprovementSuggestion,
} from '@/engine/team-recommend';
import type { PokemonUsage } from '@/types/usage';
import {
  usageResidualFindings,
  coverageGapFindings,
  discoveryLabelText,
  overlookedCores,
  type DiscoveryFinding,
  type CoverageCandidate,
  type OverlookedCore,
} from '@/engine/off-meta';
import MetaTeamsView from '../components/MetaTeamsView';
import { canonicalize as canon } from '@/data/sources/showdown-mapping';

type Mode = 'breakdown' | 'compare' | 'recommend' | 'metateams';
type RecMode = 'proven' | 'core' | 'improve' | 'discover';

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
  const [usageRecords, setUsageRecords] = useState<PokemonUsage[]>([]);
  const [dexTypes, setDexTypes] = useState<{ name: string; types: PokemonType[] }[]>([]);
  const [recMode, setRecMode] = useState<RecMode>('proven');
  const [coreInput, setCoreInput] = useState('');
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
      if (!cancelled) {
        setPopularity(map);
        setUsageRecords(records);
      }
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
      if (!cancelled) {
        setDexTypes(allPokemon.map((p) => ({ name: p.name, types: p.types as PokemonType[] })));
      }
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

  const provenTeams: TeamCandidate[] = useMemo(
    () => (recMode === 'proven' ? buildProvenTeams(usageRecords, 3) : []),
    [recMode, usageRecords],
  );

  const coreTeam: TeamCandidate | null = useMemo(() => {
    if (recMode !== 'core' || !coreInput.trim()) return null;
    const core = coreInput.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3);
    return buildAroundCore(core, usageRecords);
  }, [recMode, coreInput, usageRecords]);

  const improvements: ImprovementSuggestion[] = useMemo(() => {
    if (recMode !== 'improve' || !selectedTeam) return [];
    const members = scorable.get(selectedTeam.id) ?? [];
    return improveCurrentTeam(members.map((m) => m.name), usageRecords, 3);
  }, [recMode, selectedTeam, scorable, usageRecords]);

  const residualFindings: DiscoveryFinding[] = useMemo(
    () => (recMode === 'discover' ? usageResidualFindings(usageRecords, 6) : []),
    [recMode, usageRecords],
  );

  const coverageFindings: CoverageCandidate[] = useMemo(() => {
    if (recMode !== 'discover' || dexTypes.length === 0) return [];
    // Top threats = most popular species (by co-occurrence) joined with types.
    const byName = new Map(dexTypes.map((d) => [d.name.toLowerCase().replace(/[^a-z0-9]/g, ''), d]));
    const topThreats = [...popularity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key]) => byName.get(key))
      .filter((d): d is { name: string; types: PokemonType[] } => !!d);
    return coverageGapFindings(
      topThreats,
      dexTypes,
      (key) => popularity.get(key) ?? null,
      6,
    );
  }, [recMode, dexTypes, popularity]);

  // Overlooked cores: structurally strong pairs that are rarely used together.
  const overlooked: OverlookedCore[] = useMemo(() => {
    if (recMode !== 'discover' || usageRecords.length === 0 || dexTypes.length === 0) {
      return [];
    }
    // Pair co-occurrence lookup (0..1): does A list B (or vice versa) as teammate?
    const mates = new Map<string, Set<string>>();
    for (const rec of usageRecords) {
      const k = canon(rec.displayName);
      const set = mates.get(k) ?? new Set<string>();
      for (const r of rec.rows) {
        if (r.category === 'teammate' && r.name) set.add(canon(r.name));
      }
      mates.set(k, set);
    }
    const coOccur = (a: string, b: string) =>
      mates.get(a)?.has(b) || mates.get(b)?.has(a) ? 1 : 0;
    // Bound the pool to the ~50 most popular species so O(n^2) stays cheap.
    const pool = [...popularity.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 50)
      .map(([key]) => dexTypes.find((d) => canon(d.name) === key))
      .filter((d): d is { name: string; types: PokemonType[] } => !!d);
    return overlookedCores(pool, coOccur, 8);
  }, [recMode, usageRecords, dexTypes, popularity]);

  if (!ready) return <div className="text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Team Intelligence Lab</h2>

      <div className="flex gap-1 flex-wrap">
        {(['breakdown', 'compare', 'recommend', 'metateams'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              mode === m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {m === 'breakdown'
              ? 'Score Breakdown'
              : m === 'compare'
                ? 'Compare Teams'
                : m === 'recommend'
                  ? 'Recommend'
                  : 'Meta Teams'}
          </button>
        ))}
      </div>

      {mode === 'metateams' && <MetaTeamsView />}

      {mode !== 'metateams' && (teams.length === 0 ? (
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

          {/* Recommend */}
          {mode === 'recommend' && (
            <RecommendPanel
              recMode={recMode}
              setRecMode={setRecMode}
              coreInput={coreInput}
              setCoreInput={setCoreInput}
              provenTeams={provenTeams}
              coreTeam={coreTeam}
              improvements={improvements}
              residualFindings={residualFindings}
              coverageFindings={coverageFindings}
              overlooked={overlooked}
              hasUsage={usageRecords.length > 0}
              hasSelectedTeam={!!selectedTeam}
            />
          )}

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
      ))}
    </div>
  );
}

function RecommendPanel({
  recMode,
  setRecMode,
  coreInput,
  setCoreInput,
  provenTeams,
  coreTeam,
  improvements,
  residualFindings,
  coverageFindings,
  overlooked,
  hasUsage,
  hasSelectedTeam,
}: {
  recMode: RecMode;
  setRecMode: (m: RecMode) => void;
  coreInput: string;
  setCoreInput: (s: string) => void;
  provenTeams: TeamCandidate[];
  coreTeam: TeamCandidate | null;
  improvements: ImprovementSuggestion[];
  residualFindings: DiscoveryFinding[];
  coverageFindings: CoverageCandidate[];
  overlooked: OverlookedCore[];
  hasUsage: boolean;
  hasSelectedTeam: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {([
          ['proven', 'Best Proven'],
          ['core', 'Build Around Core'],
          ['improve', 'Improve Current'],
          ['discover', 'Off-Meta Discover'],
        ] as [RecMode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setRecMode(m)}
            className={`px-3 py-1 rounded-lg text-xs ${
              recMode === m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!hasUsage && (
        <div className="card text-sm text-gray-400">
          Recommendations use cached Champions usage. Sync it on the Data tab
          (or Meta tab) first for meaningful results.
        </div>
      )}

      {recMode === 'proven' &&
        provenTeams.map((c, i) => <CandidateCard key={i} c={c} rank={i + 1} />)}

      {recMode === 'core' && (
        <div className="space-y-2">
          <input
            className="input w-full"
            placeholder="Core Pokémon, comma-separated (1–3), e.g. Incineroar, Rillaboom"
            value={coreInput}
            onChange={(e) => setCoreInput(e.target.value)}
          />
          {coreTeam && <CandidateCard c={coreTeam} />}
        </div>
      )}

      {recMode === 'improve' && (
        <div className="card">
          <h3 className="font-semibold mb-1">Smallest helpful changes</h3>
          {!hasSelectedTeam ? (
            <p className="text-sm text-gray-400">Select a team above to get suggestions.</p>
          ) : improvements.length === 0 ? (
            <p className="text-sm text-gray-400">
              No clear single-swap suggestion from usage data.
            </p>
          ) : (
            <ul className="space-y-2">
              {improvements.map((s, i) => (
                <li key={i} className="text-sm">
                  <div className="capitalize">
                    <span className="text-red-300">− {s.replaceName}</span>{' '}
                    <span className="text-gray-500">→</span>{' '}
                    <span className="text-green-300">+ {s.withName}</span>
                    <span className="ml-2 text-[11px] text-gray-500">
                      {evidenceLabelText(s.evidence)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{s.reason}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Heuristic from usage co-occurrence. Test a change over several games
            before committing.
          </p>
        </div>
      )}

      {recMode === 'discover' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Underused Pokémon that look promising by a measurable signal — not
            random low-usage picks. Nothing here is "optimal" or "broken"; treat
            each as an experiment and run the suggested test games.
          </p>

          {residualFindings.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-1">Underused-relative-to-fit</h3>
              <ul className="space-y-2">
                {residualFindings.map((f) => (
                  <li key={f.key} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium flex-1">{f.displayName}</span>
                      <span className="text-[11px] text-gray-400">{discoveryLabelText(f.label)}</span>
                      <span className="text-[11px] text-gray-500">test ~{f.suggestedTestMatches} games</span>
                    </div>
                    <div className="text-xs text-gray-400">{f.reasons[0]}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {coverageFindings.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-1">Meta coverage gaps</h3>
              <p className="text-xs text-gray-500 mb-2">
                Low-usage Pokémon that resist &amp; threaten multiple current top threats.
              </p>
              <ul className="space-y-2">
                {coverageFindings.map((f) => (
                  <li key={f.key} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium flex-1">{f.displayName}</span>
                      <span className="text-[11px] text-gray-400">{discoveryLabelText(f.label)}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Answers: <span className="capitalize">{f.answers.join(', ')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {overlooked.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-1">Overlooked cores (on-paper strong, rarely used)</h3>
              <p className="text-xs text-gray-500 mb-2">
                Pairs that cover each other defensively and threaten many types,
                but that few players run together — potential blind spots in a
                young meta. Type-chart signal only; verify sets and speed.
              </p>
              <ul className="space-y-2">
                {overlooked.map((c) => (
                  <li key={`${c.a}-${c.b}`} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium flex-1">{c.a} + {c.b}</span>
                      <span className="text-[11px] text-gray-400">{discoveryLabelText(c.label)}</span>
                      <span className="text-[11px] text-gray-500">test ~{c.suggestedTestMatches}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Structure {Math.round(c.structureScore * 100)}% · underused {Math.round(c.underuse * 100)}% → opportunity {Math.round(c.opportunity * 100)}%
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasUsage && residualFindings.length === 0 && coverageFindings.length === 0 && overlooked.length === 0 && (
            <div className="card text-sm text-gray-400">
              No clear off-meta opportunities from the current cached data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ c, rank }: { c: TeamCandidate; rank?: number }) {
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {rank ? `#${rank} ` : ''}Suggested team
        </h3>
        <span className="text-xs text-gray-400">{evidenceLabelText(c.evidence)}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {c.displayNames.map((n, i) => (
          <span
            key={`${n}-${i}`}
            className={`px-2 py-0.5 rounded text-xs capitalize ${
              c.locked.includes(n.toLowerCase().replace(/[^a-z0-9]/g, ''))
                ? 'bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-200'
            }`}
          >
            {n}
          </span>
        ))}
      </div>
      <ul className="text-xs text-gray-400 space-y-0.5">
        {c.reasons.map((r, i) => <li key={i}>• {r}</li>)}
      </ul>
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
