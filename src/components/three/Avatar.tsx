"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { avatarInfo } from "@/lib/avatar";
import { ANIMS_URL, avatarClips, clipHips, useAvatarModel } from "./assets";

export type Mood = "neutral" | "joy" | "sorrow" | "angry" | "fun";

export interface Reaction {
  /** Clip name from anims.glb. */
  clip: string;
  /** Changing this replays the reaction. */
  key: number;
}

interface AvatarProps {
  id: string;
  /** Seated on a stool whose top is at local y=0, or standing on the floor. */
  seated?: boolean;
  /** Base loop: defaults to sit_idle / idle. */
  base?: string;
  reaction?: Reaction | null;
  mood?: Mood;
  talking?: boolean;
  /** Extra torso yaw (radians) applied after animation, e.g. to face a seat. */
  lookYaw?: number;
  position?: [number, number, number] | THREE.Vector3;
  rotation?: [number, number, number];
  scale?: number;
}

const BASE_FADE = 0.45;
const REACT_IN = 0.2;
const REACT_OUT = 0.35;

interface Layers {
  base: THREE.AnimationAction[];
  prevBase: THREE.AnimationAction[];
  baseBlend: number;
  react: THREE.AnimationAction | null;
  reactTime: number;
}

export function Avatar({
  id,
  seated = false,
  base,
  reaction,
  mood = "neutral",
  talking = false,
  lookYaw = 0,
  position,
  rotation,
  scale = 1,
}: AvatarProps) {
  const info = avatarInfo(id);
  const { scene, expressions } = useAvatarModel(info);
  const { animations } = useGLTF(ANIMS_URL);
  const clips = useMemo(() => avatarClips(animations, info), [animations, info]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const baseName = base ?? (seated ? "sit_idle" : "idle");
  const layers = useRef<Layers>({ base: [], prevBase: [], baseBlend: 1, react: null, reactTime: 0 });

  // Seated avatars are moved so their hips rest on the centre of the stool.
  // The model is turned 180°, so avatar-space x/z flip sign in group space.
  const offset = useMemo<[number, number, number]>(() => {
    if (!seated) return [0, 0, 0];
    const sit = clips.get("sit_idle");
    if (!sit) return [0, 0, 0];
    const hips = clipHips(sit);
    return [hips.x, 0.07 - hips.y, hips.z - 0.04];
  }, [clips, seated]);

  const action = (name: string) => {
    const clip = clips.get(name);
    return clip ? mixer.clipAction(clip) : null;
  };

  // Base loop. Seated avatars play it as two layers (legs / torso) so that a
  // reaction can replace only the torso while they stay seated.
  useEffect(() => {
    const names = seated ? [`${baseName}:lower`, `${baseName}:upper`] : [baseName];
    const next = names.map(action).filter((a): a is THREE.AnimationAction => !!a);
    if (!next.length) return;
    const l = layers.current;
    if (l.base.length && l.base.every((a, i) => a === next[i])) return;
    l.prevBase = l.base.filter((a) => !next.includes(a));
    l.base = next;
    l.baseBlend = l.prevBase.length ? 0 : 1;
    const phase = Math.random();
    for (const a of next) {
      a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      a.time = phase * a.getClip().duration;
      a.setEffectiveWeight(l.baseBlend);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- action() reads clips/mixer listed here
  }, [mixer, clips, baseName, seated]);

  // One-shot reaction (cheer, nod, drink...).
  useEffect(() => {
    if (!reaction) return;
    const next = action(seated ? `${reaction.clip}:upper` : reaction.clip);
    if (!next) return;
    const l = layers.current;
    if (l.react && l.react !== next) l.react.stop();
    next.reset().setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.play();
    l.react = next;
    l.reactTime = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay only when the reaction key changes
  }, [reaction?.key]);

  useEffect(
    () => () => {
      // Also forget the layers so a remount (StrictMode, Activity) restarts them.
      mixer.stopAllAction();
      layers.current = { base: [], prevBase: [], baseBlend: 1, react: null, reactTime: 0 };
    },
    [mixer],
  );

  const spine = useMemo(() => scene.getObjectByName("Spine_jnt") ?? null, [scene]);
  const blink = useRef<{ next: number; t: number } | null>(null);
  const live = useRef({ mood, talking, lookYaw });
  useEffect(() => {
    live.current = { mood, talking, lookYaw };
  }, [mood, talking, lookYaw]);
  const yawSmooth = useRef(0);

  useFrame((state, dt) => {
    const delta = Math.min(dt, 0.1);
    const l = layers.current;

    // Reaction weight: ease in, hold, ease out before the clip ends.
    let rw = 0;
    if (l.react) {
      l.reactTime += delta;
      const d = l.react.getClip().duration;
      rw = Math.min(1, l.reactTime / REACT_IN, Math.max(0, (d - l.reactTime) / REACT_OUT));
      if (l.reactTime >= d) {
        l.react.stop();
        l.react = null;
        rw = 0;
      } else {
        l.react.setEffectiveWeight(rw);
      }
    }

    // Base cross-fade.
    if (l.baseBlend < 1) {
      l.baseBlend = Math.min(1, l.baseBlend + delta / BASE_FADE);
      if (l.baseBlend >= 1) {
        for (const a of l.prevBase) a.stop();
        l.prevBase = [];
      }
    }
    const torsoWeight = 1 - rw;
    l.base.forEach((a, i) => {
      const isTorso = seated ? i === 1 : true;
      a.setEffectiveWeight(l.baseBlend * (isTorso ? torsoWeight : 1));
    });
    l.prevBase.forEach((a, i) => {
      const isTorso = seated ? i === 1 : true;
      a.setEffectiveWeight((1 - l.baseBlend) * (isTorso ? torsoWeight : 1));
    });

    mixer.update(delta);

    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __bjScenes?: Record<string, unknown> };
      (w.__bjScenes ??= {})[id] = { scene, mixer };
    }

    // Torso turn layered on top of the animation.
    yawSmooth.current = THREE.MathUtils.damp(yawSmooth.current, live.current.lookYaw, 6, delta);
    if (spine && Math.abs(yawSmooth.current) > 0.001) spine.rotateY(yawSmooth.current);

    // Blinking.
    const b = (blink.current ??= { next: 1 + Math.random() * 3, t: 0 });
    b.t += delta;
    let blinkValue = 0;
    if (b.t > b.next) {
      const p = (b.t - b.next) / 0.14;
      blinkValue = p < 1 ? Math.sin(p * Math.PI) : 0;
      if (p >= 1) {
        b.t = 0;
        b.next = 1.8 + Math.random() * 3.5;
      }
    }
    expressions.set("blink", blinkValue);
    for (const m of ["joy", "sorrow", "angry", "fun"] as const) {
      expressions.set(m, THREE.MathUtils.damp(expressions.get(m), live.current.mood === m ? 1 : 0, 5, delta));
    }
    const talk = live.current.talking ? 0.35 + 0.35 * Math.sin(state.clock.elapsedTime * 18) : 0;
    expressions.set("a", THREE.MathUtils.damp(expressions.get("a"), Math.max(0, talk), 20, delta));
    expressions.apply();
  });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* VRM 0.x avatars face -Z; turn them to face +Z like everything else. */}
      <primitive object={scene} rotation={[0, Math.PI, 0]} position={offset} />
    </group>
  );
}
