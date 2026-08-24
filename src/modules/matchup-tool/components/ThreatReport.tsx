import { useState, useEffect, useCallback } from 'react';
import type { Team } from '@/types/team';
import type { Pokemon, Move } from '@/types/pokemon';
import type { DamageResult, OpponentPokemon, ThreatEntry } from '@/types/matchup';
import { calcAllStats } from '@/types/team';
import { NATURE_MAP } from '@/types/pokemon';
import { searchPokemon, getPokemonById, getMovesByNames } from '@/db/pokemon-cache';
import { calculateDamage } from '@/engine/damage-calc';
import type { DamageCalcInput } from '@/engine/damage-calc';
import { calcBaseSpeed, compareSpeed } from '@/engine/speed-calc';
import { useTeamPokemon } from '@/modules/team-builder/hooks/useTeamPokemon';
import { useOpponentPokemon } from '../hooks/useOpponentPokemon';

interface ThreatReportProps {
  myTeam: Team;
}

export default function ThreatReport({ myTeam }: ThreatReportProps) {
  const { pokemonMap } = useTeamPokemon(myTeam.members);
  const { opponents, addOpponent, removeOpponent, clearOpponents } = useOpponentPokemon();
  const [opponentData, setOpponentData] = useState<Map<number, Pokemon>>(new Map());
  const [threatMatrix, setThreatMatrix] = useState<ThreatEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Pokemon[]>([]);
  const [suggestedBring4, setSuggestedBring4] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load opponent Pokemon data
  useEffect(() => {
    let cancelled = false;
    async function loadOpponentData() {
      const map = new Map<number, Pokemon>();
      for (const opp of opponents) {
        if (!map.has(opp.pokemonId)) {
          const p = await getPokemonById(opp.pokemonId);
          if (p && !cancelled) map.set(p.id, p);
        }
      }
      if (!cancelled) setOpponentData(map);
    }
    void loadOpponentData();
    return () => { cancelled = true; };
  }, [opponents]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      const results = await searchPokemon(query, 8);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, []);

  const addOpponentFromSearch = (pokemon: Pokemon) => {
    const opp: OpponentPokemon = {
      pokemonId: pokemon.id,
      name: pokemon.name,
    };
    addOpponent(opp);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Generate threat matrix
  useEffect(() => {
    if (myTeam.members.length === 0 || opponents.length === 0) {
      setThreatMatrix([]);
      setSuggestedBring4([]);
      return;
    }
    let cancelled = false;

    async function generateMatrix() {
      setLoading(true);
      const entries: ThreatEntry[] = [];
      const memberScores = new Map<string, number>();

      for (const member of myTeam.members) {
        const myPokemon = pokemonMap.get(member.pokemonId);
        if (!myPokemon) continue;

        const natureMod = NATURE_MAP[member.nature] ?? {};
        const mult: Record<string, number> = { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 };
        if (natureMod.plus) mult[natureMod.plus] = 1.1;
        if (natureMod.minus) mult[natureMod.minus] = 0.9;
        const myStats = calcAllStats(myPokemon.baseStats, member.evs, member.ivs, member.level, mult as Record<keyof typeof myPokemon.baseStats, number>);
        const mySpeed = calcBaseSpeed(myPokemon.baseStats, member.evs, member.ivs, member.nature, member.level);

        // Get STAB moves for my Pokemon
        const myMoveNames = member.moves.filter(Boolean);
        const myMoves = await getMovesByNames(myMoveNames);
        const myStabMoves = myMoves.filter((m) =>
          m.category !== 'status' && myPokemon.types.includes(m.type)
        );
        const myBestMoves = myStabMoves.length > 0 ? myStabMoves : myMoves.filter((m) => m.category !== 'status');

        for (const opp of opponents) {
          const oppPokemon = opponentData.get(opp.pokemonId);
          if (!oppPokemon) continue;

          // Assume standard 252/252 spread for opponent
          const oppStats = calcAllStats(
            oppPokemon.baseStats,
            { hp: 252, attack: 252, defense: 4, specialAttack: 252, specialDefense: 4, speed: 252 },
            { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
            50,
            { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 },
          );
          const oppSpeed = calcBaseSpeed(
            oppPokemon.baseStats,
            { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 252 },
            { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
            'jolly', 50,
          );

          // I threaten them — best result from my STAB moves
          let iThreatenThem: DamageResult | null = null;
          for (const move of myBestMoves) {
            const input: DamageCalcInput = {
              attackerLevel: member.level,
              attackStat: move.category === 'physical' ? myStats.attack : myStats.specialAttack,
              attackerTypes: myPokemon.types,
              attackerAbility: member.ability,
              attackerItem: member.item,
              attackerStatBoost: 0,
              attackerTerastallized: false,
              defenseStat: move.category === 'physical' ? oppStats.defense : oppStats.specialDefense,
              defenderTypes: oppPokemon.types,
              defenderAbility: opp.knownAbility ?? oppPokemon.abilities[0] ?? '',
              defenderItem: opp.knownItem ?? '',
              defenderMaxHp: oppStats.hp,
              defenderCurrentHp: oppStats.hp,
              defenderStatBoost: 0,
              defenderTerastallized: false,
              move,
              weather: 'none',
              terrain: 'none',
              screens: { reflect: false, lightScreen: false, auroraVeil: false },
              isCritical: false,
              isSpread: false,
            };
            const res = calculateDamage(input);
            if (!iThreatenThem || res.maxPercent > iThreatenThem.maxPercent) {
              iThreatenThem = res;
            }
          }

          // They threaten me — use opponent's STAB types with generic 90BP move
          let theyThreatenMe: DamageResult | null = null;
          const oppMoveTypes = oppPokemon.types;
          for (const moveType of oppMoveTypes) {
            const genericMove: Pick<Move, 'name' | 'type' | 'category' | 'basePower' | 'targets'> = {
              name: 'Generic STAB',
              type: moveType,
              category: oppPokemon.baseStats.attack >= oppPokemon.baseStats.specialAttack ? 'physical' : 'special',
              basePower: 90,
              targets: 'single',
            };
            const atkStat = genericMove.category === 'physical' ? oppStats.attack : oppStats.specialAttack;
            const defStat = genericMove.category === 'physical' ? myStats.defense : myStats.specialDefense;
            const input: DamageCalcInput = {
              attackerLevel: 50,
              attackStat: atkStat,
              attackerTypes: oppPokemon.types,
              attackerAbility: opp.knownAbility ?? oppPokemon.abilities[0] ?? '',
              attackerItem: opp.knownItem ?? '',
              attackerStatBoost: 0,
              attackerTerastallized: false,
              defenseStat: defStat,
              defenderTypes: myPokemon.types,
              defenderAbility: member.ability,
              defenderItem: member.item,
              defenderMaxHp: myStats.hp,
              defenderCurrentHp: myStats.hp,
              defenderStatBoost: 0,
              defenderTerastallized: false,
              move: genericMove,
              weather: 'none',
              terrain: 'none',
              screens: { reflect: false, lightScreen: false, auroraVeil: false },
              isCritical: false,
              isSpread: false,
            };
            const res = calculateDamage(input);
            if (!theyThreatenMe || res.maxPercent > theyThreatenMe.maxPercent) {
              theyThreatenMe = res;
            }
          }

          const speedResult = compareSpeed(mySpeed, oppSpeed, false);
          const speedComparison = speedResult === 'first' ? 'faster' as const : speedResult === 'second' ? 'slower' as const : 'tie' as const;

          entries.push({
            myPokemon: myPokemon.name,
            theirPokemon: oppPokemon.name,
            theyThreatenMe,
            iThreatenThem,
            speedComparison,
          });

          // Score for bring-4
          let score = memberScores.get(member.id) ?? 0;
          if (iThreatenThem && (iThreatenThem.koChance === 'OHKO' || iThreatenThem.koChance === '2HKO')) {
            score += 2;
          }
          if (theyThreatenMe && theyThreatenMe.koChance === 'OHKO') {
            score -= 1;
          }
          if (speedComparison === 'faster') score += 0.5;
          memberScores.set(member.id, score);
        }
      }

      if (!cancelled) {
        setThreatMatrix(entries);
        // Suggest bring-4
        const sorted = [...memberScores.entries()].sort((a, b) => b[1] - a[1]);
        const top4 = sorted.slice(0, 4).map(([memberId]) => {
          const m = myTeam.members.find((mem) => mem.id === memberId);
          const p = m ? pokemonMap.get(m.pokemonId) : undefined;
          return p?.name ?? memberId;
        });
        setSuggestedBring4(top4);
        setLoading(false);
      }
    }

    void generateMatrix();
    return () => { cancelled = true; };
  }, [myTeam, pokemonMap, opponents, opponentData]);

  const getThreatColor = (result: DamageResult | null, isMyThreat: boolean) => {
    if (!result) return 'text-gray-500';
    if (result.koChance === 'OHKO') return isMyThreat ? 'text-green-400' : 'text-red-400';
    if (result.koChance === '2HKO') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Opponent team input */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Opponent Team</h3>
          {opponents.length > 0 && (
            <button onClick={clearOpponents} className="text-xs text-red-400 hover:text-red-300">
              Clear All
            </button>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search Pokémon to add..."
            value={searchQuery}
            onChange={(e) => void handleSearch(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded max-h-40 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addOpponentFromSearch(p)}
                  className="w-full px-3 py-1 text-left text-sm hover:bg-gray-600 capitalize"
                >
                  {p.name} <span className="text-gray-400 text-xs">({p.types.join('/')})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {opponents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {opponents.map((opp, i) => (
              <div key={`${opp.pokemonId}-${i}`} className="flex items-center gap-1 bg-gray-700 px-2 py-1 rounded">
                <span className="text-sm capitalize">{opp.name}</span>
                <button onClick={() => removeOpponent(i)} className="text-red-400 hover:text-red-300 text-xs">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Threat Matrix */}
      {loading && <p className="text-gray-400 text-center">Generating threat matrix...</p>}

      {threatMatrix.length > 0 && !loading && (
        <div className="card overflow-x-auto">
          <h3 className="text-lg font-semibold mb-3">Threat Matrix</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-2 py-1 text-left">My Pokémon</th>
                <th className="px-2 py-1 text-left">vs</th>
                <th className="px-2 py-1 text-left">I Threaten</th>
                <th className="px-2 py-1 text-left">They Threaten</th>
                <th className="px-2 py-1 text-left">Speed</th>
              </tr>
            </thead>
            <tbody>
              {threatMatrix.map((entry, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="px-2 py-1 capitalize">{entry.myPokemon}</td>
                  <td className="px-2 py-1 capitalize">{entry.theirPokemon}</td>
                  <td className={`px-2 py-1 ${getThreatColor(entry.iThreatenThem, true)}`}>
                    {entry.iThreatenThem
                      ? `${entry.iThreatenThem.minPercent}–${entry.iThreatenThem.maxPercent}% (${entry.iThreatenThem.koChance})`
                      : '—'}
                  </td>
                  <td className={`px-2 py-1 ${getThreatColor(entry.theyThreatenMe, false)}`}>
                    {entry.theyThreatenMe
                      ? `${entry.theyThreatenMe.minPercent}–${entry.theyThreatenMe.maxPercent}% (${entry.theyThreatenMe.koChance})`
                      : '—'}
                  </td>
                  <td className="px-2 py-1">
                    <span className={entry.speedComparison === 'faster' ? 'text-green-400' : entry.speedComparison === 'slower' ? 'text-red-400' : 'text-yellow-400'}>
                      {entry.speedComparison}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suggested Bring 4 */}
      {suggestedBring4.length > 0 && !loading && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Suggested Bring 4</h3>
          <div className="flex flex-wrap gap-2">
            {suggestedBring4.map((name, i) => (
              <span key={i} className="px-3 py-1 bg-blue-900/50 border border-blue-700 rounded capitalize text-sm">
                {name}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Based on offensive threat coverage and defensive matchups against the opponent team.
          </p>
        </div>
      )}
    </div>
  );
}
