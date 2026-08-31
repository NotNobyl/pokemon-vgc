/**
 * Rule-based post-match improvement notes (pure, testable).
 *
 * Generates HEURISTIC reflection notes from a finished LiveMatch. These are
 * coaching prompts, not verdicts — labeled as heuristic in the UI. They get
 * more useful as match history accumulates, but even with one match they can
 * surface obvious lessons (e.g. brought differently than recommended, led into
 * a likely Fake Out, ignored a likely Trick Room).
 */

import type { LiveMatch } from '@/types/live-match';
import { canonicalize } from '@/data/sources/showdown-mapping';

export interface ImprovementNote {
  text: string;
  /** A short tag for pattern-tracking across matches. */
  tag: string;
}

const FAKE_OUT = 'fakeout';
const TRICK_ROOM = 'trickroom';

/**
 * Analyze a finished match and produce improvement notes + suggested tags.
 * `opponentHadMovePredicted` lets the caller pass which moves were LIKELY (from
 * usage) so we can flag "you led into a likely Fake Out" even if unrevealed.
 */
export function generateImprovementNotes(
  match: LiveMatch,
  likelyOpponentMoves: (opponentName: string) => string[],
): ImprovementNote[] {
  const notes: ImprovementNote[] = [];

  // 1. Brought differently than the tool recommended (only note on a loss).
  if (
    match.result === 'loss' &&
    match.recommendedBring4.length === 4 &&
    match.myBring4.length === 4
  ) {
    const rec = new Set(match.recommendedBring4);
    const differing = match.myBring4.filter((id) => !rec.has(id));
    if (differing.length >= 2) {
      notes.push({
        text: 'You brought a notably different 4 than the matchup recommendation. On a loss, review whether the recommended bring would have covered the threats better.',
        tag: 'wrong-bring-4',
      });
    }
  }

  // 2. Turn 1 lead into a likely Fake Out.
  const firstTurn = match.turns.find((t) => t.turn === 1);
  if (firstTurn && firstTurn.theirActive.length > 0) {
    const fakeOutLeads = firstTurn.theirActive.filter((oppName) =>
      likelyOpponentMoves(oppName).some((m) => canonicalize(m) === FAKE_OUT),
    );
    if (fakeOutLeads.length > 0) {
      notes.push({
        text: `Turn 1 you faced ${fakeOutLeads.join(', ')}, which commonly runs Fake Out. Consider protecting your key attacker or leading into it next time.`,
        tag: 'lead-into-fake-out',
      });
    }
  }

  // 3. Opponent likely had Trick Room but you may not have accounted for it.
  const trickRoomThreats = match.opponents.filter((o) =>
    likelyOpponentMoves(o.name).some((m) => canonicalize(m) === TRICK_ROOM),
  );
  if (trickRoomThreats.length > 0 && match.result === 'loss') {
    notes.push({
      text: `Opponent's ${trickRoomThreats
        .map((o) => o.name)
        .join(', ')} commonly runs Trick Room. If speed control flipped, plan a Taunt lead or your own TR next time.`,
      tag: 'lost-speed-control',
    });
  }

  // 4. Turns where the tool suggested a line but a different line was played.
  const deviations = match.turns.filter(
    (t) => t.suggestedLine && t.actualLine && t.suggestedLine !== t.actualLine,
  );
  if (deviations.length > 0 && match.result === 'loss') {
    notes.push({
      text: `On ${deviations.length} turn(s) you played a different line than the heuristic suggestion. Review those turns — the suggestion isn't always right, but recurring deviations on losses are worth checking.`,
      tag: 'line-deviation',
    });
  }

  // 5. Always-on reflection prompt if nothing specific fired.
  if (notes.length === 0) {
    notes.push({
      text:
        match.result === 'win'
          ? 'Win logged. Note what worked so you can repeat it — which lead and bring-4 gave you the advantage?'
          : 'Loss logged. Jot the single biggest turning point while it is fresh — one clear lesson beats many vague ones.',
      tag: match.result === 'win' ? 'win-review' : 'loss-review',
    });
  }

  return notes;
}
