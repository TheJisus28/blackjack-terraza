"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { themeOf } from "@/lib/game/tables";
import type { TableConfig } from "@/lib/game/types";
import { cardGeometry, cardMaterialShared, chipGeometry, chipMaterialSet } from "./assets";
import {
  BET_R,
  CARD_T,
  CHIP_H,
  DISCARD_POS,
  INSURANCE_R,
  RAIL_R,
  SHOE_POS,
  TABLE_BACK,
  TABLE_R,
  TABLE_Y,
  TRAY_POS,
  SIDE_SPOT_RADIUS,
  seatAngle,
  sideSpotPosition,
} from "./layout";
import { SIDE_BETS, SIDE_BET_IDS } from "@/lib/game/sidebets";

const MIN_X = -TABLE_R - 0.05;
const MAX_X = TABLE_R + 0.05;
const MIN_Z = -TABLE_BACK - 0.02;
const MAX_Z = TABLE_R + 0.05;
const TEX_W = 480;
const TEX_H = Math.round((TEX_W * (MAX_Z - MIN_Z)) / (MAX_X - MIN_X));

const toCanvas = (x: number, z: number): [number, number] => [
  ((x - MIN_X) / (MAX_X - MIN_X)) * TEX_W,
  ((z - MIN_Z) / (MAX_Z - MIN_Z)) * TEX_H,
];
const scale = TEX_W / (MAX_X - MIN_X);

function tableShape() {
  const shape = new THREE.Shape();
  shape.moveTo(TABLE_R, 0);
  const steps = 48;
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    // Shape space y = -world z after rotateX(-90°): the arc bulges towards +Z.
    shape.lineTo(Math.cos(a) * TABLE_R, -Math.sin(a) * TABLE_R);
  }
  shape.lineTo(-TABLE_R, TABLE_BACK);
  shape.lineTo(TABLE_R, TABLE_BACK);
  shape.closePath();
  return shape;
}

function arcText(ctx: CanvasRenderingContext2D, text: string, radius: number, size: number, color: string, spread = 1) {
  const [cx, cy] = toCanvas(0, 0);
  const r = radius * scale;
  ctx.save();
  ctx.font = `${size}px ${arcadeFont()}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const widths = [...text].map((ch) => ctx.measureText(ch).width * spread);
  const total = widths.reduce((a, b) => a + b, 0);
  let angle = Math.PI / 2 + total / r / 2;
  for (let i = 0; i < text.length; i++) {
    const w = widths[i];
    angle -= w / r / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.rotate(angle - Math.PI / 2);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    angle -= w / r / 2;
  }
  ctx.restore();
}

function arcadeFont() {
  if (typeof document === "undefined") return "monospace";
  const family = getComputedStyle(document.body).getPropertyValue("--font-arcade").trim();
  return family ? `${family}, monospace` : "monospace";
}

function drawFelt(canvas: HTMLCanvasElement, config: TableConfig) {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const theme = themeOf(config.theme);
  const felt = new THREE.Color(theme.felt);
  const shade = (k: number) => `#${felt.clone().multiplyScalar(k).getHexString()}`;
  ctx.imageSmoothingEnabled = false;

  // Dithered felt.
  ctx.fillStyle = theme.felt;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < TEX_H; y += 2) {
    for (let x = 0; x < TEX_W; x += 2) {
      const r = rand();
      if (r < 0.12) {
        ctx.fillStyle = shade(0.86);
        ctx.fillRect(x, y, 2, 2);
      } else if (r > 0.94) {
        ctx.fillStyle = shade(1.12);
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
  // Darker rim towards the rail.
  const [cx, cy] = toCanvas(0, 0);
  ctx.strokeStyle = shade(0.72);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, TABLE_R * scale - 5, 0, Math.PI);
  ctx.stroke();

  const gold = theme.accent;
  // Insurance band.
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  for (const r of [INSURANCE_R - 0.07, INSURANCE_R + 0.07]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
  }
  if (config.insurance) arcText(ctx, "SEGURO PAGA 2 A 1", INSURANCE_R, 8, gold, 1.05);

  const bj = config.blackjackPays >= 1.5 ? "BLACKJACK PAGA 3 A 2" : "BLACKJACK PAGA 6 A 5";
  arcText(ctx, bj, 1.0, 9, gold, 1.05);
  arcText(
    ctx,
    config.hitSoft17 ? "EL CRUPIER PIDE CON 17 SUAVE" : "EL CRUPIER SE PLANTA EN 17",
    0.47,
    7,
    shade(1.55),
  );

  // Betting circles.
  for (let i = 0; i < config.seats; i++) {
    const a = seatAngle(i, config.seats);
    const [x, y] = toCanvas(Math.cos(a) * BET_R, Math.sin(a) * BET_R);
    ctx.fillStyle = shade(0.78);
    ctx.beginPath();
    ctx.arc(x, y, 0.14 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 0.14 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 0.11 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Side-bet rings, colour coded like the betting panel.
  if (config.sideBets) {
    for (let i = 0; i < config.seats; i++) {
      const a = seatAngle(i, config.seats);
      SIDE_BET_IDS.forEach((id, k) => {
        const p = sideSpotPosition(a, k);
        const [x, y] = toCanvas(p.x, p.z);
        ctx.fillStyle = shade(0.7);
        ctx.beginPath();
        ctx.arc(x, y, SIDE_SPOT_RADIUS * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = SIDE_BETS[id].color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, SIDE_SPOT_RADIUS * scale, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  // House emblem near the dealer.
  const [lx, ly] = toCanvas(0, 0.2);
  ctx.save();
  ctx.font = `10px ${arcadeFont()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = shade(0.7);
  ctx.fillText("TERRAZA", lx + 1, ly + 1);
  ctx.fillStyle = gold;
  ctx.fillText("TERRAZA", lx, ly);
  ctx.font = `6px ${arcadeFont()}`;
  ctx.fillStyle = shade(1.6);
  ctx.fillText("♠ ♥ CASINO ♦ ♣", lx, ly + 12);
  ctx.restore();
}

function useFeltTexture(config: TableConfig) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    drawFelt(canvas, config);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }, [config]);

  // Redraw once the pixel font is ready so the printed rules use it.
  useEffect(() => {
    let alive = true;
    document.fonts?.load(`9px ${arcadeFont()}`).then(() => {
      if (!alive) return;
      drawFelt(texture.image as HTMLCanvasElement, config);
      texture.needsUpdate = true;
    });
    return () => {
      alive = false;
    };
  }, [texture, config]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function feltGeometry() {
  const geo = new THREE.ShapeGeometry(tableShape(), 24);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, (x - MIN_X) / (MAX_X - MIN_X), 1 - (z - MIN_Z) / (MAX_Z - MIN_Z));
  }
  uv.needsUpdate = true;
  return geo;
}

class ArcCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private radius: number, private y: number) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * Math.PI;
    return target.set(Math.cos(a) * this.radius, this.y, Math.sin(a) * this.radius);
  }
}

const WOOD = "#5b331a";
const WOOD_DARK = "#36200f";
const LEATHER = "#2b1611";

function ChipTray() {
  const columns = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <group position={TRAY_POS}>
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.98, 0.024, 0.2]} />
        <meshLambertMaterial color="#1a1a1f" />
      </mesh>
      {columns.map((i) => {
        const x = (i - (columns.length - 1) / 2) * 0.115;
        const height = 0.05 + ((i * 37) % 5) * 0.012;
        return (
          <mesh
            key={i}
            geometry={chipGeometry(i)}
            material={chipMaterialSet(i)}
            position={[x, 0.024 + height / 2, 0.01]}
            scale={[0.95, height / CHIP_H, 0.95]}
            castShadow
          />
        );
      })}
    </group>
  );
}

function Shoe({ remaining, total }: { remaining: number; total: number }) {
  const fill = total > 0 ? remaining / total : 1;
  return (
    <group position={SHOE_POS} rotation={[0, -0.35, 0]}>
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.24, 0.14, 0.36]} />
        <meshLambertMaterial color="#5a1520" />
      </mesh>
      <mesh position={[0, 0.06, 0.181]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.22, 0.12, 0.01]} />
        <meshLambertMaterial color="#14090b" />
      </mesh>
      {/* Remaining cards peeking out of the front. */}
      <mesh position={[0, 0.03 + 0.06 * fill, 0.12]} geometry={cardGeometry("XX", false)} material={cardMaterialShared()} />
    </group>
  );
}

function Discard({ used }: { used: number }) {
  const h = Math.max(0.004, Math.min(0.12, used * 0.0011));
  return (
    <group position={DISCARD_POS} rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.24, 0.1, 0.32]} />
        <meshLambertMaterial color="#22222a" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, h / 2 + CARD_T, 0]} castShadow>
        <boxGeometry args={[0.19, h, 0.27]} />
        <meshLambertMaterial color="#d8dde8" />
      </mesh>
      <mesh position={[0, h + CARD_T * 2, 0]} geometry={cardGeometry("XX")} material={cardMaterialShared()} />
    </group>
  );
}

export function BlackjackTable({ config, shoe }: { config: TableConfig; shoe: { remaining: number; total: number } }) {
  const felt = useFeltTexture(config);
  const theme = themeOf(config.theme);
  const geometries = useMemo(() => {
    const shape = tableShape();
    const body = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 1 });
    body.rotateX(-Math.PI / 2);
    const skirtShape = tableShape();
    const skirt = new THREE.ExtrudeGeometry(skirtShape, { depth: TABLE_Y - 0.25, bevelEnabled: false });
    skirt.rotateX(-Math.PI / 2);
    skirt.scale(0.82, 1, 0.82);
    const rail = new THREE.TubeGeometry(new ArcCurve(TABLE_R + 0.04, TABLE_Y + 0.025), 40, RAIL_R, 8, false);
    return { felt: feltGeometry(), body, skirt, rail };
  }, []);

  useEffect(
    () => () => {
      for (const g of Object.values(geometries)) g.dispose();
    },
    [geometries],
  );

  return (
    <group>
      <mesh geometry={geometries.felt} position={[0, TABLE_Y + 0.001, 0]} receiveShadow>
        <meshLambertMaterial map={felt} />
      </mesh>
      <mesh geometry={geometries.body} position={[0, TABLE_Y - 0.16, 0]} castShadow receiveShadow>
        <meshLambertMaterial color={WOOD} />
      </mesh>
      <mesh geometry={geometries.skirt} position={[0, 0.12, 0]} castShadow>
        <meshLambertMaterial color={WOOD_DARK} />
      </mesh>
      <mesh geometry={geometries.rail} castShadow receiveShadow>
        <meshLambertMaterial color={LEATHER} />
      </mesh>
      {[0, Math.PI].map((a) => (
        <mesh key={a} position={[Math.cos(a) * (TABLE_R + 0.04), TABLE_Y + 0.025, 0]}>
          <sphereGeometry args={[RAIL_R, 8, 6]} />
          <meshLambertMaterial color={LEATHER} />
        </mesh>
      ))}
      {/* Brass trim on the dealer edge. */}
      <mesh position={[0, TABLE_Y + 0.01, -TABLE_BACK + 0.01]} castShadow>
        <boxGeometry args={[TABLE_R * 2 + 0.06, 0.03, 0.04]} />
        <meshLambertMaterial color={theme.accent} />
      </mesh>
      <ChipTray />
      <Shoe remaining={shoe.remaining} total={shoe.total} />
      <Discard used={Math.max(0, shoe.total - shoe.remaining)} />
    </group>
  );
}
