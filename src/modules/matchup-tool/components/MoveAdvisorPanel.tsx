import { useState, useEffect, useCallback } from 'react';
import type { Team, TeamMember } from '@/types/team';
import type { Pokemon, Move } from '@/types/pokemon';
import type { OpponentTeam, BoardState, ActivePokemon, MoveAdvice, Weather, Terrain } from '@/types/matchup';
import { DEFAULT_STAT_BOOSTS } from '@/types/matchup';
import { calcAllStats } from '@/types/team';
import { NATURE_MAP } from '@/types/pokemon';
import { getPokemonById, getMovesByNames } from '@/db/pokemon-cache';
import { adviseMoves } from '@/engine/move-advisor';
import type { MoveAdvisorInput } from '@/engine/move-advisor';
import { useTeamPokemon } from '@/modules/team-builder/hooks/useTeamPokemon';

interface MoveAdvisorPanelProps {
  myTeam: Team;
  opponentTeam?: OpponentTeam;
}

const WEATHERS: Weather[] = ['none', 'sun', 'rain', 'sand', 'snow'];
const TERRAINS: Terrain[] = ['none', 'electric', 'grassy', 'psychic', 'misty'];
const BOOST_STAGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

export default function MoveAdvisorPanel({ myTeam, opponentTeam }: MoveAdvisorPanelProps) {
  const { pokemonMap } = useTeamPokemon(myTeam.members);
  const [oppPokemonData, setOppPokemonData] = useState<Map<number, Pokemon>>(new Map());

  const [mySlot1, setMySlot1] = useState<string>('');
  const [mySlot2, setMySlot2] = useState<string>('');
  const [theirSlot1, setTheirSlot1] = useState<number | null>(null);
  const [theirSlot2, setTheirSlot2] = useState<number | null>(null);

  const [hpSlot1, setHpSlot1] = useState(100);
  const [hpSlot2, setHpSlot2] = useState(100);
  const [hpOpp1, setHpOpp1] = useState(100);
  const [hpOpp2, setHpOpp2] = useState(100);

  const [weather, setWeather] = useState<Weather>('none');
  const [terrain, setTerrain] = useState<Terrain>('none');
  const [screens, setScreens] = useState({ reflect: false, lightScreen: false, auroraVeil: false });
  const [trickRoom, setTrickRoom] = useState(false);
  const [tailwindMy, setTailwindMy] = useState(false);
  const [tailwindTheirs, setTailwindTheirs] = useState(false);
  const [turn, setTurn] = useState(1);

  const [myBoosts1, setMyBoosts1] = useState({ ...DEFAULT_STAT_BOOSTS });
  const [myBoosts2, setMyBoosts2] = useState({ ...DEFAULT_STAT_BOOSTS });
  const [oppBoosts1, setOppBoosts1] = useState({ ...DEFAULT_STAT_BOOSTS });
  const [oppBoosts2, setOppBoosts2] = useState({ ...DEFAULT_STAT_BOOSTS });

  const [advice, setAdvice] = useState<[MoveAdvice[], MoveAdvice[]] | null>(null);

  // Load opponent Pokemon data
  useEffect(() => {
    if (!opponentTeam) return;
    let cancelled = false;
    async function loadOppData() {
      const map = new Map<number, Pokemon>();
      for (const m of opponentTeam!.members) {
        const p = await getPokemonById(m.pokemonId);
        if (p && !cancelled) map.set(p.id, p);
      }
      if (!cancelled) setOppPokemonData(map);
    }
    void loadOppData();
    return () => { cancelled = true; };
  }, [opponentTeam]);

  const buildActivePokemon = useCallback((
    member: TeamMember,
    pokemon: Pokemon,
    hpPercent: number,
    boosts: typeof DEFAULT_STAT_BOOSTS,
  ): ActivePokemon => {
    const natureMod = NATURE_MAP[member.nature] ?? {};
    const mult: Record<string, number> = { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 };
    if (natureMod.plus) mult[natureMod.plus] = 1.1;
    if (natureMod.minus) mult[natureMod.minus] = 0.9;
    const stats = calcAllStats(pokemon.baseStats, member.evs, member.ivs, member.level, mult as Record<keyof typeof pokemon.baseStats, number>);
    const maxHp = stats.hp;
    return {
      teamMemberId: member.id,
      pokemonId: pokemon.id,
      name: pokemon.name,
      types: pokemon.types,
      currentHp: Math.floor(maxHp * hpPercent / 100),
      maxHp,
      stats,
      statBoosts: boosts,
      terastallized: false,
      ability: member.ability,
      item: member.item,
      moves: member.moves,
    };
  }, []);

  const buildOppActivePokemon = useCallback((
    pokemonId: number,
    hpPercent: number,
    boosts: typeof DEFAULT_STAT_BOOSTS,
  ): ActivePokemon | null => {
    const pokemon = oppPokemonData.get(pokemonId);
    if (!pokemon) return null;
    const oppMember = opponentTeam?.members.find((m) => m.pokemonId === pokemonId);
    const stats = calcAllStats(
      pokemon.baseStats,
      { hp: 252, attack: 252, defense: 4, specialAttack: 252, specialDefense: 4, speed: 252 },
      { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
      50,
      { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 },
    );
    const maxHp = stats.hp;
    return {
      teamMemberId: `opp-${pokemonId}`,
      pokemonId: pokemon.id,
      name: pokemon.name,
      types: pokemon.types,
      currentHp: Math.floor(maxHp * hpPercent / 100),
      maxHp,
      stats,
      statBoosts: boosts,
      terastallized: false,
      ability: oppMember?.knownAbility ?? pokemon.abilities[0] ?? '',
      item: oppMember?.knownItem ?? '',
      moves: oppMember?.knownMoves ?? [],
    };
  }, [oppPokemonData, opponentTeam]);

  const getAdvice = useCallback(async () => {
    const member1 = myTeam.members.find((m) => m.id === mySlot1);
    const member2 = myTeam.members.find((m) => m.id === mySlot2);
    if (!member1 || !member2) return;

    const pokemon1 = pokemonMap.get(member1.pokemonId);
    const pokemon2 = pokemonMap.get(member2.pokemonId);
    if (!pokemon1 || !pokemon2) return;

    const active1 = buildActivePokemon(member1, pokemon1, hpSlot1, myBoosts1);
    const active2 = buildActivePokemon(member2, pokemon2, hpSlot2, myBoosts2);

    const opp1 = theirSlot1 !== null ? buildOppActivePokemon(theirSlot1, hpOpp1, oppBoosts1) : null;
    const opp2 = theirSlot2 !== null ? buildOppActivePokemon(theirSlot2, hpOpp2, oppBoosts2) : null;

    const boardState: BoardState = {
      myActive: [active1, active2],
      theirActive: [opp1, opp2],
      myBench: [],
      theirBench: [],
      weather,
      terrain,
      screens,
      trickRoom,
      tailwind: { my: tailwindMy, theirs: tailwindTheirs },
      turn,
    };

    // Load moves for both slots
    const moves1 = await getMovesByNames(member1.moves.filter(Boolean));
    const moves2 = await getMovesByNames(member2.moves.filter(Boolean));

    const movesData = new Map<string, Move>();
    for (const m of [...moves1, ...moves2]) {
      movesData.set(m.name, m);
    }

    const input: MoveAdvisorInput = {
      boardState,
      myMoves: [moves1, moves2],
      movesData,
    };

    const result = adviseMoves(input);
    setAdvice(result);
  }, [myTeam, mySlot1, mySlot2, theirSlot1, theirSlot2, hpSlot1, hpSlot2, hpOpp1, hpOpp2, weather, terrain, screens, trickRoom, tailwindMy, tailwindTheirs, turn, myBoosts1, myBoosts2, oppBoosts1, oppBoosts2, pokemonMap, buildActivePokemon, buildOppActivePokemon]);

  const renderBoostDropdowns = (
    boosts: typeof DEFAULT_STAT_BOOSTS,
    setBoosts: React.Dispatch<React.SetStateAction<typeof DEFAULT_STAT_BOOSTS>>,
    label: string,
  ) => (
    <div className="space-y-1">
      <span className="text-xs text-gray-400">{label} Boosts</span>
      <div className="grid grid-cols-3 gap-1">
        {(['attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const).map((stat) => (
          <div key={stat} className="flex items-center gap-1 text-xs">
            <span className="w-8">{stat.slice(0, 3)}</span>
            <select
              value={boosts[stat]}
              onChange={(e) => setBoosts((prev) => ({ ...prev, [stat]: Number(e.target.value) }))}
              className="flex-1 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs"
            >
              {BOOST_STAGES.map((s) => (
                <option key={s} value={s}>{s > 0 ? `+${s}` : s}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Board Setup */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold">Board State Setup</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* My active slots */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-green-400">My Active</h4>
            <div>
              <label className="text-xs text-gray-400">Slot 1</label>
              <select
                value={mySlot1}
                onChange={(e) => setMySlot1(e.target.value)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
              >
                <option value="">Select...</option>
                {myTeam.members.map((m) => {
                  const p = pokemonMap.get(m.pokemonId);
                  return <option key={m.id} value={m.id}>{p?.name ?? `#${m.pokemonId}`}</option>;
                })}
              </select>
              <div className="mt-1">
                <label className="text-xs text-gray-400">HP %</label>
                <input
                  type="range" min={1} max={100} value={hpSlot1}
                  onChange={(e) => setHpSlot1(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{hpSlot1}%</span>
              </div>
              {renderBoostDropdowns(myBoosts1, setMyBoosts1, 'Slot 1')}
            </div>
            <div>
              <label className="text-xs text-gray-400">Slot 2</label>
              <select
                value={mySlot2}
                onChange={(e) => setMySlot2(e.target.value)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
              >
                <option value="">Select...</option>
                {myTeam.members.map((m) => {
                  const p = pokemonMap.get(m.pokemonId);
                  return <option key={m.id} value={m.id}>{p?.name ?? `#${m.pokemonId}`}</option>;
                })}
              </select>
              <div className="mt-1">
                <label className="text-xs text-gray-400">HP %</label>
                <input
                  type="range" min={1} max={100} value={hpSlot2}
                  onChange={(e) => setHpSlot2(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{hpSlot2}%</span>
              </div>
              {renderBoostDropdowns(myBoosts2, setMyBoosts2, 'Slot 2')}
            </div>
          </div>

          {/* Their active slots */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-red-400">Their Active</h4>
            {opponentTeam ? (
              <>
                <div>
                  <label className="text-xs text-gray-400">Slot 1</label>
                  <select
                    value={theirSlot1 ?? ''}
                    onChange={(e) => setTheirSlot1(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                  >
                    <option value="">Select...</option>
                    {opponentTeam.members.map((m) => (
                      <option key={m.pokemonId} value={m.pokemonId}>{m.name}</option>
                    ))}
                  </select>
                  <div className="mt-1">
                    <label className="text-xs text-gray-400">HP %</label>
                    <input
                      type="range" min={1} max={100} value={hpOpp1}
                      onChange={(e) => setHpOpp1(Number(e.target.value))}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-400">{hpOpp1}%</span>
                  </div>
                  {renderBoostDropdowns(oppBoosts1, setOppBoosts1, 'Opp Slot 1')}
                </div>
                <div>
                  <label className="text-xs text-gray-400">Slot 2</label>
                  <select
                    value={theirSlot2 ?? ''}
                    onChange={(e) => setTheirSlot2(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                  >
                    <option value="">Select...</option>
                    {opponentTeam.members.map((m) => (
                      <option key={m.pokemonId} value={m.pokemonId}>{m.name}</option>
                    ))}
                  </select>
                  <div className="mt-1">
                    <label className="text-xs text-gray-400">HP %</label>
                    <input
                      type="range" min={1} max={100} value={hpOpp2}
                      onChange={(e) => setHpOpp2(Number(e.target.value))}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-400">{hpOpp2}%</span>
                  </div>
                  {renderBoostDropdowns(oppBoosts2, setOppBoosts2, 'Opp Slot 2')}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400">Select an opponent team from the Scouting Log to use the Move Advisor.</p>
            )}
          </div>
        </div>

        {/* Field conditions */}
        <div className="border-t border-gray-700 pt-3">
          <h4 className="text-sm font-medium mb-2">Field Conditions</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-400">Weather</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value as Weather)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
              >
                {WEATHERS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Terrain</label>
              <select
                value={terrain}
                onChange={(e) => setTerrain(e.target.value as Terrain)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
              >
                {TERRAINS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Toggles</label>
              <div className="flex flex-col gap-0.5 text-xs">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={trickRoom} onChange={(e) => setTrickRoom(e.target.checked)} />
                  Trick Room
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={tailwindMy} onChange={(e) => setTailwindMy(e.target.checked)} />
                  My Tailwind
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={tailwindTheirs} onChange={(e) => setTailwindTheirs(e.target.checked)} />
                  Their Tailwind
                </label>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Screens</label>
              <div className="flex flex-col gap-0.5 text-xs">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={screens.reflect} onChange={(e) => setScreens((s) => ({ ...s, reflect: e.target.checked }))} />
                  Reflect
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={screens.lightScreen} onChange={(e) => setScreens((s) => ({ ...s, lightScreen: e.target.checked }))} />
                  Light Screen
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={screens.auroraVeil} onChange={(e) => setScreens((s) => ({ ...s, auroraVeil: e.target.checked }))} />
                  Aurora Veil
                </label>
              </div>
            </div>
          </div>
          <div className="mt-2">
            <label className="text-xs text-gray-400">Turn</label>
            <input
              type="number" min={1} max={20} value={turn}
              onChange={(e) => setTurn(Number(e.target.value))}
              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm ml-2"
            />
          </div>
        </div>

        <button
          onClick={() => void getAdvice()}
          disabled={!mySlot1 || !mySlot2}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium text-sm"
        >
          Get Advice
        </button>
      </div>

      {/* Results */}
      {advice && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {advice.map((slotAdvice, slotIdx) => (
            <div key={slotIdx} className="card">
              <h4 className="text-sm font-semibold mb-2">Slot {slotIdx + 1} Suggestions</h4>
              {slotAdvice.length === 0 ? (
                <p className="text-xs text-gray-400">No suggestions available</p>
              ) : (
                <div className="space-y-2">
                  {slotAdvice.map((a, i) => (
                    <div key={i} className="p-2 bg-gray-700/50 rounded">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm capitalize">{a.move}</span>
                        <span className="text-xs text-gray-400">Score: {a.score}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Target: {a.target}</p>
                      <p className="text-xs text-gray-300 mt-1">{a.reasoning}</p>
                      {a.damageResult && (
                        <p className={`text-xs mt-1 ${a.damageResult.koChance === 'OHKO' ? 'text-green-400' : a.damageResult.koChance === '2HKO' ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {a.damageResult.minPercent}–{a.damageResult.maxPercent}% ({a.damageResult.koChance})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
