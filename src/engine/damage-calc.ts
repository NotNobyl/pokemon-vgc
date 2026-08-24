import type { Move, PokemonType } from '@/types/pokemon';
import type { DamageResult, Weather, Terrain } from '@/types/matchup';
import { getEffectiveness } from './type-chart';

export interface DamageCalcInput {
  // Attacker
  attackerLevel: number;
  attackStat: number;         // effective attack or special attack (after nature/EVs/IVs)
  attackerTypes: [PokemonType] | [PokemonType, PokemonType];
  attackerAbility: string;
  attackerItem: string;
  attackerStatus?: string;
  attackerStatBoost: number;  // stage -6 to +6 for relevant attack stat
  attackerTeraType?: PokemonType;
  attackerTerastallized: boolean;

  // Defender
  defenseStat: number;        // effective defense or special defense
  defenderTypes: [PokemonType] | [PokemonType, PokemonType];
  defenderAbility: string;
  defenderItem: string;
  defenderMaxHp: number;
  defenderCurrentHp: number;
  defenderStatBoost: number;  // stage -6 to +6 for relevant defense stat
  defenderTeraType?: PokemonType;
  defenderTerastallized: boolean;

  // Move
  move: Pick<Move, 'name' | 'type' | 'category' | 'basePower' | 'targets'>;

  // Field conditions
  weather: Weather;
  terrain: Terrain;
  screens: { reflect: boolean; lightScreen: boolean; auroraVeil: boolean };
  isCritical: boolean;
  isSpread: boolean;          // targets multiple in doubles
}

const STAT_STAGE_MULTIPLIERS: Record<number, number> = {
  [-6]: 2/8, [-5]: 2/7, [-4]: 2/6, [-3]: 2/5, [-2]: 2/4, [-1]: 2/3,
  [0]: 1,
  [1]: 3/2, [2]: 4/2, [3]: 5/2, [4]: 6/2, [5]: 7/2, [6]: 8/2,
};

function getStatStageMultiplier(stage: number): number {
  return STAT_STAGE_MULTIPLIERS[stage] ?? 1;
}

/**
 * Core Gen 9 damage formula implementation.
 * Returns damage for a specific random roll (0.85 to 1.0).
 */
function calcDamageAtRoll(input: DamageCalcInput, roll: number): number {
  const { move, attackerLevel } = input;

  if (move.basePower === 0) return 0; // Status moves

  // Base damage
  let attack = input.attackStat;
  let defense = input.defenseStat;

  // Apply stat stages (crits ignore negative attack stages and positive defense stages)
  if (input.isCritical) {
    if (input.attackerStatBoost > 0) {
      attack = Math.floor(attack * getStatStageMultiplier(input.attackerStatBoost));
    }
    if (input.defenderStatBoost < 0) {
      defense = Math.floor(defense * getStatStageMultiplier(input.defenderStatBoost));
    }
  } else {
    attack = Math.floor(attack * getStatStageMultiplier(input.attackerStatBoost));
    defense = Math.floor(defense * getStatStageMultiplier(input.defenderStatBoost));
  }

  // Ability attack modifiers
  attack = applyAttackAbilityModifier(attack, input.attackerAbility, move.category);

  // Item attack modifiers
  attack = applyAttackItemModifier(attack, input.attackerItem, move.category);

  // Base formula: ((2 * level / 5 + 2) * power * A / D) / 50 + 2
  let basePower = move.basePower;

  // Type-boosting items
  basePower = applyBasePowerItemModifier(basePower, input.attackerItem, move.type);

  let damage = Math.floor(
    (Math.floor((2 * attackerLevel) / 5 + 2) * basePower * attack) / defense / 50 + 2,
  );

  // Spread move penalty (0.75x in doubles)
  if (input.isSpread) {
    damage = Math.floor(damage * 0.75);
  }

  // Weather
  damage = applyWeatherModifier(damage, move.type, input.weather);

  // Critical hit (1.5x)
  if (input.isCritical) {
    damage = Math.floor(damage * 1.5);
  }

  // Random roll (0.85 to 1.0)
  damage = Math.floor(damage * roll);

  // STAB
  damage = applyStabModifier(damage, move.type, input.attackerTypes, input.attackerAbility, input.attackerTerastallized, input.attackerTeraType);

  // Type effectiveness
  let defTypes = input.defenderTypes;
  if (input.defenderTerastallized && input.defenderTeraType) {
    defTypes = [input.defenderTeraType];
  }
  const effectiveness = getEffectiveness(move.type, defTypes);
  damage = Math.floor(damage * effectiveness);

  // Burn (halves physical damage, unless Guts)
  if (input.attackerStatus === 'burn' && move.category === 'physical' && input.attackerAbility !== 'guts') {
    damage = Math.floor(damage * 0.5);
  }

  // Screens
  damage = applyScreenModifier(damage, move.category, input.screens, input.isCritical);

  // Terrain
  damage = applyTerrainModifier(damage, move.type, input.terrain);

  // Defensive item modifiers
  damage = applyDefenseItemModifier(damage, input.defenderItem, move.category);

  return Math.max(1, damage);
}

function applyAttackAbilityModifier(attack: number, ability: string, category: string): number {
  const a = ability.toLowerCase().replace(/[\s-]/g, '');
  if ((a === 'hugepower' || a === 'purepower') && category === 'physical') {
    return Math.floor(attack * 2);
  }
  return attack;
}

function applyAttackItemModifier(attack: number, item: string, category: string): number {
  const i = item.toLowerCase().replace(/[\s-]/g, '');
  if (i === 'choiceband' && category === 'physical') return Math.floor(attack * 1.5);
  if (i === 'choicespecs' && category === 'special') return Math.floor(attack * 1.5);
  if (i === 'lifeorb') return Math.floor(attack * 1.3);
  return attack;
}

function applyBasePowerItemModifier(basePower: number, item: string, moveType: PokemonType): number {
  const i = item.toLowerCase().replace(/[\s-]/g, '');
  const typeItems: Record<string, PokemonType> = {
    charcoal: 'fire', mysticwater: 'water', magnet: 'electric',
    miracleseed: 'grass', nevermeltice: 'ice', blackbelt: 'fighting',
    poisonbarb: 'poison', softsand: 'ground', sharpbeak: 'flying',
    twistedspoon: 'psychic', silverpowder: 'bug', hardstone: 'rock',
    spelltag: 'ghost', dragonfang: 'dragon', blackglasses: 'dark',
    metalcoat: 'steel', fairyfeather: 'fairy', silkscarf: 'normal',
  };
  if (typeItems[i] === moveType) {
    return Math.floor(basePower * 1.2);
  }
  return basePower;
}

function applyWeatherModifier(damage: number, moveType: PokemonType, weather: Weather): number {
  if (weather === 'sun') {
    if (moveType === 'fire') return Math.floor(damage * 1.5);
    if (moveType === 'water') return Math.floor(damage * 0.5);
  }
  if (weather === 'rain') {
    if (moveType === 'water') return Math.floor(damage * 1.5);
    if (moveType === 'fire') return Math.floor(damage * 0.5);
  }
  return damage;
}

function applyStabModifier(
  damage: number,
  moveType: PokemonType,
  attackerTypes: [PokemonType] | [PokemonType, PokemonType],
  ability: string,
  terastallized: boolean,
  teraType?: PokemonType,
): number {
  const a = ability.toLowerCase().replace(/[\s-]/g, '');
  const isStab = attackerTypes.includes(moveType) || (terastallized && teraType === moveType);

  if (isStab) {
    if (a === 'adaptability') {
      return Math.floor(damage * 2);
    }
    return Math.floor(damage * 1.5);
  }
  return damage;
}

function applyScreenModifier(
  damage: number,
  category: string,
  screens: { reflect: boolean; lightScreen: boolean; auroraVeil: boolean },
  isCritical: boolean,
): number {
  if (isCritical) return damage; // Crits ignore screens
  if (category === 'physical' && (screens.reflect || screens.auroraVeil)) {
    return Math.floor(damage * 0.5);
  }
  if (category === 'special' && (screens.lightScreen || screens.auroraVeil)) {
    return Math.floor(damage * 0.5);
  }
  return damage;
}

function applyTerrainModifier(damage: number, moveType: PokemonType, terrain: Terrain): number {
  // Terrain boosts grounded Pokémon's moves (we assume grounded for simplicity)
  if (terrain === 'electric' && moveType === 'electric') return Math.floor(damage * 1.3);
  if (terrain === 'grassy' && moveType === 'grass') return Math.floor(damage * 1.3);
  if (terrain === 'psychic' && moveType === 'psychic') return Math.floor(damage * 1.3);
  // Misty terrain halves dragon damage
  if (terrain === 'misty' && moveType === 'dragon') return Math.floor(damage * 0.5);
  return damage;
}

function applyDefenseItemModifier(damage: number, item: string, category: string): number {
  const i = item.toLowerCase().replace(/[\s-]/g, '');
  if (i === 'assaultvest' && category === 'special') {
    return Math.floor(damage * 2 / 3); // 1.5x SpD effectively reduces damage by ~33%
  }
  if (i === 'eviolite') {
    return Math.floor(damage * 2 / 3);
  }
  return damage;
}

/**
 * Calculate full damage range (min roll to max roll) and KO chance.
 */
export function calculateDamage(input: DamageCalcInput): DamageResult {
  // 16 possible random rolls: 85% to 100% in steps of ~1%
  const rolls = Array.from({ length: 16 }, (_, i) => (85 + i) / 100);

  const damages = rolls.map((roll) => calcDamageAtRoll(input, roll));
  const min = Math.min(...damages);
  const max = Math.max(...damages);

  const minPercent = (min / input.defenderMaxHp) * 100;
  const maxPercent = (max / input.defenderMaxHp) * 100;

  // KO chance calculation
  const koChance = calcKOChance(damages, input.defenderCurrentHp);

  const result: DamageResult = {
    min,
    max,
    minPercent: Math.round(minPercent * 10) / 10,
    maxPercent: Math.round(maxPercent * 10) / 10,
    koChance: koChance.label,
  };

  if (koChance.label === 'OHKO' && koChance.percent < 100) {
    result.ohkoPercent = koChance.percent;
  }

  return result;
}

function calcKOChance(damages: number[], defenderHp: number): { label: DamageResult['koChance']; percent: number } {
  const ohkoCount = damages.filter((d) => d >= defenderHp).length;

  if (ohkoCount === 16) {
    return { label: 'OHKO', percent: 100 };
  }
  if (ohkoCount > 0) {
    return { label: 'OHKO', percent: Math.round((ohkoCount / 16) * 1000) / 10 };
  }

  // Check 2HKO: can min + min KO?
  const minDamage = Math.min(...damages);
  const maxDamage = Math.max(...damages);
  if (minDamage * 2 >= defenderHp) {
    return { label: '2HKO', percent: 100 };
  }
  if (maxDamage * 2 >= defenderHp) {
    return { label: '2HKO', percent: 50 }; // rough estimate
  }

  // Check 3HKO
  if (minDamage * 3 >= defenderHp) {
    return { label: '3HKO', percent: 100 };
  }
  if (maxDamage * 3 >= defenderHp) {
    return { label: '3HKO', percent: 50 };
  }

  return { label: '4+HKO', percent: 0 };
}

/**
 * Format damage result as a readable string.
 */
export function formatDamageResult(result: DamageResult): string {
  const range = `${result.min}-${result.max} (${result.minPercent}%-${result.maxPercent}%)`;
  if (result.koChance === 'OHKO' && result.ohkoPercent !== undefined) {
    return `${range} — ${result.ohkoPercent}% chance to OHKO`;
  }
  return `${range} — guaranteed ${result.koChance}`;
}
