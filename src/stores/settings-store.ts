import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  selectedRegulationId: string;
  setRegulation: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      selectedRegulationId: 'reg-m-c',
      setRegulation: (id) => set({ selectedRegulationId: id }),
    }),
    { name: 'vgc-settings' },
  ),
);
