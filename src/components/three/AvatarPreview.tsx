"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import type * as THREE from "three";
import { Avatar, type Reaction } from "./Avatar";
import { DevAdvance } from "./DevAdvance";
import { PixelPipeline } from "./PixelPipeline";

function Turntable({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.35;
  });
  return <group ref={ref}>{children}</group>;
}

export default function AvatarPreview({ id, base = "idle" }: { id: string; base?: string }) {
  const reaction = useMemo<Reaction>(() => ({ clip: "cheer", key: 1 }), []);
  return (
    <Canvas
      dpr={1}
      flat
      shadows
      orthographic
      camera={{ position: [0, 1.6, 6], zoom: 150, near: 0.1, far: 30 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}
      gl={{ antialias: false }}
    >
      <color attach="background" args={["#161127"]} />
      <DevAdvance />
      <PixelPipeline pixelSize={3} />
      <ambientLight intensity={1.0} color="#9d8ad6" />
      <directionalLight position={[2.5, 4, 4]} intensity={2.2} castShadow shadow-mapSize={[512, 512]} />
      <pointLight position={[-2, 1.5, -1]} intensity={1.5} color="#ff4d8d" decay={0} />
      <Suspense fallback={null}>
        <Turntable>
          <mesh position={[0, -0.04, 0]} receiveShadow>
            <cylinderGeometry args={[0.75, 0.82, 0.08, 20]} />
            <meshLambertMaterial color="#2c2350" />
          </mesh>
          <mesh position={[0, 0.005, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.6, 0.68, 20]} />
            <meshBasicMaterial color="#f6c544" />
          </mesh>
          <Avatar key={id} id={id} base={base} reaction={reaction} mood="joy" />
        </Turntable>
      </Suspense>
    </Canvas>
  );
}
