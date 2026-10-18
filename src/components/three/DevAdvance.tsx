"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * Development helper: exposes window.__bjAdvance(frames, dtMs) to step the
 * render loop manually with a fixed delta. Automated browsers often throttle
 * requestAnimationFrame for occluded windows, which would freeze screenshots.
 */
export function DevAdvance() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __bjAdvance?: (frames?: number, dt?: number) => number };
    w.__bjAdvance = (frames = 60, dt = 1000 / 60) => {
      const state = get();
      const clock = state.clock;
      const original = clock.getDelta;
      clock.getDelta = () => {
        clock.elapsedTime += dt / 1000;
        return dt / 1000;
      };
      try {
        for (let i = 0; i < frames; i++) state.advance(performance.now(), true);
      } finally {
        clock.getDelta = original;
      }
      return frames;
    };
    return () => {
      delete w.__bjAdvance;
    };
  }, [get]);
  return null;
}
