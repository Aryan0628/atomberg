// store/useAppStore.ts
// Zustand: UI state, role switcher, sidebar collapse

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Dark mode
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Demo role switcher
  demoUserId: string | null;
  setDemoUserId: (userId: string | null) => void;

  // Notification badge
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      darkMode: false,
      toggleDarkMode: () =>
        set((state) => ({ darkMode: !state.darkMode })),

      demoUserId: null,
      setDemoUserId: (userId) => set({ demoUserId: userId }),

      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }),
    }),
    {
      name: "atomquest-store",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        darkMode: state.darkMode,
        demoUserId: state.demoUserId,
      }),
    }
  )
);
