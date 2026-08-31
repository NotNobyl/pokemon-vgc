/**
 * Champions Battle Data source adapter.
 *
 * Source: https://championsbattledata.com  (verified live 2026-08-31)
 * Terms:  https://championsbattledata.com/api-rules/
 *   - Personal/community/commercial use allowed.
 *   - Attribution required (see ATTRIBUTION below).
 *   - Reasonable caching allowed; no re-hosting as a competing data service.
 *   - CORS enabled for browser apps on other domains (so this PWA can call it
 *     directly from an Android phone with no backend/proxy).
 *   - No fixed rate limit, but abusive load may be throttled — so we fetch
 *     on-demand, cache aggressively, and pace bulk syncs.
 *
 * This adapter returns REAL in-game Pokémon Champions battle data. It performs
 * lightweight schema validation/normalization (no external validator dep) and
 * stamps provenance onto every record. On any failure it fails gracefully so
 * cached data remains usable.
 */

import type {
  PokemonUsage,
  StatPoints,
  UsageCategory,
  UsageFormat,
  UsageProvenance,
  UsageRow,
} from '@/types/usage';
import { usageKey } from '@/db/usage-cache';

export const API_BASE = 'https://championsbattledata.com';
export const ATTRIBUTION = 'Battle data provided by Pokémon Champions Battle Data';
export const ATTRIBUTION_URL = 'https://championsbattledata.com/';
export const TRANSFORM_VERSION = 1;

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 2;

/** A single entry from the /api index. */
export interface IndexEntry {
  showdownId: string;
  displayName: string;
  types: string[];
  baseStats?: Record<string, number>;
  sprite?: string;
  learnableMoveNames?: string[];
  /** Abilities parsed from summary.primary.abilities ("A|B|C"). */
  abilities?: string[];
}

export interface ChampionsIndex {
  season: string; // resolved current/default season, e.g. "M5"
  generatedAt?: string;
  dataVersion?: string;
  seasons: string[];
  entries: IndexEntry[];
}

/** Raw shapes we read from the API (only the fields we use). */
interface RawIndexPokemon {
  showdownId?: string;
  slug?: string;
  name?: string;
  showdownName?: string;
  battleName?: string;
  learnableMoveNames?: string[];
  summary?: {
    sprite?: string;
    types?: string[];
    baseStats?: Record<string, number>;
    primary?: { abilities?: string };
  };
}

interface RawIndex {
  defaultSeason?: string;
  generatedAt?: string;
  dataVersion?: string;
  seasons?: string[];
  pokemon?: RawIndexPokemon[];
}

interface RawBattleRow {
  category?: string;
  rank?: number;
  name?: string;
  percentage?: string;
  percentage_value?: number | null;
  stat_up?: string;
  stat_down?: string;
  hp_points?: number;
  attack_points?: number;
  defense_points?: number;
  sp_atk_points?: number;
  sp_def_points?: number;
  speed_points?: number;
}

interface RawBattleResponse {
  pokemon?: string;
  showdownId?: string;
  format?: string;
  season?: string;
  source?: string;
  rows?: RawBattleRow[];
}

/** fetch with timeout + small retry/backoff. Returns null on give-up. */
async function fetchJson<T>(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {},
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!res.ok) {
        // 4xx are not worth retrying; 5xx/network are.
        if (res.status >= 400 && res.status < 500) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch {
      clearTimeout(timer);
      if (attempt === retries) return null;
      // linear backoff: 400ms, 800ms, ...
      await delay(400 * (attempt + 1));
    }
  }
  return null;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set<UsageCategory>([
  'move',
  'held_item',
  'teammate',
  'ability',
  'stat_alignment',
  'stat_points',
]);

/** Normalize a raw percentage into 0..100 or null. */
function normalizePercentage(raw: RawBattleRow): number | null {
  if (typeof raw.percentage_value === 'number') return raw.percentage_value;
  if (typeof raw.percentage === 'string' && raw.percentage.trim() !== '') {
    const parsed = Number.parseFloat(raw.percentage.replace('%', '').trim());
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function extractStatPoints(raw: RawBattleRow): StatPoints | undefined {
  const keys = [
    'hp_points',
    'attack_points',
    'defense_points',
    'sp_atk_points',
    'sp_def_points',
    'speed_points',
  ] as const;
  const hasAny = keys.some((k) => typeof raw[k] === 'number');
  if (!hasAny) return undefined;
  return {
    hp: raw.hp_points ?? 0,
    attack: raw.attack_points ?? 0,
    defense: raw.defense_points ?? 0,
    spAttack: raw.sp_atk_points ?? 0,
    spDefense: raw.sp_def_points ?? 0,
    speed: raw.speed_points ?? 0,
  };
}

/** Validate + normalize a single battle row. Returns null if unusable. */
function normalizeRow(raw: RawBattleRow): UsageRow | null {
  const category = raw.category;
  if (!category || !VALID_CATEGORIES.has(category)) return null;
  const cat = category as UsageCategory;
  const rank = typeof raw.rank === 'number' ? raw.rank : 0;
  const name = typeof raw.name === 'string' ? raw.name : '';

  // stat_points rows legitimately have an empty name; everything else needs one.
  if (cat !== 'stat_points' && name.trim() === '') return null;

  const row: UsageRow = {
    category: cat,
    rank,
    name,
    percentage: normalizePercentage(raw),
    percentageLabel:
      typeof raw.percentage === 'string' ? raw.percentage : undefined,
  };

  if (cat === 'stat_alignment') {
    row.statUp = raw.stat_up || undefined;
    row.statDown = raw.stat_down || undefined;
  }
  if (cat === 'stat_points') {
    row.statPoints = extractStatPoints(raw);
  }
  return row;
}

/** Fetch and normalize the index. Returns null on failure. */
export async function fetchIndex(): Promise<ChampionsIndex | null> {
  const raw = await fetchJson<RawIndex>(`${API_BASE}/api`);
  if (!raw || !Array.isArray(raw.pokemon)) return null;

  const entries: IndexEntry[] = [];
  for (const p of raw.pokemon) {
    const showdownId = p.showdownId ?? p.slug;
    const displayName = p.name ?? p.showdownName ?? p.battleName ?? showdownId;
    if (!showdownId || !displayName) continue;
    entries.push({
      showdownId,
      displayName,
      types: p.summary?.types ?? [],
      baseStats: p.summary?.baseStats,
      sprite: p.summary?.sprite,
      learnableMoveNames: p.learnableMoveNames,
      abilities: p.summary?.primary?.abilities
        ? p.summary.primary.abilities.split('|').map((a) => a.trim()).filter(Boolean)
        : [],
    });
  }

  if (entries.length === 0) return null;

  return {
    season: raw.defaultSeason ?? 'Current',
    generatedAt: raw.generatedAt,
    dataVersion: raw.dataVersion,
    seasons: raw.seasons ?? [],
    entries,
  };
}

function buildProvenance(
  format: UsageFormat,
  season: string,
  sourceUrl: string,
): UsageProvenance {
  return {
    source: 'champions-battle-data',
    attribution: ATTRIBUTION,
    sourceUrl,
    format,
    season,
    retrievedAt: new Date().toISOString(),
    transformVersion: TRANSFORM_VERSION,
    // Champions API does not report sample size or rating bracket today.
    sampleSize: undefined,
    ratingBracket: undefined,
  };
}

/**
 * Fetch the current battle rows for one Pokémon in one format.
 * Returns a normalized, provenance-stamped PokemonUsage, or null on failure.
 */
export async function fetchPokemonUsage(
  showdownId: string,
  displayName: string,
  format: UsageFormat,
  season: string,
): Promise<PokemonUsage | null> {
  const url = `${API_BASE}/api/battle/${format}/${encodeURIComponent(showdownId)}`;
  const raw = await fetchJson<RawBattleResponse>(url);
  if (!raw || !Array.isArray(raw.rows)) return null;

  const rows: UsageRow[] = [];
  for (const r of raw.rows) {
    const normalized = normalizeRow(r);
    if (normalized) rows.push(normalized);
  }
  if (rows.length === 0) return null;

  // The API's current-root response reports season "Current"; prefer the
  // resolved concrete season from the index for cache keying + confidence.
  const effectiveSeason = raw.season && raw.season !== 'Current' ? raw.season : season;

  return {
    key: usageKey(showdownId, format, effectiveSeason),
    showdownId,
    displayName: raw.pokemon ?? displayName,
    format,
    season: effectiveSeason,
    rows,
    provenance: buildProvenance(format, effectiveSeason, url),
  };
}

export interface SyncProgress {
  current: number;
  total: number;
  currentName: string;
}

export interface SyncResult {
  succeeded: number;
  failed: number;
  season: string;
  attribution: string;
  attributionUrl: string;
}

/**
 * Sync usage for a set of Pokémon (by index entries) for one format.
 * Paces requests to be a polite API citizen. Calls `onRecord` for each
 * successful normalized record (caller persists), and `onProgress` for UI.
 * Never throws; returns a summary.
 */
export async function syncUsage(
  entries: IndexEntry[],
  format: UsageFormat,
  season: string,
  handlers: {
    onRecord: (record: PokemonUsage) => Promise<void> | void;
    onProgress?: (p: SyncProgress) => void;
    pacingMs?: number;
    signal?: AbortSignal;
  },
): Promise<SyncResult> {
  const pacing = handlers.pacingMs ?? 150;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    if (handlers.signal?.aborted) break;
    const entry = entries[i];
    handlers.onProgress?.({
      current: i + 1,
      total: entries.length,
      currentName: entry.displayName,
    });

    const record = await fetchPokemonUsage(
      entry.showdownId,
      entry.displayName,
      format,
      season,
    );
    if (record) {
      await handlers.onRecord(record);
      succeeded++;
    } else {
      failed++;
    }

    if (i < entries.length - 1) await delay(pacing);
  }

  return {
    succeeded,
    failed,
    season,
    attribution: ATTRIBUTION,
    attributionUrl: ATTRIBUTION_URL,
  };
}
