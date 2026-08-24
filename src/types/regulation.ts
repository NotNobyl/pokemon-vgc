export interface Regulation {
  id: string;
  name: string;
  game: 'champions' | 'showdown' | 'scarlet-violet';
  generation: number;
  allowedPokemon: number[];
  bannedPokemon: number[];
  allowedItems: string[];
  bannedItems: string[];
  megaEvolutions: {
    allowed: boolean;
    legalMegas: string[];
  };
  terastallize: boolean;
  dynamax: boolean;
  level: number;
  teamSize: number;
  bringCount: number;
}
