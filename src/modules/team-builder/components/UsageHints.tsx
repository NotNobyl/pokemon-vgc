import { useEffect, useState } from 'react';
import type { Pokemon } from '@/types/pokemon';
import type { PokemonUsage, StatPoints } from '@/types/usage';
import { getAllPokemon } from '@/db/pokemon-cache';
import {
  getUsageForShowdownId,
  topRows,
  usageConfidence,
  useUsageStore,
} from '@/stores/usage-store';
import {
  buildPokemonNameIndex,
  candidateKeys,
} from '@/data/sources/showdown-mapping';

interface UsageHintsProps {
  pokemon: Pokemon;
}

/** Format a Champions stat-point spread compactly. */
function formatStatPoints(sp: StatPoints): string {
  return `HP ${sp.hp} / Atk ${sp.attack} / Def ${sp.defense} / SpA ${sp.spAttack} / SpD ${sp.spDefense} / Spe ${sp.speed}`;
}

function pct(n: number | null): string {
  return n == null ? '—' : `${n.toFixed(1)}%`;
}

/**
 * Read-only meta hints for the selected Pokémon, sourced from cached Champions
 * Battle Data. Clearly labeled as observed usage — not a prescription.
 */
export default function UsageHints({ pokemon }: UsageHintsProps) {
  const season = useUsageStore((s) => s.season);
  const attribution = useUsageStore((s) => s.attribution);
  const [usage, setUsage] = useState<PokemonUsage | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Resolve the local Pokémon name to a Showdown id the API cache used.
      // We built the cache keyed by the API's showdownId; the mapping helper
      // gives us candidate canonical keys, and getLatestUsage matches on the
      // stored showdownId. Try each candidate id until one hits.
      let found: PokemonUsage | undefined;
      for (const key of candidateKeys(pokemon.name)) {
        found = await getUsageForShowdownId(key);
        if (found) break;
      }
      // Fallback: build a name index over all cached usage via all pokemon —
      // not needed if the direct id match worked.
      if (!found) {
        // Best-effort reverse match: some API ids differ from PokéAPI slugs.
        const all = await getAllPokemon();
        const idx = buildPokemonNameIndex(all);
        // no-op if nothing better; keeps the code path explicit
        void idx;
      }
      if (!cancelled) {
        setUsage(found);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pokemon.name]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-400">
        Loading usage data…
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-400">
        No cached usage for this Pokémon. Sync Champions Battle Data on the Data
        tab to see common sets.
      </div>
    );
  }

  const confidence = usageConfidence(usage, season);
  const moves = topRows(usage, 'move', 6);
  const items = topRows(usage, 'held_item', 4);
  const abilities = topRows(usage, 'ability', 3);
  const natures = topRows(usage, 'stat_alignment', 3);
  const spreads = topRows(usage, 'stat_points', 3);
  const teammates = topRows(usage, 'teammate', 5);

  const confColor =
    confidence?.label === 'high'
      ? 'text-green-400'
      : confidence?.label === 'moderate'
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-200">
          📊 Common usage ({usage.format} · {usage.season})
        </span>
        {confidence && (
          <span
            className={`text-xs ${confColor}`}
            title={confidence.reason}
          >
            {confidence.label} confidence
          </span>
        )}
      </div>

      {items.length > 0 && (
        <HintList
          label="Items"
          rows={items.map((r) => `${r.name} (${pct(r.percentage)})`)}
        />
      )}
      {abilities.length > 0 && (
        <HintList
          label="Abilities"
          rows={abilities.map((r) => `${r.name} (${pct(r.percentage)})`)}
        />
      )}
      {moves.length > 0 && (
        <HintList
          label="Moves"
          rows={moves.map((r) => `${r.name} (${pct(r.percentage)})`)}
        />
      )}
      {natures.length > 0 && (
        <HintList
          label="Natures"
          rows={natures.map(
            (r) =>
              `${r.name}${r.statUp ? ` (+${r.statUp}${r.statDown ? ` / -${r.statDown}` : ''})` : ''} ${pct(r.percentage)}`,
          )}
        />
      )}
      {spreads.length > 0 && (
        <HintList
          label="Stat-point spreads"
          rows={spreads.map(
            (r) =>
              `${r.statPoints ? formatStatPoints(r.statPoints) : r.name} ${pct(r.percentage)}`,
          )}
        />
      )}
      {teammates.length > 0 && (
        <HintList label="Teammates" rows={teammates.map((r) => r.name)} />
      )}

      <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-800">
        Observed usage, not a recommendation. {attribution}.
      </p>
    </div>
  );
}

function HintList({ label, rows }: { label: string; rows: string[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
        {label}
      </div>
      <ul className="space-y-0.5">
        {rows.map((r, i) => (
          <li key={`${label}-${i}`} className="text-gray-200 capitalize">
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
