import { useEffect, useMemo, useState } from 'react';
import type { PokemonType } from '@/types/pokemon';
import type { PokemonUsage } from '@/types/usage';
import type { TeamMember } from '@/types/team';
import { DEFAULT_EVS, DEFAULT_IVS } from '@/types/team';
import { getAllPokemon } from '@/db/pokemon-cache';
import { getAllUsageForFormat } from '@/db/usage-cache';
import { CURRENT_FORMAT, useUsageStore } from '@/stores/usage-store';
import { useTeamStore } from '@/stores/team-store';
import { buildProvenTeams } from '@/engine/team-recommend';
import { assembleMetaTeam, type AssembledMetaTeam } from '@/engine/meta-team';
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
    { name: string; id: number; types: PokemonType[] }[]
  >([]);
  const [ready, setReady] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [recs, allDex] = await Promise.all([
        getAllUsageForFormat(CURRENT_FORMAT, season ?? 'Current'),
        getAllPokemon(),
      ]);
      if (cancelled) return;
      setRecords(recs);
      setDex(allDex.map((p) => ({ name: p.name, id: p.id, types: p.types as PokemonType[] })));
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
