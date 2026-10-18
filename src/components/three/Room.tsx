"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import assets from "@/lib/generated/assets.json";

type PropName = keyof typeof assets.props;

function Prop({
  name,
  position,
  rotation = 0,
  scale = 1,
}: {
  name: PropName;
  position: [number, number, number];
  rotation?: number;
  scale?: number | [number, number, number];
}) {
  const { scene } = useGLTF(assets.props[name].file);
  const object = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  }, [scene]);
  return <primitive object={object} position={position} rotation={[0, rotation, 0]} scale={scale} />;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
}

function carpet() {
  return canvasTexture(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = "#4a1426";
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = "#5e1b31";
      for (let i = 0; i < 32; i += 4) for (let j = (i / 4) % 2 ? 2 : 0; j < 32; j += 4) ctx.fillRect(i, j, 2, 2);
      ctx.fillStyle = "#b8862d";
      for (let i = 0; i < 16; i++) {
        ctx.fillRect(16 + i, i, 1, 1);
        ctx.fillRect(16 - i, i, 1, 1);
        ctx.fillRect(i, 16 + i, 1, 1);
        ctx.fillRect(32 - i, 16 + i, 1, 1);
      }
      ctx.fillStyle = "#e3b44a";
      ctx.fillRect(15, 15, 2, 2);
      ctx.fillRect(0, 0, 1, 1);
    },
    [26, 26],
  );
}

function wallpaper() {
  return canvasTexture(
    32,
    64,
    (ctx) => {
      // Upper damask
      ctx.fillStyle = "#2a1638";
      ctx.fillRect(0, 0, 32, 40);
      ctx.fillStyle = "#3a2150";
      for (let y = 4; y < 40; y += 12) {
        for (let x = 4; x < 32; x += 16) {
          ctx.fillRect(x + 3, y, 2, 1);
          ctx.fillRect(x + 1, y + 1, 6, 2);
          ctx.fillRect(x + 2, y + 3, 4, 2);
          ctx.fillRect(x + 3, y + 5, 2, 2);
        }
      }
      // Gold rail
      ctx.fillStyle = "#c9a24b";
      ctx.fillRect(0, 40, 32, 2);
      // Wood wainscot
      ctx.fillStyle = "#3a2214";
      ctx.fillRect(0, 42, 32, 22);
      ctx.fillStyle = "#4b2d1a";
      ctx.fillRect(2, 45, 12, 16);
      ctx.fillRect(18, 45, 12, 16);
      ctx.fillStyle = "#2a170c";
      ctx.fillRect(0, 62, 32, 2);
    },
    [14, 1],
  );
}

function neon(text: string, color: string) {
  return canvasTexture(256, 48, (ctx) => {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 256, 48);
    const family = getComputedStyle(document.body).getPropertyValue("--font-arcade").trim() || "monospace";
    ctx.font = `24px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    for (const [dx, dy] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ]) {
      ctx.fillText(text, 128 + dx, 25 + dy);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff4f8";
    ctx.fillText(text, 128, 25);
  });
}

function NeonSign({ text, color, position, width }: { text: string; color: string; position: [number, number, number]; width: number }) {
  const tex = useMemo(() => neon(text, color), [text, color]);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useEffect(() => {
    // Redraw when the pixel font is ready.
    document.fonts?.ready.then(() => {
      const fresh = neon(text, color);
      tex.image = fresh.image;
      tex.needsUpdate = true;
    });
  }, [tex, text, color]);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const t = clock.elapsedTime;
    const flicker = Math.sin(t * 2.1) > 0.97 ? 0.55 : 1;
    mat.current.color.setScalar(flicker);
  });
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[width, (width * 48) / 256]} />
        <meshBasicMaterial ref={mat} map={tex} transparent blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={1.6} distance={7} decay={1} position={[0, 0, 0.6]} />
    </group>
  );
}

const FRUITS = ["#e5484d", "#f6c544", "#3fbf6f", "#4c9bff", "#c084fc", "#ffffff"];

function SlotMachine({ position, rotation = 0, seed }: { position: [number, number, number]; rotation?: number; seed: number }) {
  const { tex, ctx } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 12;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return { tex, ctx };
  }, []);
  const lamp = useRef<THREE.MeshBasicMaterial>(null);
  const last = useRef(-1);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.7;
    const step = Math.floor(t * 6);
    const spinning = Math.floor(t / 4) % 3 === 0;
    if (step !== last.current && (spinning || last.current < 0)) {
      last.current = step;
      ctx.fillStyle = "#10081a";
      ctx.fillRect(0, 0, 24, 12);
      for (let r = 0; r < 3; r++) {
        const idx = spinning ? (step + r * 3 + seed) % FRUITS.length : (seed + r) % 3;
        ctx.fillStyle = "#f8f3e6";
        ctx.fillRect(1 + r * 8, 1, 6, 10);
        ctx.fillStyle = FRUITS[idx];
        ctx.fillRect(2 + r * 8, 3, 4, 4);
        ctx.fillRect(3 + r * 8, 2, 2, 6);
      }
      tex.needsUpdate = true;
    }
    if (lamp.current) lamp.current.color.set(Math.floor(t * 3) % 2 ? "#ff4d6d" : "#ffd54a");
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[0.7, 1.6, 0.6]} />
        <meshLambertMaterial color="#7a1430" />
      </mesh>
      <mesh position={[0, 1.15, 0.305]}>
        <planeGeometry args={[0.52, 0.26]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.67, 0]}>
        <boxGeometry args={[0.5, 0.14, 0.4]} />
        <meshBasicMaterial ref={lamp} color="#ffd54a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.72, 0.33]}>
        <boxGeometry args={[0.6, 0.06, 0.12]} />
        <meshLambertMaterial color="#c9a24b" />
      </mesh>
      <mesh position={[0.4, 1.0, 0.1]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
        <meshLambertMaterial color="#d9d9d9" />
      </mesh>
      <mesh position={[0.43, 1.22, 0.1]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshLambertMaterial color="#e5484d" />
      </mesh>
    </group>
  );
}

export function CasinoRoom() {
  const floor = useMemo(() => carpet(), []);
  const wall = useMemo(() => wallpaper(), []);
  const BACK = -3.7;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[26, 26]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      {/* Walls */}
      <mesh position={[0, 2.5, BACK]} receiveShadow>
        <planeGeometry args={[26, 5]} />
        <meshLambertMaterial map={wall} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 6.4, 2.5, 2]} rotation={[0, -side * (Math.PI / 2), 0]} receiveShadow>
          <planeGeometry args={[14, 5]} />
          <meshLambertMaterial map={wall} />
        </mesh>
      ))}

      {/* Front wall behind the players: single-sided, so it hides itself when the camera is outside. */}
      <mesh position={[0, 2.5, 6.6]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[26, 5]} />
        <meshLambertMaterial map={wall} />
      </mesh>
      <Prop name="cactus_medium_A" position={[-5.6, 0, 6.1]} scale={0.7} />
      <Prop name="cactus_medium_A" position={[5.6, 0, 6.1]} scale={0.7} />
      <Prop name="pillar_A" position={[-2.3, 0, 6.25]} scale={0.75} />
      <Prop name="pillar_A" position={[2.3, 0, 6.25]} scale={0.75} />

      <NeonSign text="BLACKJACK" color="#ff4d8d" position={[0, 1.62, BACK + 0.05]} width={2.4} />
      <NeonSign text="TERRAZA" color="#4cd7ff" position={[-3.6, 1.45, BACK + 0.05]} width={1.4} />

      <Prop name="pillar_A" position={[-2.3, 0, BACK + 0.35]} scale={0.75} />
      <Prop name="pillar_A" position={[2.3, 0, BACK + 0.35]} scale={0.75} />
      <Prop name="pictureframe_large_B" position={[3.7, 1.1, BACK + 0.08]} scale={0.6} />
      <Prop name="pictureframe_large_A" position={[-1.75, 1.15, BACK + 0.08]} scale={0.5} />
      <Prop name="pictureframe_large_A" position={[1.75, 1.15, BACK + 0.08]} scale={0.5} />

      {/* Lounge corner (left) */}
      <Prop name="rug_oval_A" position={[-4.4, 0.01, BACK + 1.6]} scale={0.8} />
      <Prop name="couch_pillows" position={[-4.4, 0, BACK + 0.6]} scale={0.62} />
      <Prop name="armchair" position={[-5.6, 0, BACK + 2.0]} rotation={Math.PI / 2} scale={0.62} />
      <Prop name="table_low" position={[-4.4, 0, BACK + 1.6]} scale={0.5} />
      <Prop name="lamp_standing" position={[-5.9, 0, BACK + 0.45]} scale={0.75} />
      <pointLight position={[-5.9, 1.8, BACK + 0.6]} color="#ffcf8a" intensity={1.3} distance={5} decay={1} />
      <Prop name="cactus_medium_A" position={[-1.7, 0, BACK + 0.4]} scale={0.7} />
      <Prop name="cactus_small_B" position={[1.7, 0, BACK + 0.4]} scale={0.8} />

      {/* Right side: shelf, lamp and slot machines */}
      <Prop name="shelf_B_large_decorated" position={[4.1, 0, BACK + 0.28]} scale={0.7} />
      <Prop name="lamp_standing" position={[5.9, 0, BACK + 0.45]} scale={0.75} />
      <pointLight position={[5.9, 1.8, BACK + 0.6]} color="#ffcf8a" intensity={1.3} distance={5} decay={1} />
      {[0, 1, 2].map((i) => (
        <SlotMachine key={i} position={[5.85, 0, -1.6 + i * 0.95]} rotation={-Math.PI / 2} seed={i} />
      ))}
      {[0, 1].map((i) => (
        <SlotMachine key={`l${i}`} position={[-5.85, 0, 0.2 + i * 0.95]} rotation={Math.PI / 2} seed={i + 3} />
      ))}
    </group>
  );
}

export function CasinoLights() {
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.8, 0.3);
    return o;
  }, []);
  return (
    <>
      <ambientLight intensity={0.75} color="#8d7cc4" />
      <hemisphereLight args={["#ffe2b0", "#2b1830", 0.55]} />
      <primitive object={target} />
      <spotLight
        position={[0, 3.4, 0.3]}
        target={target}
        angle={0.95}
        penumbra={0.55}
        intensity={2.6}
        decay={0}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-near={0.5}
        shadow-camera-far={8}
      />
      <directionalLight position={[-4, 6, 6]} intensity={0.45} color="#a3b8ff" />
    </>
  );
}
