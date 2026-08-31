import { describe, expect, it } from 'vitest';
import { getPokemonNote } from '@/data/pokemon-notes';

describe('pokemon-notes', () => {
  it('returns the Palafin Zero->Hero note by display name', () => {
    const note = getPokemonNote('Palafin');
    expect(note).toBeDefined();
    expect(note?.title).toMatch(/Zero.*Hero/i);
    expect(note?.text).toMatch(/switch/i);
    expect(note?.tags).toContain('form-change');
  });

  it('matches regardless of case / form suffix', () => {
    expect(getPokemonNote('palafin')).toBeDefined();
    expect(getPokemonNote('Palafin Hero')?.title).toMatch(/Zero.*Hero/i);
  });

  it('resolves hyphenated slugs (flutter-mane)', () => {
    expect(getPokemonNote('flutter-mane')).toBeDefined();
  });

  it('returns undefined for a species with no note', () => {
    expect(getPokemonNote('Magikarp')).toBeUndefined();
  });
});
