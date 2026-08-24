export interface BattleLog {
  id: string;
  teamId: string;
  opponentTeamId?: string;
  date: number;
  result: 'win' | 'loss';
  brought: string[];
  opponentBrought?: string[];
  notes: string[];
  tags: string[];
}

export const COMMON_TAGS = [
  'mispredicted-protect',
  'bad-lead',
  'wrong-bring-4',
  'lost-speed-control',
  'mispredicted-switch',
  'good-read',
  'strong-positioning',
  'lucky-crit',
  'unlucky-rng',
  'good-endgame',
  'misplayed-endgame',
  'opponent-outplayed',
] as const;

export type CommonTag = typeof COMMON_TAGS[number];
