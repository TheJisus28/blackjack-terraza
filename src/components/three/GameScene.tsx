"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFreeCam } from "@/lib/freecam";
import type { CameraMode } from "@/lib/settings";
import { useViewInsets } from "@/lib/viewport";
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

/**
 * Camera presets. The `tall` variants are for portrait phones, where the area left
 * above the HUD is about as tall as it is wide: the camera looks down more steeply
 * so the table and the seats fill it.
 */
function poseFor(mode: CameraMode, mySeat: number | null, seats: number, tall: boolean): Pose {
  if (mode === "player" && mySeat !== null) {
    const a = seatAngle(mySeat, seats);
    return tall
      ? { position: polar(a, 5.2, 5.8), target: polar(a, 0.1, 0.8), width: 4.1, height: 4.3 }
      : { position: polar(a, 6.2, 4.4), target: polar(a, 0.25, 0.75), width: 4.8, height: 3.0 };
  }
  if (mode === "top") {
    return {
      position: new THREE.Vector3(0, 10, 2.2),
      target: new THREE.Vector3(0, 0.8, 0.45),
      width: tall ? 5.0 : 5.2,
      height: tall ? 4.8 : 4.2,
    };
  }
  return tall
    ? { position: new THREE.Vector3(0, 7.2, 6.8), target: new THREE.Vector3(0, 0.95, 0.35), width: 5.0, height: 4.6 }
    : { position: new THREE.Vector3(0, 4.2, 7.8), target: new THREE.Vector3(0, 1.08, 0.1), width: 6.6, height: 4.5 };
}

const FREE_TARGET = new THREE.Vector3(0, 0.85, 0.2);
const MIN_PITCH = 0.12;
const MAX_PITCH = 1.45;
/** A finger has to travel this far (px) before it starts orbiting, so taps stay taps. */
const TOUCH_SLOP = 10;

/**
 * Follows the selected preset, framed in the part of the screen the HUD leaves free.
 * Holding the right mouse button, or dragging a finger on the table, switches to a
 * free orbit (wheel or pinch to zoom); releasing it eases back to the preset.
 */
function CameraRig({ mode, mySeat, seats }: { mode: CameraMode; mySeat: number | null; seats: number }) {
  const get = useThree((s) => s.get);
  const gl = useThree((s) => s.gl);
  const look = useRef(new THREE.Vector3(0, 0.8, 0.3));
  const poses = useMemo(
    () => ({ wide: poseFor(mode, mySeat, seats, false), tall: poseFor(mode, mySeat, seats, true) }),
    [mode, mySeat, seats],
  );
  const first = useRef(true);
  const free = useRef({ active: false, yaw: 0, pitch: 0.4, radius: 9, zoom: 1, x: 0, y: 0 });
  // Screen shift (px) that centers the view in the free area, eased like the camera.
  const shift = useRef({ x: 0, y: 0 });
  const setFree = useFreeCam((s) => s.set);
  const desired = useRef(new THREE.Vector3());

  useEffect(() => {
    const el = gl.domElement;
    // Drags and pinches on the table belong to the camera, not to page scroll or zoom.
    el.style.touchAction = "none";
    const f = free.current;
    const touches = new Map<number, { x: number; y: number }>();
    const touchStart = { x: 0, y: 0 };
    const pinch = { dist: 0, zoom: 1 };

    const begin = () => {
      const rel = get().camera.position.clone().sub(FREE_TARGET);
      const len = Math.max(0.001, rel.length());
      f.radius = Math.max(5, len);
      f.yaw = Math.atan2(rel.x, rel.z);
      f.pitch = THREE.MathUtils.clamp(Math.asin(rel.y / len), MIN_PITCH, MAX_PITCH);
      f.zoom = 1;
      f.active = true;
      setFree(true);
    };
    const stop = () => {
      if (!f.active) return;
      f.active = false;
      setFree(false);
    };
    const capture = (id: number) => {
      try {
        el.setPointerCapture(id);
      } catch {
        // Synthetic or already-released pointers cannot be captured.
      }
    };
    const orbit = (dx: number, dy: number, speed: number) => {
      f.yaw -= dx * speed;
      f.pitch = THREE.MathUtils.clamp(f.pitch + dy * speed * 0.85, MIN_PITCH, MAX_PITCH);
    };
    const spread = () => {
      const [a, b] = [...touches.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const releaseTouch = (id: number) => {
      touches.delete(id);
      if (touches.size === 0) stop();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        capture(e.pointerId);
        if (touches.size === 1) {
          touchStart.x = e.clientX;
          touchStart.y = e.clientY;
        } else if (touches.size === 2) {
          if (!f.active) begin();
          pinch.dist = spread();
          pinch.zoom = f.zoom;
        }
        return;
      }
      if (e.button !== 2) return;
      e.preventDefault();
      begin();
      f.x = e.clientX;
      f.y = e.clientY;
      capture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        const t = touches.get(e.pointerId);
        if (!t) return;
        const dx = e.clientX - t.x;
        const dy = e.clientY - t.y;
        t.x = e.clientX;
        t.y = e.clientY;
        if (!f.active) {
          if (Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) < TOUCH_SLOP) return;
          begin();
        }
        if (touches.size >= 2) {
          if (pinch.dist > 0) f.zoom = THREE.MathUtils.clamp((pinch.zoom * spread()) / pinch.dist, 0.55, 2.8);
        } else {
          orbit(dx, dy, 0.008);
        }
        return;
      }
      if (!f.active) return;
      if (!(e.buttons & 2)) return stop();
      orbit(e.clientX - f.x, e.clientY - f.y, 0.006);
      f.x = e.clientX;
      f.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return releaseTouch(e.pointerId);
      if (e.button === 2 || !(e.buttons & 2)) stop();
    };
    const onLost = (e: PointerEvent) => {
      if (e.pointerType === "touch") return releaseTouch(e.pointerId);
      stop();
    };
    const onBlur = () => {
      touches.clear();
      stop();
    };
    const onWheel = (e: WheelEvent) => {
      if (!f.active) return;
      e.preventDefault();
      f.zoom = THREE.MathUtils.clamp(f.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.55, 2.8);
    };
    const onMenu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("lostpointercapture", onLost);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onMenu);
    window.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("lostpointercapture", onLost);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onMenu);
      window.removeEventListener("blur", onBlur);
      setFree(false);
    };
  }, [gl, get, setFree]);

  useFrame((state, dt) => {
    const camera = state.camera as THREE.OrthographicCamera;
    const { width, height } = state.size;
    const insets = useViewInsets.getState().insets;
    const freeW = Math.max(80, width - insets.left - insets.right);
    const freeH = Math.max(80, height - insets.top - insets.bottom);
    const pose = freeW / freeH < 1.15 ? poses.tall : poses.wide;
    const baseZoom = Math.min(freeW / pose.width, freeH / pose.height);
    const shiftX = (insets.left - insets.right) / 2;
    const shiftY = (insets.top - insets.bottom) / 2;
    const f = free.current;
    if (first.current) {
      camera.position.copy(pose.position);
      look.current.copy(pose.target);
      camera.zoom = baseZoom;
      shift.current.x = shiftX;
      shift.current.y = shiftY;
      first.current = false;
    } else {
      const k = 1 - Math.exp(-(f.active ? 14 : 4) * Math.min(dt, 0.1));
      if (f.active) {
        desired.current
          .set(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch))
          .multiplyScalar(f.radius)
          .add(FREE_TARGET);
        camera.position.lerp(desired.current, k);
        look.current.lerp(FREE_TARGET, k);
        camera.zoom += (baseZoom * f.zoom - camera.zoom) * k;
      } else {
        camera.position.lerp(pose.position, k);
        look.current.lerp(pose.target, k);
        camera.zoom += (baseZoom - camera.zoom) * k;
      }
      shift.current.x += (shiftX - shift.current.x) * k;
      shift.current.y += (shiftY - shift.current.y) * k;
    }
    camera.lookAt(look.current);
    // Moving the view window the other way moves the picture into the free area.
    const s = shift.current;
    if (Math.abs(s.x) < 0.5 && Math.abs(s.y) < 0.5) {
      if (camera.view?.enabled) camera.clearViewOffset();
    } else {
      camera.setViewOffset(width, height, -s.x, -s.y, width, height);
    }
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
