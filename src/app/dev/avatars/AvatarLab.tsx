"use client";

import { useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { Avatar, type Reaction } from "@/components/three/Avatar";
import { DevAdvance } from "@/components/three/DevAdvance";
import { PixelPipeline } from "@/components/three/PixelPipeline";
import assets from "@/lib/generated/assets.json";

const CASES: { id: string; seated: boolean; base?: string; label: string }[] = [
  { id: "kate", seated: true, label: "sit_idle" },
  { id: "mafiossini", seated: true, base: "sit_talk", label: "sit_talk" },
  { id: "olivia", seated: true, base: "sit_chair", label: "sit_chair" },
  { id: "bizdude", seated: false, label: "idle" },
  { id: "oldmoustache", seated: false, base: "fold_arms", label: "fold_arms" },
  { id: "coolmoneybag", seated: false, base: "dance", label: "dance" },
  { id: "erika", seated: false, base: "interact", label: "interact" },
];

function Stool() {
  const { scene } = useGLTF(assets.props.chair_stool.file);
  return <primitive object={scene.clone()} scale={1.24} />;
}

export function AvatarLab() {
  const [pixel, setPixel] = useState(3);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [clip, setClip] = useState("cheer");

  useEffect(() => {
    const w = window as unknown as { __bjReact?: (clip: string) => void };
    w.__bjReact = (c: string) => setReaction({ clip: c, key: Date.now() });
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-wrap items-center gap-2 p-3">
        {[1, 2, 3, 4].map((p) => (
          <button key={p} className={`pixel-btn ${pixel === p ? "btn-gold" : ""}`} onClick={() => setPixel(p)}>
            px {p}
          </button>
        ))}
        {["cheer", "yes", "no", "drink", "hit_head", "flinch", "use_item"].map((c) => (
          <button
            key={c}
            className={`pixel-btn ${clip === c ? "btn-green" : ""}`}
            onClick={() => {
              setClip(c);
              setReaction({ clip: c, key: Date.now() });
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex-1">
        <Canvas
          shadows
          dpr={1}
          flat
          orthographic
          camera={{ position: [0, 3.2, 7], zoom: 110, near: 0.1, far: 50 }}
          onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}
        >
          <color attach="background" args={["#1b1530"]} />
          <DevAdvance />
          <PixelPipeline pixelSize={pixel} />
          <ambientLight intensity={1.1} color="#b9a7e8" />
          <directionalLight position={[3, 6, 5]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[30, 30]} />
            <meshLambertMaterial color="#4a2338" />
          </mesh>
          <Suspense fallback={null}>
            {CASES.map((c, i) => (
              <group key={c.id} position={[(i - (CASES.length - 1) / 2) * 1.25, 0, 0]}>
                {c.seated && <Stool />}
                <Avatar
                  id={c.id}
                  seated={c.seated}
                  base={c.base}
                  reaction={reaction}
                  mood={i % 2 ? "joy" : "neutral"}
                  talking={c.base === "sit_talk"}
                  position={[0, c.seated ? 0.62 : 0, 0]}
                />
              </group>
            ))}
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
