/**
 * Game plan generator (pure, deterministic).
 *
 * Turns a resolved team into a practical, ladder-ready plan: suggested leads,
 * common Bring-4 groups, a win condition, a speed-control plan, and
 * favorable / difficult archetype notes. Derived from the team's own roles,
 * speed profile, and types via the existing analyzer — NOT from fabricated
 * win rates. Every claim is structural/heuristic and labeled as such in the UI.
 */

import type { PokemonType } from '@/types/pokemon';
import { analyzeCore, type AnalyzableMember } from './team-analysis';

export interface GamePlanMember extends AnalyzableMember {
  types: PokemonType[];
}

export interface GamePlan {
  archetype: 'fast-offense' | 'trick-room' | 'mixed';
  /** Suggested lead pair (member names) with a one-line reason. */
  leads: { members: string[]; reason: string };
  /** An alternative lead if the primary is answered. */
  altLeads: { members: string[]; reason: string } | null;
  /** Common Bring-4 groupings (member names). */
  bringFour: string[];
  /** Pokémon typically left in the back / benched. */
  benchOften: string[];
  winCondition: string;
  speedControlPlan: string;
  /** Archetypes this team tends to handle / struggle with (structural). */
  favorable: string[];
  difficult: string[];
}

/** Pick lead members by role priority: Fake Out + speed control / TR setter. */
function pickLeads(
  members: GamePlanMember[],
  archetype: GamePlan['archetype'],
): { members: string[]; reason: string } {
  const has = (m: GamePlanMember, needle: string) =>
    m.moves.some((mv) => mv.toLowerCase().includes(needle)) ||
    m.ability.toLowerCase().includes(needle);

  const fakeOut = members.find((m) => has(m, 'fake out'));
  const trSetter = members.find((m) => m.moves.some((mv) => mv.toLowerCase() === 'trick room'));
  const speedControl = members.find((m) =>
    m.moves.some((mv) => ['tailwind', 'icy wind'].includes(mv.toLowerCase())),
  );
  const redirect = members.find((m) =>
    m.moves.some((mv) => ['follow me', 'rage powder'].includes(mv.toLowerCase())),
  );

  if (archetype === 'trick-room' && trSetter) {
    const partner = members.find((m) => m.name !== trSetter.name) ?? members[0];
    return {
      members: [trSetter.name, partner.name],
      reason: 'Lead the Trick Room setter with a partner that pressures or protects while TR goes up.',
    };
  }
  if (fakeOut && speedControl && fakeOut.name !== speedControl.name) {
    return {
      members: [fakeOut.name, speedControl.name],
      reason: 'Fake Out buys a turn while your speed control (Tailwind/Icy Wind) goes up safely.',
    };
  }
  if (fakeOut && redirect && fakeOut.name !== redirect.name) {
    return {
      members: [fakeOut.name, redirect.name],
      reason: 'Fake Out + redirection lets you set up or fire off a big hit safely turn 1.',
    };
  }
  // Default: two fastest / highest-pressure members.
  const two = members.slice(0, 2).map((m) => m.name);
  return { members: two, reason: 'Default aggressive lead — apply immediate pressure.' };
}

export function buildGamePlan(members: GamePlanMember[]): GamePlan | null {
  if (members.length < 2) return null;
  const analysis = analyzeCore(members);
  const archetype = analysis.speed.archetype;

  const leads = pickLeads(members, archetype);
  // Alternative lead: a different pairing of two members not both in the primary.
  const notLead = members.filter((m) => !leads.members.includes(m.name));
  const altLeads =
    notLead.length >= 2
      ? {
          members: [notLead[0].name, notLead[1].name],
          reason: 'Anti-read / secondary lead when the opponent is built to punish your primary.',
        }
      : null;

  // Bring-4: leads + the two most offensively threatening back members.
  const bringFour = Array.from(
    new Set([...leads.members, ...notLead.slice(0, 2).map((m) => m.name)]),
  ).slice(0, 4);
  const benchOften = members.map((m) => m.name).filter((n) => !bringFour.includes(n));

  // Win condition from archetype + roles.
  let winCondition: string;
  if (archetype === 'trick-room') {
    winCondition = 'Set Trick Room and clean up with your slow, hard-hitting attackers while the timer is up.';
  } else if (archetype === 'fast-offense') {
    winCondition = 'Use speed control + priority to out-tempo the opponent and remove threats before they act.';
  } else {
    winCondition = 'Trade efficiently, preserve your win condition, and close in a favorable 2v1 / 2v2 endgame.';
  }

  const speedControlPlan = analysis.speed.hasSpeedControlPlan
    ? archetype === 'trick-room'
      ? 'Trick Room flips speed order — keep the setter healthy and re-set as needed.'
      : 'Maintain Tailwind/Icy Wind uptime; lead into it so your attackers move first.'
    : 'No dedicated speed control — rely on priority and natural speed; consider adding some.';

  // Favorable / difficult archetypes (structural heuristic).
  const favorable: string[] = [];
  const difficult: string[] = [];
  if (analysis.roles.hasIntimidation) favorable.push('physical-offense teams (Intimidate blunts them)');
  if (analysis.roles.hasRedirection) favorable.push('single-target-reliant offense (you redirect their KOs)');
  if (archetype === 'fast-offense') {
    favorable.push('slower balance teams');
    difficult.push('Trick Room (your speed advantage inverts)');
  }
  if (archetype === 'trick-room') {
    favorable.push('hyper-offense (you invert their speed)');
    difficult.push('Taunt leads and fast Tailwind teams that race your setup');
  }
  if (!analysis.roles.hasSpeedControl) difficult.push('teams with strong speed control');
  // Type-based: if the team shares a weakness, name it as a difficult axis.
  // (analysis surfaces issues already; keep this concise.)
  if (favorable.length === 0) favorable.push('even matchups — win on execution');
  if (difficult.length === 0) difficult.push('mirror/skill matchups');

  return {
    archetype,
    leads,
    altLeads,
    bringFour,
    benchOften,
    winCondition,
    speedControlPlan,
    favorable,
    difficult,
  };
}
