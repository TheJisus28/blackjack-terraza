"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";

/** Phones, small tablets and short screens: the table HUD switches to its compact layout. */
export const COMPACT_QUERY = "(max-width: 1023px), (max-height: 520px)";
/** Phones held sideways: the table HUD moves to a column on the right. */
export const SHORT_QUERY = "(orientation: landscape) and (max-height: 520px)";
export const TOUCH_QUERY = "(pointer: coarse)";

export function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Screen pixels covered by the table HUD on each side, so the camera frames the table in the rest. */
export interface ViewInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export const useViewInsets = create<{ insets: ViewInsets; set: (insets: ViewInsets) => void }>((set) => ({
  insets: NO_INSETS,
  set: (insets) => set({ insets }),
}));
