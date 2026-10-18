"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { seatIndices } from "@/lib/game/normalize";
import { HIDDEN_CARD, type TableConfig, type TableState } from "@/lib/game/types";
import { cardKey, type DealTimeline } from "@/components/table/timeline";
import { cardGeometry, cardMaterialShared } from "./assets";
import {
  DISCARD_POS,
  SHOE_POS,
  dealerCardPosition,
  playerCardPosition,
  seatAngle,
  type ViewBasis,
} from "./layout";

const DEAL_MS = 430;
const FLIP_MS = 220;
const LEAVE_MS = 520;

interface CardSpec {
  key: string;
  code: string;
  target: THREE.Vector3;
  yaw: number;
}

interface Ghost extends CardSpec {
  leaveAt: number;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const shoeStart = SHOE_POS.clone().add(new THREE.Vector3(-0.05, 0.12, 0.12));

function buildSpecs(state: TableState, config: TableConfig, view: ViewBasis): CardSpec[] {
  const out: CardSpec[] = [];
  for (const idx of seatIndices(state)) {
    const seat = state.seats[idx];
    const angle = seatAngle(idx, config.seats);
    seat.hands.forEach((hand, h) => {
      hand.cards.forEach((card, k) => {
        out.push({
          key: cardKey(state.round, card.n),
          code: card.c,
          target: playerCardPosition(angle, h, seat.hands.length, k, view),
          yaw: view.cardYaw,
        });
      });
    });
  }
  state.dealer.cards.forEach((card, k) => {
    out.push({ key: cardKey(state.round, card.n), code: card.c, target: dealerCardPosition(k, view), yaw: view.cardYaw });
  });
  return out;
}

function Card({ spec, timeline, leaveAt }: { spec: CardSpec; timeline: DealTimeline; leaveAt?: number }) {
  const outer = useRef<THREE.Group>(null);
  const flip = useRef<THREE.Group>(null);
  const flipAngle = useRef(Math.PI);
  const yaw = useRef(spec.yaw);
  const faceGeo = useMemo(() => cardGeometry(spec.code === HIDDEN_CARD ? "XX" : spec.code), [spec.code]);
  const backGeo = useMemo(() => cardGeometry("XX", true), []);
  const material = cardMaterialShared();
  const from = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const g = outer.current;
    const f = flip.current;
    if (!g || !f) return;
    const now = performance.now();
    const timing = timeline.timing(spec.key);
    const at = timing?.at ?? now - 10_000;

    if (leaveAt !== undefined) {
      if (from.current.lengthSq() === 0) from.current.copy(g.position);
      const p = Math.min(1, Math.max(0, (now - leaveAt) / LEAVE_MS));
      const e = easeOut(p);
      g.position.lerpVectors(from.current, DISCARD_POS.clone().setY(DISCARD_POS.y + 0.08), e);
      g.position.y += Math.sin(p * Math.PI) * 0.15;
      flipAngle.current = THREE.MathUtils.damp(flipAngle.current, Math.PI, 10, dt);
      f.rotation.z = flipAngle.current;
      g.visible = p < 1;
      return;
    }

    const p = Math.min(1, Math.max(0, (now - at) / DEAL_MS));
    g.visible = now >= at;
    const e = easeOut(p);
    g.position.lerpVectors(shoeStart, spec.target, e);
    g.position.y += Math.sin(p * Math.PI) * 0.16;
    yaw.current = p < 1 ? THREE.MathUtils.lerp(-0.6, spec.yaw, e) : THREE.MathUtils.damp(yaw.current, spec.yaw, 8, dt);
    g.rotation.y = yaw.current;

    const faceUp = spec.code !== HIDDEN_CARD && now >= (timing?.flipAt ?? 0);
    const targetFlip = faceUp ? 0 : Math.PI;
    const step = (Math.PI / FLIP_MS) * 1000 * dt;
    if (Math.abs(flipAngle.current - targetFlip) > 1e-3) {
      flipAngle.current += Math.sign(targetFlip - flipAngle.current) * Math.min(step, Math.abs(targetFlip - flipAngle.current));
    }
    f.rotation.z = flipAngle.current;
    const flipping = Math.abs(flipAngle.current - targetFlip) > 1e-3;
    f.position.y = flipping ? Math.sin(flipAngle.current) * 0.06 : 0;
  });

  return (
    <group ref={outer} visible={false}>
      <group ref={flip}>
        <mesh geometry={faceGeo} material={material} castShadow />
        <mesh geometry={backGeo} material={material} />
      </group>
    </group>
  );
}

export function CardsLayer({
  state,
  config,
  timeline,
  view,
}: {
  state: TableState;
  config: TableConfig;
  timeline: DealTimeline;
  view: ViewBasis;
}) {
  const specs = useMemo(() => buildSpecs(state, config, view), [state, config, view]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const previous = useRef<CardSpec[]>([]);

  useEffect(() => {
    const keys = new Set(specs.map((s) => s.key));
    const gone = previous.current.filter((s) => !keys.has(s.key));
    previous.current = specs;
    if (!gone.length) return;
    const now = performance.now();
    setGhosts((g) => [...g, ...gone.map((s, i) => ({ ...s, leaveAt: now + i * 35 }))]);
    const id = setTimeout(() => setGhosts((g) => g.filter((x) => performance.now() - x.leaveAt < LEAVE_MS)), LEAVE_MS + gone.length * 35 + 100);
    return () => clearTimeout(id);
  }, [specs]);

  return (
    <group>
      {specs.map((s) => (
        <Card key={s.key} spec={s} timeline={timeline} />
      ))}
      {ghosts.map((s) => (
        <Card key={`ghost-${s.key}`} spec={s} timeline={timeline} leaveAt={s.leaveAt} />
      ))}
    </group>
  );
}
