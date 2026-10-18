"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { chipBreakdown } from "@/lib/format";
import { chipGeometry, chipMaterialSet } from "./assets";
import { CHIP_H, CHIP_R } from "./layout";

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const MAX_PER_COLUMN = 12;

/** A stack of chips; newly added chips slide in from `from`. */
export function ChipStack({
  amount,
  from,
  maxChips = 30,
}: {
  amount: number;
  /** Local offset new chips fly in from. */
  from?: THREE.Vector3;
  maxChips?: number;
}) {
  const chips = useMemo(() => chipBreakdown(amount, maxChips), [amount, maxChips]);
  return (
    <group>
      {chips.map((chip, i) => {
        const column = Math.floor(i / MAX_PER_COLUMN);
        const row = i % MAX_PER_COLUMN;
        const slot = new THREE.Vector3(column * CHIP_R * 2.1, CHIP_H * (row + 0.5), (column % 2) * CHIP_R * 0.4);
        return <AnimatedChip key={`${i}-${chip.value}`} index={chip.index} slot={slot} from={from} delay={i * 0.025} />;
      })}
    </group>
  );
}

function AnimatedChip({ index, slot, from, delay }: { index: number; slot: THREE.Vector3; from?: THREE.Vector3; delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const born = useRef(0);
  // Deterministic jitter so stacks look hand-placed without impure renders.
  const spin = (index * 2.39 + slot.y * 97 + slot.x * 31) % (Math.PI * 2);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    if (!born.current) born.current = performance.now();
    if (!from) {
      m.position.copy(slot);
      return;
    }
    const p = Math.min(1, Math.max(0, (performance.now() - born.current) / 1000 - delay) / 0.32);
    const e = easeOut(p);
    m.position.lerpVectors(from, slot, e);
    m.position.y += Math.sin(p * Math.PI) * 0.12;
  });
  return (
    <mesh
      ref={ref}
      geometry={chipGeometry(index)}
      material={chipMaterialSet(index)}
      position={from ?? slot}
      rotation={[0, spin, 0]}
      castShadow
    />
  );
}

/** A stack that travels from `start` to `end` between t0 and t0+duration, then hides. */
export function FlyingStack({
  amount,
  start,
  end,
  t0,
  duration = 520,
  hideAtEnd = true,
}: {
  amount: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
  t0: number;
  duration?: number;
  hideAtEnd?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const p = Math.min(1, Math.max(0, (performance.now() - t0) / duration));
    const e = easeOut(p);
    g.position.lerpVectors(start, end, e);
    g.position.y += Math.sin(p * Math.PI) * 0.18;
    g.visible = !(hideAtEnd && p >= 1);
  });
  if (amount <= 0) return null;
  return (
    <group ref={ref} position={start}>
      <ChipStack amount={amount} />
    </group>
  );
}

/** Decorative chips a seated player keeps in front of them, sized by their stack. */
export function PlayerChips({ stack, minBet }: { stack: number; minBet: number }) {
  const columns = useMemo(() => {
    const chips = chipBreakdown(stack, 60);
    const byValue = new Map<number, number[]>();
    chips.forEach((c) => byValue.set(c.index, [...(byValue.get(c.index) ?? []), c.index]));
    const sorted = [...byValue.entries()].sort((a, b) => b[0] - a[0]).slice(0, 4);
    const unit = Math.max(1, minBet);
    return sorted.map(([index, list]) => ({ index, count: Math.min(10, Math.max(1, Math.ceil(list.length * Math.min(1, stack / (unit * 40) + 0.4)))) }));
  }, [stack, minBet]);
  return (
    <group>
      {columns.map((col, c) =>
        Array.from({ length: col.count }, (_, i) => (
          <mesh
            key={`${c}-${i}`}
            geometry={chipGeometry(col.index)}
            material={chipMaterialSet(col.index)}
            position={[c * CHIP_R * 2.15, CHIP_H * (i + 0.5), 0]}
            castShadow
          />
        )),
      )}
    </group>
  );
}
