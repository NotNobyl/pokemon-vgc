import { useState, useEffect, useCallback } from 'react';
import type { Team } from '@/types/team';
import type { Pokemon, Move, PokemonType } from '@/types/pokemon';
import type { Weather, Terrain, DamageResult } from '@/types/matchup';
import { calcAllStats } from '@/types/team';
import { NATURE_MAP } from '@/types/pokemon';
import { searchPokemon, getMovesByNames } from '@/db/pokemon-cache';
import { calculateDamage, formatDamageResult } from '@/engine/damage-calc';
import type { DamageCalcInput } from '@/engine/damage-calc';
import { useTeamPokemon } from '@/modules/team-builder/hooks/useTeamPokemon';

interface DamageCalcProps {
  myTeam?: Team;
}

interface PokemonPanel {
  pokemon: Pokemon | null;
  level: number;
  ability: string;
  item: string;
  statBoosts: { attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number };
  teraType?: PokemonType;
  terastallized: boolean;
  status: string;
  evs: { hp: number; attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number };
  ivs: { hp: number; attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number };
  nature: string;
}

const DEFAULT_PANEL: PokemonPanel = {
  pokemon: null,
  level: 50,
  ability: '',
  item: '',
  statBoosts: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
  terastallized: false,
  status: '',
  evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
  ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
  nature: 'adamant',
};

const WEATHERS: Weather[] = ['none', 'sun', 'rain', 'sand', 'snow'];
const TERRAINS: Terrain[] = ['none', 'electric', 'grassy', 'psychic', 'misty'];
const BOOST_STAGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

export default function DamageCalc({ myTeam }: DamageCalcProps) {
  const [attacker, setAttacker] = useState<PokemonPanel>({ ...DEFAULT_PANEL });
  const [defender, setDefender] = useState<PokemonPanel>({ ...DEFAULT_PANEL });
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [attackerMoves, setAttackerMoves] = useState<Move[]>([]);
  const [weather, setWeather] = useState<Weather>('none');
  const [terrain, setTerrain] = useState<Terrain>('none');
  const [screens, setScreens] = useState({ reflect: false, lightScreen: false, auroraVeil: false });
  const [isSpread, setIsSpread] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [result, setResult] = useState<DamageResult | null>(null);
  const [attackerSearch, setAttackerSearch] = useState('');
  const [defenderSearch, setDefenderSearch] = useState('');
  const [attackerResults, setAttackerResults] = useState<Pokemon[]>([]);
  const [defenderResults, setDefenderResults] = useState<Pokemon[]>([]);

  const { pokemonMap } = useTeamPokemon(myTeam?.members ?? []);

  // Load moves when attacker changes
  useEffect(() => {
    if (!attacker.pokemon) {
      setAttackerMoves([]);
      return;
    }
    let cancelled = false;
    void getMovesByNames(attacker.pokemon.movepool.slice(0, 50)).then((moves) => {
      if (!cancelled) setAttackerMoves(moves);
    });
    return () => { cancelled = true; };
  }, [attacker.pokemon]);

  const handleSearch = useCallback(async (query: string, side: 'attacker' | 'defender') => {
    if (side === 'attacker') {
      setAttackerSearch(query);
      if (query.length >= 2) {
        const results = await searchPokemon(query, 8);
        setAttackerResults(results);
      } else {
        setAttackerResults([]);
      }
    } else {
      setDefenderSearch(query);
      if (query.length >= 2) {
        const results = await searchPokemon(query, 8);
        setDefenderResults(results);
      } else {
        setDefenderResults([]);
      }
    }
  }, []);

  const selectPokemon = (pokemon: Pokemon, side: 'attacker' | 'defender') => {
    const panel: PokemonPanel = {
      ...DEFAULT_PANEL,
      pokemon,
      ability: pokemon.abilities[0] ?? '',
      evs: { hp: 252, attack: 252, defense: 4, specialAttack: 252, specialDefense: 4, speed: 252 },
    };
    if (side === 'attacker') {
      setAttacker(panel);
      setAttackerSearch('');
      setAttackerResults([]);
      setSelectedMove(null);
    } else {
      setDefender(panel);
      setDefenderSearch('');
      setDefenderResults([]);
    }
  };

  const selectTeamMember = (pokemonId: number, side: 'attacker' | 'defender') => {
    const pokemon = pokemonMap.get(pokemonId);
    if (!pokemon || !myTeam) return;
    const member = myTeam.members.find((m) => m.pokemonId === pokemonId);
    if (!member) return;
    const panel: PokemonPanel = {
      ...DEFAULT_PANEL,
      pokemon,
      level: member.level,
      ability: member.ability,
      item: member.item,
      evs: { ...member.evs },
      ivs: { ...member.ivs },
      nature: member.nature,
      teraType: member.teraType,
    };
    if (side === 'attacker') {
      setAttacker(panel);
      setAttackerSearch('');
      setAttackerResults([]);
      setSelectedMove(null);
    } else {
      setDefender(panel);
      setDefenderSearch('');
      setDefenderResults([]);
    }
  };

  const calcStats = (panel: PokemonPanel) => {
    if (!panel.pokemon) return null;
    const natureMod = NATURE_MAP[panel.nature as keyof typeof NATURE_MAP] ?? {};
    const multiplier: Record<string, number> = {
      hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1,
    };
    if (natureMod.plus) multiplier[natureMod.plus] = 1.1;
    if (natureMod.minus) multiplier[natureMod.minus] = 0.9;
    return calcAllStats(panel.pokemon.baseStats, panel.evs, panel.ivs, panel.level, multiplier as Record<keyof typeof panel.pokemon.baseStats, number>);
  };

  const calculate = () => {
    if (!attacker.pokemon || !defender.pokemon || !selectedMove) return;
    const atkStats = calcStats(attacker);
    const defStats = calcStats(defender);
    if (!atkStats || !defStats) return;

    const input: DamageCalcInput = {
      attackerLevel: attacker.level,
      attackStat: selectedMove.category === 'physical' ? atkStats.attack : atkStats.specialAttack,
      attackerTypes: attacker.pokemon.types,
      attackerAbility: attacker.ability,
      attackerItem: attacker.item,
      attackerStatus: attacker.status || undefined,
      attackerStatBoost: selectedMove.category === 'physical' ? attacker.statBoosts.attack : attacker.statBoosts.specialAttack,
      attackerTeraType: attacker.terastallized ? attacker.teraType : undefined,
      attackerTerastallized: attacker.terastallized,
      defenseStat: selectedMove.category === 'physical' ? defStats.defense : defStats.specialDefense,
      defenderTypes: defender.pokemon.types,
      defenderAbility: defender.ability,
      defenderItem: defender.item,
      defenderMaxHp: defStats.hp,
      defenderCurrentHp: defStats.hp,
      defenderStatBoost: selectedMove.category === 'physical' ? defender.statBoosts.defense : defender.statBoosts.specialDefense,
      defenderTeraType: defender.terastallized ? defender.teraType : undefined,
      defenderTerastallized: defender.terastallized,
      move: selectedMove,
      weather,
      terrain,
      screens,
      isCritical,
      isSpread,
    };

    setResult(calculateDamage(input));
  };

  // Auto-calculate when inputs change
  useEffect(() => {
    calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attacker, defender, selectedMove, weather, terrain, screens, isCritical, isSpread]);

  const getKoColor = (res: DamageResult) => {
    if (res.koChance === 'OHKO') return 'text-green-400';
    if (res.koChance === '2HKO') return 'text-yellow-400';
    return 'text-red-400';
  };

  const renderPanel = (panel: PokemonPanel, side: 'attacker' | 'defender') => {
    const stats = calcStats(panel);
    const search = side === 'attacker' ? attackerSearch : defenderSearch;
    const results = side === 'attacker' ? attackerResults : defenderResults;

    return (
      <div className="card space-y-3">
        <h3 className="text-lg font-semibold capitalize">{side}</h3>

        {/* Team quick-select */}
        {myTeam && myTeam.members.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {myTeam.members.map((m) => {
              const p = pokemonMap.get(m.pokemonId);
              return (
                <button
                  key={m.id}
                  onClick={() => selectTeamMember(m.pokemonId, side)}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded capitalize"
                >
                  {p?.name ?? `#${m.pokemonId}`}
                </button>
              );
            })}
          </div>
        )}

        {/* Pokemon search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search Pokémon..."
            value={search}
            onChange={(e) => void handleSearch(e.target.value, side)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          />
          {results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded max-h-40 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPokemon(p, side)}
                  className="w-full px-3 py-1 text-left text-sm hover:bg-gray-600 capitalize"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {panel.pokemon && (
          <>
            <div className="flex items-center gap-2">
              <span className="capitalize font-medium">{panel.pokemon.name}</span>
              <span className="text-xs text-gray-400">
                {panel.pokemon.types.join(' / ')}
              </span>
            </div>

            {/* Stats display */}
            {stats && (
              <div className="grid grid-cols-3 gap-1 text-xs">
                <span>HP: {stats.hp}</span>
                <span>Atk: {stats.attack}</span>
                <span>Def: {stats.defense}</span>
                <span>SpA: {stats.specialAttack}</span>
                <span>SpD: {stats.specialDefense}</span>
                <span>Spe: {stats.speed}</span>
              </div>
            )}

            {/* Ability & Item */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">Ability</label>
                <select
                  value={panel.ability}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (side === 'attacker') setAttacker((p) => ({ ...p, ability: val }));
                    else setDefender((p) => ({ ...p, ability: val }));
                  }}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                >
                  {panel.pokemon.abilities.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Item</label>
                <input
                  type="text"
                  value={panel.item}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (side === 'attacker') setAttacker((p) => ({ ...p, item: val }));
                    else setDefender((p) => ({ ...p, item: val }));
                  }}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                  placeholder="Item"
                />
              </div>
            </div>

            {/* Stat Boosts */}
            <div>
              <label className="text-xs text-gray-400">Stat Boosts</label>
              <div className="grid grid-cols-3 gap-1 text-xs">
                {(['attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const).map((stat) => (
                  <div key={stat} className="flex items-center gap-1">
                    <span className="w-8 capitalize">{stat.slice(0, 3)}</span>
                    <select
                      value={panel.statBoosts[stat]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (side === 'attacker') setAttacker((p) => ({ ...p, statBoosts: { ...p.statBoosts, [stat]: val } }));
                        else setDefender((p) => ({ ...p, statBoosts: { ...p.statBoosts, [stat]: val } }));
                      }}
                      className="flex-1 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded"
                    >
                      {BOOST_STAGES.map((s) => (
                        <option key={s} value={s}>{s > 0 ? `+${s}` : s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Tera */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={panel.terastallized}
                  onChange={(e) => {
                    const val = e.target.checked;
                    if (side === 'attacker') setAttacker((p) => ({ ...p, terastallized: val }));
                    else setDefender((p) => ({ ...p, terastallized: val }));
                  }}
                />
                Tera
              </label>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPanel(attacker, 'attacker')}
        {renderPanel(defender, 'defender')}
      </div>

      {/* Move selector */}
      {attacker.pokemon && (
        <div className="card space-y-2">
          <h3 className="text-sm font-semibold">Move</h3>
          <select
            value={selectedMove?.name ?? ''}
            onChange={(e) => {
              const move = attackerMoves.find((m) => m.name === e.target.value);
              setSelectedMove(move ?? null);
            }}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          >
            <option value="">Select a move...</option>
            {attackerMoves.filter((m) => m.category !== 'status').map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.type}, {m.basePower} BP)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Field conditions */}
      <div className="card space-y-2">
        <h3 className="text-sm font-semibold">Field Conditions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-gray-400">Weather</label>
            <select
              value={weather}
              onChange={(e) => setWeather(e.target.value as Weather)}
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              {WEATHERS.map((w) => (
                <option key={w} value={w} className="capitalize">{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Terrain</label>
            <select
              value={terrain}
              onChange={(e) => setTerrain(e.target.value as Terrain)}
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              {TERRAINS.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Screens</label>
            <div className="flex flex-col gap-0.5">
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={screens.reflect} onChange={(e) => setScreens((s) => ({ ...s, reflect: e.target.checked }))} />
                Reflect
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={screens.lightScreen} onChange={(e) => setScreens((s) => ({ ...s, lightScreen: e.target.checked }))} />
                Light Screen
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={screens.auroraVeil} onChange={(e) => setScreens((s) => ({ ...s, auroraVeil: e.target.checked }))} />
                Aurora Veil
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Modifiers</label>
            <div className="flex flex-col gap-0.5">
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={isSpread} onChange={(e) => setIsSpread(e.target.checked)} />
                Spread
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={isCritical} onChange={(e) => setIsCritical(e.target.checked)} />
                Critical Hit
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-2">Result</h3>
          <div className={`text-xl font-bold ${getKoColor(result)}`}>
            {result.koChance}
            {result.ohkoPercent !== undefined && ` (${result.ohkoPercent}%)`}
          </div>
          <p className="text-gray-300 mt-1">{formatDamageResult(result)}</p>
          <div className="mt-2 w-full bg-gray-700 rounded h-4 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${Math.min(100, result.maxPercent)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {result.minPercent}% – {result.maxPercent}% HP
          </p>
        </div>
      )}
    </div>
  );
}
