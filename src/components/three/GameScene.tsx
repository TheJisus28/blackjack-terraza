"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFreeCam } from "@/lib/freecam";
import type { CameraMode } from "@/lib/settings";
import type { TableConfig, TableState } from "@/lib/game/types";
import type { DealTimeline } from "@/components/table/timeline";
import { CardsLayer } from "./Cards";
import { Dealer } from "./Dealer";
import { DevAdvance } from "./DevAdvance";
import { polar, seatAngle, viewBasis } from "./layout";
import { PixelPipeline } from "./PixelPipeline";
import { CasinoLights, CasinoRoom } from "./Room";
import { SeatSpot, type SeatEmote } from "./Seat";
import { BlackjackTable } from "./Table";

export interface GameSceneProps {
  config: TableConfig;
  state: TableState;
  mySeat: number | null;
  canSit: boolean;
  onSit: (seat: number) => void;
  timeline: DealTimeline;
  camera: CameraMode;
  pixelSize: number;
  dealerTalking: boolean;
  emotes: Record<string, SeatEmote>;
  chatLines: Record<string, { text: string; ts: number }>;
  serverNow: () => number;
}

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  width: number;
  height: number;
}

function poseFor(mode: CameraMode, mySeat: number | null, seats: number): Pose {
  if (mode === "player" && mySeat !== null) {
    const a = seatAngle(mySeat, seats);
    return {
      position: polar(a, 6.2, 4.4),
      target: polar(a, 0.25, 0.75),
      width: 4.8,
      height: 3.0,
    };
  }
  if (mode === "top") {
    return { position: new THREE.Vector3(0, 10, 2.2), target: new THREE.Vector3(0, 0.8, 0.45), width: 5.2, height: 4.2 };
  }
  return { position: new THREE.Vector3(0, 4.2, 7.8), target: new THREE.Vector3(0, 1.08, 0.1), width: 6.6, height: 4.5 };
}

const FREE_TARGET = new THREE.Vector3(0, 0.85, 0.2);
const MIN_PITCH = 0.12;
const MAX_PITCH = 1.45;

/**
 * Follows the selected preset. Holding the right mouse button switches to a free
 * orbit around the table (drag to turn, wheel to zoom); releasing it eases back.
 */
function CameraRig({ mode, mySeat, seats }: { mode: CameraMode; mySeat: number | null; seats: number }) {
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const look = useRef(new THREE.Vector3(0, 0.8, 0.3));
  const pose = useMemo(() => poseFor(mode, mySeat, seats), [mode, mySeat, seats]);
  const first = useRef(true);
  const free = useRef({ active: false, yaw: 0, pitch: 0.4, radius: 9, zoom: 1, x: 0, y: 0 });
  const setFree = useFreeCam((s) => s.set);
  const desired = useRef(new THREE.Vector3());

  useEffect(() => {
    const el = gl.domElement;
    const stop = () => {
      if (!free.current.active) return;
      free.current.active = false;
      setFree(false);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      const f = free.current;
      const rel = get().camera.position.clone().sub(FREE_TARGET);
      const len = Math.max(0.001, rel.length());
      f.radius = Math.max(5, len);
      f.yaw = Math.atan2(rel.x, rel.z);
      f.pitch = THREE.MathUtils.clamp(Math.asin(rel.y / len), MIN_PITCH, MAX_PITCH);
      f.zoom = 1;
      f.x = e.clientX;
      f.y = e.clientY;
      f.active = true;
      setFree(true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-released pointers cannot be captured.
      }
    };
    const onMove = (e: PointerEvent) => {
      const f = free.current;
      if (!f.active) return;
      if (!(e.buttons & 2)) return stop();
      f.yaw -= (e.clientX - f.x) * 0.006;
      f.pitch = THREE.MathUtils.clamp(f.pitch + (e.clientY - f.y) * 0.005, MIN_PITCH, MAX_PITCH);
      f.x = e.clientX;
      f.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (e.button === 2 || !(e.buttons & 2)) stop();
    };
    const onWheel = (e: WheelEvent) => {
      if (!free.current.active) return;
      e.preventDefault();
      free.current.zoom = THREE.MathUtils.clamp(free.current.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.55, 2.8);
    };
    const onMenu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("lostpointercapture", stop);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onMenu);
    window.addEventListener("blur", stop);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("lostpointercapture", stop);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onMenu);
      window.removeEventListener("blur", stop);
      setFree(false);
    };
  }, [gl, get, setFree]);

  useFrame((state, dt) => {
    const camera = state.camera as THREE.OrthographicCamera;
    const baseZoom = Math.min(state.size.width / pose.width, state.size.height / pose.height);
    const f = free.current;
    if (first.current) {
      camera.position.copy(pose.position);
      look.current.copy(pose.target);
      camera.zoom = baseZoom;
      first.current = false;
    } else if (f.active) {
      const k = 1 - Math.exp(-14 * Math.min(dt, 0.1));
      desired.current
        .set(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch))
        .multiplyScalar(f.radius)
        .add(FREE_TARGET);
      camera.position.lerp(desired.current, k);
      look.current.lerp(FREE_TARGET, k);
      camera.zoom += (baseZoom * f.zoom - camera.zoom) * k;
    } else {
      const k = 1 - Math.exp(-4 * Math.min(dt, 0.1));
      camera.position.lerp(pose.position, k);
      look.current.lerp(pose.target, k);
      camera.zoom += (baseZoom - camera.zoom) * k;
    }
    camera.lookAt(look.current);
    camera.updateProjectionMatrix();
  });
  return null;
}

export default function GameScene(props: GameSceneProps) {
  const { config, state, mySeat, timeline, camera, pixelSize, emotes } = props;
  const view = useMemo(() => {
    if (camera === "player" && mySeat !== null) {
      const a = seatAngle(mySeat, config.seats);
      const up = polar(a, 1).multiplyScalar(-1);
      const right = new THREE.Vector3(-up.z, 0, up.x);
      return { up, right, cardYaw: Math.atan2(-up.x, -up.z) };
    }
    return viewBasis(1);
  }, [camera, mySeat, config.seats]);

  return (
    <Canvas
      shadows
      dpr={1}
      flat
      orthographic
      camera={{ position: [0, 5.3, 7.4], zoom: 150, near: 0.1, far: 60 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <color attach="background" args={["#120c1c"]} />
      <DevAdvance />
      <PixelPipeline pixelSize={pixelSize} />
      <CameraRig mode={camera} mySeat={mySeat} seats={config.seats} />
      <CasinoLights />
      <Suspense fallback={null}>
        <CasinoRoom />
        <BlackjackTable config={config} shoe={state.shoe} />
        <Dealer state={state} config={config} timeline={timeline} view={view} talking={props.dealerTalking} />
        {Array.from({ length: config.seats }, (_, i) => {
          const seat = state.seats[i];
          return (
            <SeatSpot
              key={i}
              index={i}
              config={config}
              state={state}
              seat={seat}
              isMine={mySeat === i}
              canSit={props.canSit && (!seat || (seat.bot && seat.hands.length === 0))}
              onSit={props.onSit}
              timeline={timeline}
              view={view}
              emote={seat ? emotes[seat.uid] : undefined}
              chatLine={seat ? props.chatLines[seat.uid] : undefined}
              serverNow={props.serverNow}
            />
          );
        })}
        <CardsLayer state={state} config={config} timeline={timeline} view={view} />
      </Suspense>
    </Canvas>
  );
}
