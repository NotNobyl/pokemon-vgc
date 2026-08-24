import type { Regulation } from '@/types/regulation';
import regMA from './regulations/reg-m-a.json';
import regMB from './regulations/reg-m-b.json';

const regulations: Regulation[] = [regMA as Regulation, regMB as Regulation];

export function getRegulations(): Regulation[] {
  return regulations;
}

export function getRegulationById(id: string): Regulation | undefined {
  return regulations.find((r) => r.id === id);
}
