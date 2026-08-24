import { useState, useEffect } from 'react';
import type { Team } from '@/types/team';
import type { Pokemon } from '@/types/pokemon';
import { getPokemonById } from '@/db/pokemon-cache';

interface TeamGuideProps {
  team: Team;
}

interface GuideData {
  archetype: string;
  winCondition: string;
  gamePlan: string;
  leads: { scenario: string; suggestion: string }[];
  decisionPoints: string[];
  failureConditions: string[];
}

const WEATHER_ABILITIES = [
  'drought', 'drizzle', 'sand stream', 'snow warning', 'orichalcum pulse', 'desolate land', 'primordial sea',
];

const WEATHER_ABUSER_ABILITIES = [
  'swift swim', 'chlorophyll', 'sand rush', 'slush rush', 'solar power',
];

const TR_MOVES = ['trick room'];
const TAILWIND_MOVES = ['tailwind'];

function deriveArchetype(
  members: { name: string; ability: string; moves: string[]; speed: number }[],
): string {
  const hasWeatherSetter = members.some((m) =>
    WEATHER_ABILITIES.includes(m.ability.toLowerCase()),
  );
  const hasWeatherAbuser = members.some((m) =>
    WEATHER_ABUSER_ABILITIES.includes(m.ability.toLowerCase()),
  );
  const hasTRSetter = members.some((m) =>
    m.moves.some((mv) => TR_MOVES.includes(mv.toLowerCase())),
  );
  const slowAttackers = members.filter((m) => m.speed <= 60).length;
  const hasTailwind = members.some((m) =>
    m.moves.some((mv) => TAILWIND_MOVES.includes(mv.toLowerCase())),
  );
  const fastMons = members.filter((m) => m.speed >= 90).length;

  if (hasWeatherSetter && hasWeatherAbuser) return 'weather';
  if (hasTRSetter && slowAttackers >= 2) return 'trick-room';
  if (hasTailwind && fastMons >= 2) return 'tailwind';
  return 'balanced';
}

function generateGuide(
  members: { name: string; ability: string; moves: string[]; speed: number }[],
): GuideData {
  const archetype = deriveArchetype(members);

  let winCondition: string;
  let gamePlan: string;

  switch (archetype) {
    case 'weather':
      winCondition = 'Weather sweeper team — set weather and overpower with boosted attackers.';
      gamePlan = 'Set weather early, position your abuser safely, and sweep before the opponent can change conditions or outspeed you.';
      break;
    case 'trick-room':
      winCondition = 'Trick Room — reverse speed and overwhelm with slow, powerful attackers.';
      gamePlan = 'Set Trick Room safely (use redirection or Fake Out), then attack with your slow heavy-hitters while the opponent is too slow to respond.';
      break;
    case 'tailwind':
      winCondition = 'Tailwind offense — set Tailwind and outpace the opponent for aggressive KOs.';
      gamePlan = 'Set Tailwind turn 1, apply immediate offensive pressure, and close the game before Tailwind expires or the opponent adapts.';
      break;
    default:
      winCondition = 'Balanced/Goodstuffs — flexible gameplan that adapts to the opponent.';
      gamePlan = 'Read the opponent in Team Preview, choose the right mode, and outplay through superior positioning and prediction.';
  }

  const leads = [
    {
      scenario: 'vs Trick Room',
      suggestion: archetype === 'trick-room'
        ? 'Mirror the TR — lead your own setter + support to win the speed war under TR.'
        : 'Lead aggressive + Fake Out/Taunt user to prevent TR from going up. Pressure the setter immediately.',
    },
    {
      scenario: 'vs Weather',
      suggestion: 'Lead with Pokémon that can reset weather or threaten the weather setter. Consider leading a faster attacker that can KO the setter before they benefit.',
    },
    {
      scenario: 'vs Offense',
      suggestion: 'Lead with Intimidate or bulky Pokémon that can absorb hits. Speed control (Tailwind/Icy Wind) helps regain tempo.',
    },
  ];

  const decisionPoints = [
    'Protect when: your partner can remove a threat this turn, you expect a double target, or you need to stall a field effect.',
    'Double target when: you MUST KO a threat this turn and can afford the Protect risk.',
    'Switch when: your current Pokémon cannot threaten either opponent AND is at risk of being KO\'d for nothing.',
    'Don\'t over-commit: if you have a winning position, play safe. Force the opponent to make risky plays.',
  ];

  const failureConditions: string[] = [];
  const hasTR = members.some((m) => m.moves.some((mv) => TR_MOVES.includes(mv.toLowerCase())));
  const hasTailwind = members.some((m) => m.moves.some((mv) => TAILWIND_MOVES.includes(mv.toLowerCase())));

  if (!hasTR && !hasTailwind) {
    failureConditions.push('This team has no speed control — you lose if the opponent sets up Tailwind or Trick Room unopposed.');
  }
  if (archetype === 'trick-room') {
    failureConditions.push('This team loses if Trick Room is prevented (Taunt, KO on setter, Imprison).');
  }
  if (archetype === 'weather') {
    failureConditions.push('This team loses if the opponent resets weather or your abuser is KO\'d before it can sweep.');
  }

  const speeds = members.map((m) => m.speed);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  if (avgSpeed < 70 && !hasTR) {
    failureConditions.push('Team is generally slow without Trick Room — fast offensive teams will outpace you.');
  }

  if (failureConditions.length === 0) {
    failureConditions.push('Identify your critical matchups in Team Preview — every team has bad matchups. Knowing yours helps you play around them.');
  }

  return { archetype, winCondition, gamePlan, leads, decisionPoints, failureConditions };
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-750 transition-colors"
      >
        <h3 className="font-semibold text-gray-100">{title}</h3>
        <span className="text-gray-400 text-sm">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="px-4 pb-4 text-gray-300">{children}</div>}
    </div>
  );
}

export default function TeamGuide({ team }: TeamGuideProps) {
  const [memberData, setMemberData] = useState<{ name: string; ability: string; moves: string[]; speed: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data: { name: string; ability: string; moves: string[]; speed: number }[] = [];
      for (const member of team.members) {
        const pokemon: Pokemon | undefined = await getPokemonById(member.pokemonId);
        data.push({
          name: pokemon?.name ?? `Pokemon #${member.pokemonId}`,
          ability: member.ability,
          moves: member.moves,
          speed: pokemon?.baseStats.speed ?? 80,
        });
      }
      setMemberData(data);
      setLoading(false);
    }
    load();
  }, [team]);

  if (loading) {
    return <div className="text-gray-400 text-center py-8">Generating guide...</div>;
  }

  if (team.members.length === 0) {
    return <div className="text-gray-400 text-center py-8">Add members to your team to generate a guide.</div>;
  }

  const guide = generateGuide(memberData);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-2 py-1 bg-indigo-600 rounded-full text-white uppercase font-medium">
          {guide.archetype}
        </span>
      </div>

      <CollapsibleSection title="🎯 Win Condition">
        <p>{guide.winCondition}</p>
      </CollapsibleSection>

      <CollapsibleSection title="📋 Game Plan">
        <p>{guide.gamePlan}</p>
      </CollapsibleSection>

      <CollapsibleSection title="🚀 Lead Recommendations">
        <ul className="space-y-3">
          {guide.leads.map((lead) => (
            <li key={lead.scenario}>
              <span className="font-medium text-indigo-400">{lead.scenario}:</span>
              <p className="text-sm mt-1">{lead.suggestion}</p>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="🧠 Key Decision Points" defaultOpen={false}>
        <ul className="space-y-2">
          {guide.decisionPoints.map((point, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span className="text-sm">{point}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="⚠️ Failure Conditions" defaultOpen={false}>
        <ul className="space-y-2">
          {guide.failureConditions.map((cond, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-red-400 mt-0.5">✗</span>
              <span className="text-sm">{cond}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </div>
  );
}
