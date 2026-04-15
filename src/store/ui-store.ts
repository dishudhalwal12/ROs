import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SavedTaskFilter } from '@/types/models';

type TaskView = 'list' | 'board';

interface UiState {
  taskView: TaskView;
  commandPaletteOpen: boolean;
  sidebarHidden: boolean;
  savedTaskFilters: SavedTaskFilter[];
  setTaskView: (view: TaskView) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSidebarHidden: (hidden: boolean) => void;
  setSavedTaskFilters: (filters: SavedTaskFilter[]) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      taskView: 'board',
      commandPaletteOpen: false,
      sidebarHidden: false,
      savedTaskFilters: [],
      setTaskView: (taskView) => set({ taskView }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      setSidebarHidden: (sidebarHidden) => set({ sidebarHidden }),
      setSavedTaskFilters: (savedTaskFilters) => set({ savedTaskFilters }),
    }),
    { name: 'rovexa-ui' },
  ),
);
