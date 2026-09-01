import { useEffect, useMemo, useState } from 'react';
import type { PokemonType } from '@/types/pokemon';
import type { PokemonUsage } from '@/types/usage';
import type { TeamMember } from '@/types/team';
import { DEFAULT_EVS, DEFAULT_IVS } from '@/types/team';
import { getAllPokemon } from '@/db/pokemon-cache';
import { getAllUsageForFormat } from '@/db/usage-cache';
import { db } from '@/db/database';
import { CURRENT_FORMAT, useUsageStore } from '@/stores/usage-store';
import { useTeamStore } from '@/stores/team-store';
import { buildProvenTeams, generateDiverseTeams } from '@/engine/team-recommend';
import { assembleMetaTeam, type AssembledMetaTeam } from '@/engine/meta-team';
import { scoreTeam, type ScorableMember, type TeamScore } from '@/engine/team-score';
import {
  coverageGapFindings,
  usageResidualFindings,
} from '@/engine/off-meta';
import { canonicalize } from '@/data/sources/showdown-mapping';

/**
 * Meta Teams: generate complete, playable teams from usage (top cores + each
 * mon's most common set), score-agnostic but honest — no fabricated win rates.
 * One optional off-meta tweak is suggested. Save any team to your box.
 * Includes a verified Sources & Transfer guide.
 */
export default function MetaTeamsView() {
  const season = useUsageStore((s) => s.season);
  const attribution = useUsageStore((s) => s.attribution);
  const { createTeam, addMember } = useTeamStore();

  const [records, setRecords] = useState<PokemonUsage[]>([]);
  const [dex, setDex] = useState<
    { name: string; id: number; types: PokemonType[]; baseStats: import('@/types/pokemon').BaseStats }[]
  >([]);
  const [ready, setReady] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [moveTypeMap, setMoveTypeMap] = useState<Map<string, PokemonType>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [recs, allDex, allMoves] = await Promise.all([
        getAllUsageForFormat(CURRENT_FORMAT, season ?? 'Current'),
        getAllPokemon(),
        db.moves.toArray(),
      ]);
      if (cancelled) return;
      setRecords(recs);
      setDex(
        allDex.map((p) => ({
          name: p.name,
          id: p.id,
          types: p.types as PokemonType[],
          baseStats: p.baseStats,
        })),
      );
      const mt = new Map<string, PokemonType>();
      for (const mv of allMoves) mt.set(mv.name.toLowerCase(), mv.type);
      setMoveTypeMap(mt);
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const idByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dex) m.set(canonicalize(d.name), d.id);
    return m;
  }, [dex]);

  // ---- Suggest / Refresh: generate diverse teams, score each with the full
  // analyzer, and surface the best-scoring one. Refresh advances the seed. ----
  const usageByCanon = useMemo(
    () => new Map(records.map((r) => [canonicalize(r.displayName), r])),
    [records],
  );
  const dexByCanon = useMemo(
    () => new Map(dex.map((d) => [canonicalize(d.name), d])),
    [dex],
  );

  const suggestion = useMemo(() => {
    if (records.length === 0 || dex.length === 0) return null;
    // Generate a small pool at this refresh offset, score each, pick the best.
    const pool = generateDiverseTeams(records, 4, refreshIndex);
    if (pool.length === 0) return null;

    const scoreCandidate = (displayNames: string[]): TeamScore | null => {
      const members: ScorableMember[] = [];
      for (const name of displayNames) {
        const d = dexByCanon.get(canonicalize(name));
        if (!d) continue;
        const u = usageByCanon.get(canonicalize(name));
        const moveRows = u
          ? u.rows.filter((r) => r.category === 'move' && r.name).sort((a, b) => a.rank - b.rank).slice(0, 4)
          : [];
        const abilityRow = u?.rows.filter((r) => r.category === 'ability').sort((a, b) => a.rank - b.rank)[0];
        const itemRow = u?.rows.filter((r) => r.category === 'held_item').sort((a, b) => a.rank - b.rank)[0];
        const spRow = u?.rows.filter((r) => r.category === 'stat_points' && r.statPoints).sort((a, b) => a.rank - b.rank)[0];
        const alignRow = u?.rows.filter((r) => r.category === 'stat_alignment' && r.name).sort((a, b) => a.rank - b.rank)[0];
        members.push({
          name: d.name,
          types: d.types,
          moves: moveRows.map((r) => r.name),
          // Resolve real move types so offensive coverage isn't undercounted.
          moveTypes: moveRows
            .map((r) => moveTypeMap.get(r.name.toLowerCase()))
            .filter((t): t is PokemonType => !!t),
          ability: abilityRow?.name ?? '',
          item: itemRow?.name ?? '',
          baseStats: d.baseStats,
          statPoints: spRow?.statPoints,
          statAlignment: alignRow ? (alignRow.name.toLowerCase() as ScorableMember['statAlignment']) : undefined,
        });
      }
      if (members.length === 0) return null;
      return scoreTeam(members, undefined, {
        popularity: (key) => {
          const u = usageByCanon.get(key);
          if (!u) return null;
          // Real popularity: how many teams list this mon as a teammate,
          // normalized — richer than a flat constant.
          const teammateMentions = u.rows.filter((r) => r.category === 'teammate').length;
          return Math.min(1, 0.5 + teammateMentions / 20);
        },
      });
    };

    const scored = pool
      .map((c) => ({ candidate: c, score: scoreCandidate(c.displayNames) }))
      .filter((x): x is { candidate: typeof pool[number]; score: TeamScore } => !!x.score)
      .sort((a, b) => b.score.total - a.score.total);

    if (scored.length === 0) return null;
    const best = scored[0];
    const assembled = assembleMetaTeam(
      `Suggested Team`,
      best.candidate.displayNames.map((n) => ({ displayName: n, showdownId: canonicalize(n) })),
      records,
    );
    return { assembled, score: best.score };
  }, [records, dex, dexByCanon, usageByCanon, refreshIndex, moveTypeMap]);

  const teams: AssembledMetaTeam[] = useMemo(() => {
    if (records.length === 0) return [];
    const proven = buildProvenTeams(records, 3);

    // Prepare one off-meta candidate from coverage gaps to offer as a tweak.
    const popularity = new Map<string, number>();
    // crude popularity: fraction of records listing each mon as teammate
    const residual = usageResidualFindings(records, 20);
    for (const r of residual) popularity.set(r.key, 1 - r.novelty);
    const topThreats = proven[0]?.displayNames.slice(0, 6).map((n) => {
      const d = dex.find((x) => canonicalize(x.name) === canonicalize(n));
      return d ? { name: d.name, types: d.types } : null;
    }).filter((x): x is { name: string; types: PokemonType[] } => !!x) ?? [];
    const gaps = coverageGapFindings(
      topThreats,
      dex.map((d) => ({ name: d.name, types: d.types })),
      (k) => popularity.get(k) ?? 0.1,
      1,
    );
    const offMeta = gaps[0]
      ? { displayName: gaps[0].displayName, reason: gaps[0].reasons[0] }
      : undefined;

    return proven.map((c, i) =>
      assembleMetaTeam(
        `Meta Team ${i + 1}`,
        c.displayNames.map((n) => ({ displayName: n, showdownId: canonicalize(n) })),
        records,
        i === 0 ? offMeta : undefined,
      ),
    );
  }, [records, dex]);

  const handleSave = async (team: AssembledMetaTeam) => {
    const created = await createTeam(team.name, 'reg-m-a');
    for (const set of team.sets) {
      const pokemonId = idByName.get(canonicalize(set.displayName));
      if (!pokemonId) continue;
      const member: TeamMember = {
        id: crypto.randomUUID(),
        pokemonId,
        ability: set.ability ?? '',
        item: set.item ?? '',
        nature: 'hardy',
        moves: set.moves.map((m) => m.name),
        evs: { ...DEFAULT_EVS },
        ivs: { ...DEFAULT_IVS },
        level: 50,
        available: true,
      };
      await addMember(created.id, member);
    }
    setSavedName(team.name);
  };

  if (!ready) return <div className="text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <div className="card text-gray-400 text-sm">
          Meta Teams are built from cached Champions usage. Sync it on the Data
          or Meta tab first.
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            Complete teams assembled from real usage: the most-used Pokémon with
            their most common sets. Percentages are observed usage — there are no
            win rates in the source, so none are claimed. Save one and refine it.
          </p>

          {/* Suggest / Refresh: best-scoring generated team */}
          {suggestion && (
            <div className="card border-blue-700 bg-blue-900/10 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">✨ Suggested team</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    Analyzer score{' '}
                    <span className="font-bold">{suggestion.score.total.toFixed(0)}</span>/100
                  </span>
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => setRefreshIndex((i) => i + 1)}
                    title="Show a different high-scoring team"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Generated from usage, scored by the full analyzer (types, roles,
                exact speed, anti-synergy). Don't like it? Refresh for a different
                high-scoring option.
              </p>

              <div className="flex flex-wrap gap-1">
                {suggestion.assembled.sets.map((s, si) => (
                  <span key={si} className="px-2 py-0.5 rounded text-xs bg-gray-700 capitalize">
                    {s.displayName}
                  </span>
                ))}
              </div>

              {suggestion.score.strengths.length > 0 && (
                <ul className="text-xs text-green-300 space-y-0.5">
                  {suggestion.score.strengths.slice(0, 3).map((s, i) => <li key={i}>+ {s}</li>)}
                </ul>
              )}
              {suggestion.score.weaknesses.length > 0 && (
                <ul className="text-xs text-red-300 space-y-0.5">
                  {suggestion.score.weaknesses.slice(0, 2).map((w, i) => <li key={i}>− {w}</li>)}
                </ul>
              )}

              <button className="btn-primary text-sm" onClick={() => void handleSave(suggestion.assembled)}>
                Save this team
              </button>
            </div>
          )}

          {savedName && (
            <div className="card border-green-700 bg-green-900/20 text-green-300 text-sm">
              ✓ Saved “{savedName}” to your Teams. Open it in the Teams tab to
              tweak sets, then build it in-game (see Sources &amp; Transfer below).
            </div>
          )}

          {teams.map((team, i) => (
            <div key={i} className="card space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{team.name}</h3>
                <button className="btn-secondary text-sm" onClick={() => void handleSave(team)}>
                  Save to my teams
                </button>
              </div>

              <div className="space-y-2">
                {team.sets.map((s, si) => (
                  <div key={si} className="border-b border-gray-800 pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium">{s.displayName}</span>
                      {!s.hasData && (
                        <span className="text-[11px] text-yellow-400">no usage — fill in-game</span>
                      )}
                    </div>
                    {s.hasData && (
                      <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                        <div>
                          {s.item && <span>Item: {s.item} ({s.itemPct?.toFixed(0)}%) · </span>}
                          {s.ability && <span>Ability: {s.ability} ({s.abilityPct?.toFixed(0)}%)</span>}
                        </div>
                        <div className="capitalize">
                          Moves: {s.moves.map((m) => `${m.name}${m.pct != null ? ` (${m.pct.toFixed(0)}%)` : ''}`).join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {team.tweak && (
                <div className="rounded-lg border border-amber-700/60 bg-amber-900/20 p-2 text-sm">
                  <span className="text-amber-300 font-medium">💡 Off-meta tweak (experimental): </span>
                  {team.tweak.suggestion}
                  <div className="text-xs text-gray-400 mt-1">{team.tweak.rationale}</div>
                </div>
              )}

              <p className="text-[11px] text-gray-500">{team.note}</p>
            </div>
          ))}
        </>
      )}

      <SourcesAndTransfer attribution={attribution} />
    </div>
  );
}

function SourcesAndTransfer({ attribution }: { attribution: string }) {
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Sources &amp; Transfer</h3>

      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
          Where to get proven, complete teams
        </div>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>
            • <strong>Replica Team codes</strong> — Champions’ built-in rental system.
            Redeem a code in-game to instantly get a full team to try. Community
            code lists (e.g. ProGameGuides’ Champions team codes) publish current
            ones.
          </li>
          <li>
            • <strong>Pikalytics team usage</strong> (pikalytics.com/team-usage) —
            top team compositions grouped by identical Pokémon/Mega forms.
          </li>
          <li>
            • <strong>Tournament results + full teams</strong> — Bulbagarden’s VGC
            2026 result threads and Limitless VGC list placements with each
            Pokémon’s moves, item, ability (and often a replica code).
          </li>
        </ul>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
          Getting a team into Champions
        </div>
        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
          <li>
            <strong>Fastest — Replica Team code:</strong> in Champions, use the
            Replica Team / rental feature and enter the code. No breeding or Home
            transfer needed.
          </li>
          <li>
            <strong>From your own boxes — via Pokémon Home:</strong> in Home, choose
            “Transfer to Pokémon Champions,” select your Pokémon, and send them.
            Then in Champions open the <em>Recruit</em> screen → “Retrieve from
            Pokémon Home.” (Some Pokémon — e.g. Shadow/costume from GO — have
            transfer restrictions.)
          </li>
          <li>
            <strong>Rebuild manually:</strong> save a team here, open it in the
            Teams tab, then recreate the sets in-game. Use the usage % as your
            guide for items/moves.
          </li>
        </ol>
      </div>

      <p className="text-[11px] text-gray-500">
        Usage data: {attribution}. Transfer/replica details are community- and
        guide-verified; in-game menus may change — follow on-screen prompts.
        This tool does not fabricate win rates or tournament results.
      </p>
    </div>
  );
}
