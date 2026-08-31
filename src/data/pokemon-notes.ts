import notesData from './pokemon-notes.json';
import { canonicalize } from '@/data/sources/showdown-mapping';

export interface PokemonNote {
  title: string;
  tags: string[];
  text: string;
}

interface NotesFile {
  notes: Record<string, PokemonNote>;
}

const NOTES = (notesData as NotesFile).notes;

/**
 * Look up a playstyle/mechanic note for a species by name (any form of the
 * name — display, slug, or Showdown id). Matches on canonicalized name so
 * "Palafin", "palafin", and "Palafin Hero" all resolve to the base note.
 */
export function getPokemonNote(name: string): PokemonNote | undefined {
  const key = canonicalize(name);
  if (NOTES[key]) return NOTES[key];
  // Try progressive base-name matching (strip trailing form tokens).
  for (const noteKey of Object.keys(NOTES)) {
    const nk = canonicalize(noteKey);
    if (key.startsWith(nk) || nk.startsWith(key)) return NOTES[noteKey];
  }
  return undefined;
}
