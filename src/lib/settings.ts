"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CameraMode = "table" | "player" | "top";

interface Settings {
  volume: number;
  sfx: boolean;
  music: boolean;
  voice: boolean;
  ambience: boolean;
  hints: boolean;
  /** Size of one rendered pixel in screen pixels (pixel-art look). */
  pixelSize: number;
  camera: CameraMode;
  set: (patch: Partial<Omit<Settings, "set">>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      volume: 0.7,
      sfx: true,
      music: true,
      voice: true,
      ambience: true,
      hints: true,
      pixelSize: 3,
      camera: "table",
      set: (patch) => set(patch),
    }),
    {
      name: "bj-settings",
      version: 1,
      partialize: (s) => ({
        volume: s.volume,
        sfx: s.sfx,
        music: s.music,
        ambience: s.ambience,
        voice: s.voice,
        hints: s.hints,
        pixelSize: s.pixelSize,
        camera: s.camera,
      }),
    },
  ),
);
