import type { Move } from '@/types/pokemon';
import type { ActivePokemon, BoardState, DamageResult, MoveAdvice } from '@/types/matchup';
import { calculateDamage, type DamageCalcInput } from './damage-calc';
import { calcEffectiveSpeed, compareSpeed } from './speed-calc';

export interface MoveAdvisorInput {
  boardState: BoardState;
  myMoves: [Move[], Move[]];  // moves for each of my two active slots
  movesData: Map<string, Move>; // lookup for all moves
}

interface ScoredMove {
  move: string;
  target: string;
  targetSlot: number;
  score: number;
  reasoning: string[];
  damageResult?: DamageResult;
}

/**
 * Score and rank all legal move options for both active Pokémon.
 * Returns top suggestion per slot with reasoning.
 */
export function adviseMoves(input: MoveAdvisorInput): [MoveAdvice[], MoveAdvice[]] {
  const { boardState } = input;
  const results: [MoveAdvice[], MoveAdvice[]] = [[], []];

  for (let slot = 0; slot < 2; slot++) {
    const myPokemon = boardState.myActive[slot];
    if (!myPokemon) continue;

    const moves = input.myMoves[slot];
    const scored: ScoredMove[] = [];

    for (const move of moves) {
      if (move.category === 'status') {
        // Score utility moves
        const utilityScore = scoreUtilityMove(move, myPokemon, boardState, slot);
        scored.push(utilityScore);
        continue;
      }

      // Score damaging moves against each target
      const targets = getValidTargets(move, slot, boardState);
      for (const target of targets) {
        const scoredMove = scoreDamagingMove(move, myPokemon, target, boardState, slot);
        scored.push(scoredMove);
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top 3 suggestions per slot
    results[slot as 0 | 1] = scored.slice(0, 3).map((s) => ({
      slot: slot as 0 | 1,
      move: s.move,
      target: s.target,
      score: s.score,
      reasoning: s.reasoning.join('; '),
      damageResult: s.damageResult,
    }));
  }

  return results;
}

function getValidTargets(
  move: Move,
  _mySlot: number,
  boardState: BoardState,
): { pokemon: ActivePokemon; slot: number; side: 'theirs' | 'mine' }[] {
  const targets: { pokemon: ActivePokemon; slot: number; side: 'theirs' | 'mine' }[] = [];

  if (move.targets === 'spread') {
    // Spread moves hit both opponents
    for (let i = 0; i < 2; i++) {
      const opp = boardState.theirActive[i];
      if (opp) targets.push({ pokemon: opp, slot: i, side: 'theirs' });
    }
  } else if (move.targets === 'single') {
    // Single target can hit either opponent
    for (let i = 0; i < 2; i++) {
      const opp = boardState.theirActive[i];
      if (opp) targets.push({ pokemon: opp, slot: i, side: 'theirs' });
    }
  }

  return targets;
}

function scoreDamagingMove(
  move: Move,
  attacker: ActivePokemon,
  target: { pokemon: ActivePokemon; slot: number; side: string },
  boardState: BoardState,
  _attackerSlot: number,
): ScoredMove {
  const reasoning: string[] = [];
  let score = 0;

  // Calculate damage
  const damageInput: DamageCalcInput = {
    attackerLevel: 50,
    attackStat: move.category === 'physical' ? attacker.stats.attack : attacker.stats.specialAttack,
    attackerTypes: attacker.types,
    attackerAbility: attacker.ability,
    attackerItem: attacker.item,
    attackerStatus: attacker.status,
    attackerStatBoost: move.category === 'physical' ? attacker.statBoosts.attack : attacker.statBoosts.specialAttack,
    attackerTeraType: attacker.teraType,
    attackerTerastallized: attacker.terastallized,
    defenseStat: move.category === 'physical' ? target.pokemon.stats.defense : target.pokemon.stats.specialDefense,
    defenderTypes: target.pokemon.types,
    defenderAbility: target.pokemon.ability,
    defenderItem: target.pokemon.item,
    defenderMaxHp: target.pokemon.maxHp,
    defenderCurrentHp: target.pokemon.currentHp,
    defenderStatBoost: move.category === 'physical' ? target.pokemon.statBoosts.defense : target.pokemon.statBoosts.specialDefense,
    defenderTeraType: target.pokemon.teraType,
    defenderTerastallized: target.pokemon.terastallized,
    move,
    weather: boardState.weather,
    terrain: boardState.terrain,
    screens: boardState.screens,
    isCritical: false,
    isSpread: move.targets === 'spread',
  };

  const damageResult = calculateDamage(damageInput);

  // Kill score: +100 if OHKO guaranteed
  if (damageResult.koChance === 'OHKO' && (!damageResult.ohkoPercent || damageResult.ohkoPercent === 100)) {
    score += 100;
    reasoning.push(`KOs ${target.pokemon.name} guaranteed`);
  } else if (damageResult.koChance === 'OHKO' && damageResult.ohkoPercent) {
    score += 60 + damageResult.ohkoPercent * 0.4;
    reasoning.push(`${damageResult.ohkoPercent}% chance to KO ${target.pokemon.name}`);
  } else {
    // Damage score: 0-50 based on % HP dealt
    const avgPercent = (damageResult.minPercent + damageResult.maxPercent) / 2;
    score += Math.min(50, avgPercent * 0.5);
    reasoning.push(`Deals ~${Math.round(avgPercent)}% to ${target.pokemon.name}`);
  }

  // Bonus for targeting Pokémon at low HP (secure the KO)
  const targetHpPercent = (target.pokemon.currentHp / target.pokemon.maxHp) * 100;
  if (targetHpPercent < 50 && damageResult.maxPercent >= targetHpPercent) {
    score += 20;
    reasoning.push('Finishes off weakened target');
  }

  // Protect prediction penalty
  // If the target is likely to Protect (was threatened last turn, just survived a big hit)
  if (targetHpPercent < 30) {
    score -= 10;
    reasoning.push('Target may Protect at low HP (slight penalty)');
  }

  // Speed advantage bonus — hitting a threat before it moves
  const mySpeed = calcEffectiveSpeed(attacker.stats.speed, {
    statStage: attacker.statBoosts.speed,
    tailwind: boardState.tailwind.my,
    trickRoom: boardState.trickRoom,
  });
  const theirSpeed = calcEffectiveSpeed(target.pokemon.stats.speed, {
    statStage: target.pokemon.statBoosts.speed,
    tailwind: boardState.tailwind.theirs,
    trickRoom: boardState.trickRoom,
  });

  if (compareSpeed(mySpeed, theirSpeed, boardState.trickRoom) === 'first') {
    score += 5;
    reasoning.push('Outspeeds target');
  }

  return {
    move: move.name,
    target: target.pokemon.name,
    targetSlot: target.slot,
    score: Math.round(score * 10) / 10,
    reasoning,
    damageResult,
  };
}

function scoreUtilityMove(
  move: Move,
  attacker: ActivePokemon,
  boardState: BoardState,
  _slot: number,
): ScoredMove {
  const reasoning: string[] = [];
  let score = 0;
  const moveName = move.name.toLowerCase().replace(/[\s-]/g, '');

  // Protect
  if (moveName === 'protect' || moveName === 'detect') {
    // High value if threatened and partner can act
    score += 30;
    reasoning.push('Protect stalls and scouts');

    // Higher value at low HP
    const hpPercent = (attacker.currentHp / attacker.maxHp) * 100;
    if (hpPercent < 50) {
      score += 15;
      reasoning.push('High value — preserving low-HP Pokémon');
    }
  }

  // Tailwind
  if (moveName === 'tailwind') {
    if (!boardState.tailwind.my) {
      score += 60;
      reasoning.push('Sets Tailwind for speed advantage');
    } else {
      score -= 20;
      reasoning.push('Tailwind already active');
    }
  }

  // Trick Room
  if (moveName === 'trickroom') {
    if (!boardState.trickRoom) {
      score += 55;
      reasoning.push('Sets Trick Room for speed control');
    } else {
      score += 30;
      reasoning.push('Removes opponent Trick Room');
    }
  }

  // Fake Out
  if (moveName === 'fakeout') {
    if (boardState.turn === 1) {
      score += 50;
      reasoning.push('Turn 1 Fake Out — disrupts opponent');
    } else {
      score -= 100; // Can only be used turn 1 after switch-in
      reasoning.push('Fake Out fails after turn 1');
    }
  }

  return {
    move: move.name,
    target: 'self/field',
    targetSlot: -1,
    score,
    reasoning,
  };
}
