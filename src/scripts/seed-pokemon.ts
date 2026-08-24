import type { Move, Pokemon, PokemonType } from '@/types/pokemon';
import { bulkStoreMoves, bulkStorePokemon } from '@/db/pokemon-cache';

/** Common VGC Pokemon IDs to seed into IndexedDB */
export const SEED_POKEMON: number[] = [
  // Gen 1
  6,    // Charizard
  59,   // Arcanine
  94,   // Gengar
  113,  // Chansey
  130,  // Gyarados
  131,  // Lapras
  143,  // Snorlax
  // Gen 2
  233,  // Porygon2
  248,  // Tyranitar
  // Gen 3
  373,  // Salamence
  376,  // Metagross
  380,  // Latias
  381,  // Latios
  // Gen 4
  445,  // Garchomp
  448,  // Lucario
  479,  // Rotom
  // Gen 5
  591,  // Amoonguss
  635,  // Hydreigon
  641,  // Tornadus
  645,  // Landorus
  // Gen 6
  681,  // Aegislash
  700,  // Sylveon
  // Gen 7
  727,  // Incineroar
  748,  // Toxapex
  778,  // Mimikyu
  // Gen 8
  812,  // Rillaboom
  823,  // Corviknight
  839,  // Coalossal
  849,  // Toxtricity
  858,  // Hatterene
  873,  // Froslass (Eiscue in gen8, use Frosmoth 873)
  876,  // Indeedee
  879,  // Copperajah
  884,  // Duraludon
  892,  // Urshifu
  // Gen 9
  901,  // Ursaluna
  911,  // Armarouge
  912,  // Ceruledge
  923,  // Palafin
  934,  // Tinkaton
  952,  // Annihilape
  954,  // Farigiraf
  964,  // Dondozo
  970,  // Glimmora
  975,  // Clodsire
  978,  // Tatsugiri
  983,  // Kingambit
  985,  // Iron Hands
  987,  // Flutter Mane
  997,  // Iron Bundle
  1000, // Gholdengo
];

interface PokeAPIPokemon {
  id: number;
  name: string;
  types: { slot: number; type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  abilities: { ability: { name: string } }[];
  moves: { move: { name: string; url: string } }[];
  weight: number;
}

interface PokeAPIMove {
  name: string;
  type: { name: string };
  damage_class: { name: string };
  power: number | null;
  accuracy: number | null;
  priority: number;
  target: { name: string };
  meta: { category?: { name: string } } | null;
  flavor_text_entries: { flavor_text: string; language: { name: string } }[];
}

function mapStatName(apiStat: string): keyof Pokemon['baseStats'] | null {
  switch (apiStat) {
    case 'hp': return 'hp';
    case 'attack': return 'attack';
    case 'defense': return 'defense';
    case 'special-attack': return 'specialAttack';
    case 'special-defense': return 'specialDefense';
    case 'speed': return 'speed';
    default: return null;
  }
}

function mapTarget(apiTarget: string): Move['targets'] {
  switch (apiTarget) {
    case 'selected-pokemon':
    case 'random-opponent':
      return 'single';
    case 'all-other-pokemon':
    case 'all-opponents':
      return 'spread';
    case 'user':
    case 'users-field':
      return 'self';
    case 'ally':
    case 'user-and-allies':
      return 'ally';
    default:
      return 'single';
  }
}

function transformPokemon(data: PokeAPIPokemon): Pokemon {
  const types = data.types
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name as PokemonType);

  const baseStats: Pokemon['baseStats'] = {
    hp: 0,
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };

  for (const stat of data.stats) {
    const key = mapStatName(stat.stat.name);
    if (key) {
      baseStats[key] = stat.base_stat;
    }
  }

  return {
    id: data.id,
    name: data.name,
    types: types as Pokemon['types'],
    baseStats,
    abilities: data.abilities.map((a) => a.ability.name),
    movepool: data.moves.map((m) => m.move.name),
    weight: data.weight / 10, // PokeAPI gives hectograms, convert to kg
  };
}

function transformMove(data: PokeAPIMove): Move {
  const category = data.damage_class.name as 'physical' | 'special' | 'status';
  const enEntry = data.flavor_text_entries.find(
    (e) => e.language.name === 'en'
  );

  return {
    name: data.name,
    type: data.type.name as PokemonType,
    category,
    basePower: data.power ?? 0,
    accuracy: data.accuracy ?? 100,
    priority: data.priority,
    targets: mapTarget(data.target.name),
    flags: {
      contact: false,
      sound: false,
      bullet: false,
      punch: false,
      bite: false,
    },
    description: enEntry?.flavor_text ?? '',
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAndSeedPokemon(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = SEED_POKEMON.length;
  const pokemonList: Pokemon[] = [];
  const moveUrlsToFetch = new Set<string>();
  const moveNamesToFetch = new Set<string>();

  // Fetch all Pokemon data
  for (let i = 0; i < SEED_POKEMON.length; i++) {
    const id = SEED_POKEMON[i];
    const data = await fetchJson<PokeAPIPokemon>(
      `https://pokeapi.co/api/v2/pokemon/${id}`
    );

    if (data) {
      const pokemon = transformPokemon(data);
      pokemonList.push(pokemon);

      // Collect move URLs (limit to first 20 moves per pokemon to avoid excessive fetching)
      const movesToCollect = data.moves.slice(0, 20);
      for (const m of movesToCollect) {
        if (!moveNamesToFetch.has(m.move.name)) {
          moveNamesToFetch.add(m.move.name);
          moveUrlsToFetch.add(m.move.url);
        }
      }
    }

    onProgress?.(i + 1, total);
  }

  // Store Pokemon
  if (pokemonList.length > 0) {
    await bulkStorePokemon(pokemonList);
  }

  // Fetch moves in batches
  const moveUrls = Array.from(moveUrlsToFetch);
  const moves: Move[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < moveUrls.length; i += BATCH_SIZE) {
    const batch = moveUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((url) => fetchJson<PokeAPIMove>(url))
    );

    for (const result of results) {
      if (result) {
        moves.push(transformMove(result));
      }
    }
  }

  // Store moves
  if (moves.length > 0) {
    await bulkStoreMoves(moves);
  }
}
