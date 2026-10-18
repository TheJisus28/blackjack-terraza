"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AvatarInfo } from "@/lib/avatar";
import assets from "@/lib/generated/assets.json";
import { CARD_H, CARD_W, CHIP_H, CHIP_R } from "./layout";

export const ANIMS_URL = "/assets/anims.glb";
export type ClipName = keyof typeof assets.clips;

const REF_HIPS = new THREE.Vector3().fromArray(assets.skeletonHips);
const UPPER_BONES = /^(Spine|Chest|UpperChest|Neck|Head|LeftShoulder|LeftArm|LeftForeArm|LeftHand|RightShoulder|RightArm|RightForeArm|RightHand)/;

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

const clipCache = new Map<string, Map<string, THREE.AnimationClip>>();

/**
 * Clips adapted to one avatar: the hips track is rescaled to its leg length.
 * Each clip also has ":upper" and ":lower" variants to layer reactions on top
 * of a seated pose.
 */
export function avatarClips(base: THREE.AnimationClip[], info: AvatarInfo) {
  const cached = clipCache.get(info.id);
  if (cached) return cached;
  const map = new Map<string, THREE.AnimationClip>();
  const hips = new THREE.Vector3().fromArray(info.hips);
  const scale = hips.y / REF_HIPS.y;
  for (const clip of base) {
    const tracks = clip.tracks.map((track) => {
      if (track.name !== "Hips_jnt.position") return track;
      const t = track.clone();
      for (let i = 0; i < t.values.length; i += 3) {
        t.values[i] = hips.x + (t.values[i] - REF_HIPS.x) * scale;
        t.values[i + 1] = hips.y + (t.values[i + 1] - REF_HIPS.y) * scale;
        t.values[i + 2] = hips.z + (t.values[i + 2] - REF_HIPS.z) * scale;
      }
      return t;
    });
    map.set(clip.name, new THREE.AnimationClip(clip.name, clip.duration, tracks));
    map.set(`${clip.name}:upper`, new THREE.AnimationClip(`${clip.name}:upper`, clip.duration, tracks.filter((t) => UPPER_BONES.test(t.name))));
    map.set(`${clip.name}:lower`, new THREE.AnimationClip(`${clip.name}:lower`, clip.duration, tracks.filter((t) => !UPPER_BONES.test(t.name))));
  }
  clipCache.set(info.id, map);
  return map;
}

/** Hips height at the first frame of a clip (used to sit avatars on stools). */
export function clipHips(clip: THREE.AnimationClip): THREE.Vector3 {
  const track = clip.tracks.find((t) => t.name === "Hips_jnt.position");
  return track ? new THREE.Vector3().fromArray(track.values, 0) : new THREE.Vector3();
}

export class Expressions {
  private bindings = new Map<string, { influences: number[]; index: number; weight: number }[]>();
  private values = new Map<string, number>();
  private meshes: THREE.Mesh[];

  constructor(meshes: THREE.Mesh[], info: AvatarInfo) {
    this.meshes = meshes;
    for (const [name, targets] of Object.entries(info.expressions)) {
      const list: { influences: number[]; index: number; weight: number }[] = [];
      for (const mesh of meshes) {
        const dict = mesh.morphTargetDictionary;
        const influences = mesh.morphTargetInfluences;
        if (!dict || !influences) continue;
        for (const t of targets) {
          const index = dict[t.target];
          if (index !== undefined) list.push({ influences, index, weight: t.weight });
        }
      }
      if (list.length) this.bindings.set(name, list);
    }
  }

  has(name: string) {
    return this.bindings.has(name);
  }

  set(name: string, value: number) {
    this.values.set(name, value);
  }

  get(name: string) {
    return this.values.get(name) ?? 0;
  }

  apply() {
    for (const mesh of this.meshes) mesh.morphTargetInfluences?.fill(0);
    for (const [name, value] of this.values) {
      if (value <= 0.001) continue;
      for (const b of this.bindings.get(name) ?? []) {
        b.influences[b.index] = Math.min(1, b.influences[b.index] + value * b.weight);
      }
    }
  }
}

export function useAvatarModel(info: AvatarInfo) {
  const gltf = useGLTF(info.file);
  return useMemo(() => {
    const scene = cloneSkinned(gltf.scene);
    const meshes: THREE.Mesh[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshBasicMaterial;
      if (src.map) {
        src.map.magFilter = THREE.NearestFilter;
        src.map.minFilter = THREE.NearestFilter;
      }
      mesh.material = new THREE.MeshLambertMaterial({ map: src.map ?? null, color: src.map ? 0xffffff : src.color });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      meshes.push(mesh);
    });
    return { scene, meshes, expressions: new Expressions(meshes, info) };
  }, [gltf, info]);
}

export function preloadAvatar(info: AvatarInfo) {
  useGLTF.preload(info.file);
}

// ---------------------------------------------------------------------------
// Sprites: cards and chips from the Kenney atlases
// ---------------------------------------------------------------------------

let cardTexture: THREE.Texture | null = null;
let chipTexture: THREE.Texture | null = null;

function pixelTexture(url: string) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function cardsTexture() {
  return (cardTexture ??= pixelTexture(assets.cards.file));
}

export function chipsTexture() {
  return (chipTexture ??= pixelTexture(assets.chips.file));
}

const RANK_COL: Record<string, number> = Object.fromEntries(assets.cards.ranks.map((r, i) => [r, i]));
const cardGeometries = new Map<string, THREE.BufferGeometry>();

/** Flat card face in the XZ plane (facing +Y, top towards -Z) mapped to the atlas. */
export function cardGeometry(code: string, back = false): THREE.BufferGeometry {
  const key = back ? "back" : code;
  const cached = cardGeometries.get(key);
  if (cached) return cached;
  const sheet = assets.cards;
  const hidden = back || code === "XX";
  const col = hidden ? sheet.back.col : RANK_COL[code[0]] ?? 0;
  const row = hidden ? sheet.back.row : sheet.rows[code[1] as keyof typeof sheet.rows] ?? 0;
  const { x, y, w, h } = sheet.rect;
  const u0 = (col * sheet.tile + x) / sheet.width;
  const u1 = (col * sheet.tile + x + w) / sheet.width;
  const v1 = 1 - (row * sheet.tile + y) / sheet.height;
  const v0 = 1 - (row * sheet.tile + y + h) / sheet.height;
  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  geo.rotateX(-Math.PI / 2);
  if (back) geo.rotateZ(Math.PI);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  }
  if (back) {
    // The back is seen from below after the flip; mirror U so it reads correctly.
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + u1 - uv.getX(i));
  }
  uv.needsUpdate = true;
  cardGeometries.set(key, geo);
  return geo;
}

let cardMaterial: THREE.Material | null = null;
export function cardMaterialShared() {
  return (cardMaterial ??= new THREE.MeshLambertMaterial({ map: cardsTexture(), alphaTest: 0.5, side: THREE.FrontSide }));
}

const chipGeometries = new Map<number, THREE.BufferGeometry>();
const chipMaterials = new Map<number, THREE.Material[]>();

/** Chip cylinder whose caps show sprite `index` of the chip atlas. */
export function chipGeometry(index: number) {
  const cached = chipGeometries.get(index);
  if (cached) return cached;
  const geo = new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 18, 1);
  const count = assets.chips.values.length;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const groups = geo.groups;
  for (const g of groups) {
    if (g.materialIndex === 0) continue;
    for (let i = g.start; i < g.start + g.count; i++) {
      const vi = geo.index ? geo.index.getX(i) : i;
      uv.setX(vi, (index + uv.getX(vi)) / count);
    }
  }
  uv.needsUpdate = true;
  chipGeometries.set(index, geo);
  return geo;
}

export function chipMaterialSet(index: number) {
  const cached = chipMaterials.get(index);
  if (cached) return cached;
  const color = assets.chips.values[index]?.color ?? "#ffffff";
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 2;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 4 === 0 ? "#f4f1ea" : color;
    ctx.fillRect(i, 0, 1, 2);
  }
  const side = new THREE.CanvasTexture(canvas);
  side.colorSpace = THREE.SRGBColorSpace;
  side.magFilter = THREE.NearestFilter;
  side.minFilter = THREE.NearestFilter;
  const caps = new THREE.MeshLambertMaterial({ map: chipsTexture(), alphaTest: 0.5 });
  const set = [new THREE.MeshLambertMaterial({ map: side }), caps, caps];
  chipMaterials.set(index, set);
  return set;
}
