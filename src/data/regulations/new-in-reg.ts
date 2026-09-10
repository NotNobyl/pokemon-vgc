/**
 * Species newly added in each Champions regulation, by DISPLAY NAME.
 *
 * Purpose: the discovery engine can surface these as "new this regulation,
 * nobody has usage data on them yet" picks — an early-adopter edge before the
 * meta settles. This is authoritative external data (not derived/inferred), so
 * it carries provenance per the project's data rules, and it lives in a config
 * rather than being invented in engine code.
 *
 * Keyed by regulation id. Names are matched to the local dex via
 * `canonicalize()` at the call site, so exact punctuation/spacing here is not
 * load-bearing (e.g. "Toxtricity (Amped Form)" canonicalizes fine). A name that
 * doesn't resolve to a seeded species is simply skipped downstream.
 *
 * IMPORTANT: "new in this regulation" means the SPECIES was added to the
 * Champions roster in that reg. New Mega Evolutions of already-present species
 * (e.g. the Z-Megas) are tracked in the regulation config's `legalMegas`, not
 * here.
 */

export interface NewInRegProvenance {
  /** Where the list came from (human attribution). */
  source: string;
  /** Exact URL the list was taken from. */
  sourceUrl: string;
  /** ISO date the list was captured. */
  retrievedAt: string;
  /** Free-text note on scope/caveats. */
  note?: string;
}

export interface NewInRegConfig {
  regulationId: string;
  provenance: NewInRegProvenance;
  /** Display names of species newly available in this regulation. */
  species: string[];
}

/**
 * Regulation M-C (Champions), Season M-6. New species added on top of the
 * M-A/M-B rosters. Source: Game8's "All New Pokemon Available in Regulation
 * M-C" list. New Mega Evolutions (Z-Megas + Mega Baxcalibur/Golisopod, and the
 * new Mega Salamence) are captured in reg-m-c.json `legalMegas`, not here.
 */
const REG_M_C_NEW: NewInRegConfig = {
  regulationId: 'reg-m-c',
  provenance: {
    source: 'Game8 — Regulation M-C: Complete Roster and Schedule',
    sourceUrl: 'https://game8.co/games/Pokemon-Champions/archives/618064',
    retrievedAt: '2026-09-10',
    note:
      'Species newly recruitable in Regulation M-C per Game8 (page last updated ' +
      '2026-09-09). New Mega Evolutions are tracked in reg-m-c.json legalMegas.',
  },
  species: [
    'Wigglytuff',
    'Persian',
    'Alolan Persian',
    "Farfetch'd",
    'Mr. Mime',
    'Swalot',
    'Salamence',
    'Gogoat',
    'Golisopod',
    'Rillaboom',
    'Cinderace',
    'Inteleon',
    'Thievul',
    'Toxtricity (Amped Form)',
    'Toxtricity (Low Key Form)',
    'Grapploct',
    'Perrserker',
    "Sirfetch'd",
    'Pincurchin',
    'Indeedee (Male)',
    'Indeedee (Female)',
    'Arboliva',
    'Squawkabilly',
    'Mabosstiff',
    'Baxcalibur',
    'Pawmot',
  ],
};

const CONFIGS: NewInRegConfig[] = [REG_M_C_NEW];

/** Get the new-species config for a regulation, or undefined if none is known. */
export function getNewInRegConfig(regulationId: string): NewInRegConfig | undefined {
  return CONFIGS.find((c) => c.regulationId === regulationId);
}
