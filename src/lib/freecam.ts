"use client";

import { create } from "zustand";

/** True while the player holds the right mouse button to orbit the table. */
export const useFreeCam = create<{ active: boolean; set: (active: boolean) => void }>((set) => ({
  active: false,
  set: (active) => set({ active }),
}));
