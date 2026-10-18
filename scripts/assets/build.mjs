// Builds optimized runtime assets into public/assets and a catalog into
// src/lib/generated/assets.json from the sources downloaded by fetch.mjs.
// Usage: node scripts/assets/build.mjs [avatars|anims|sprites|sfx|props ...]
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO, TextureInfo } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, getBounds, meshopt, prune, resample, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { PNG } from "pngjs";
import * as THREE from "three";
import { AVATARS, CLIPS, DEALER_AVATAR, FURNITURE, RESTAURANT } from "./catalog.mjs";
import { applyClip, buildRig, clipDuration } from "./rig.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "assets-src");
const OUT = path.join(ROOT, "public", "assets");
const CATALOG = path.join(ROOT, "src", "lib", "generated", "assets.json");

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const quiet = { warn: () => {}, info: () => {}, debug: () => {}, error: console.error };
const kb = (file) => `${(readFileSync(file).length / 1024).toFixed(0)}KB`;
const mkdir = (dir) => mkdirSync(dir, { recursive: true });

function readGlb(file) {
  const buf = readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const binStart = 20 + jsonLen + 8;
  const image = (img) => {
    const bv = json.bufferViews[img.bufferView];
    const start = binStart + (bv.byteOffset ?? 0);
    return buf.subarray(start, start + bv.byteLength);
  };
  return { json, image };
}

function nearest(doc) {
  for (const material of doc.getRoot().listMaterials()) {
    for (const info of [material.getBaseColorTextureInfo(), material.getEmissiveTextureInfo()]) {
      info?.setMagFilter(TextureInfo.MagFilter.NEAREST).setMinFilter(TextureInfo.MinFilter.NEAREST);
    }
  }
}

function downscale(png, size) {
  const out = new PNG({ width: size, height: size });
  const scale = png.width / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let sy = Math.floor(y * scale); sy < Math.floor((y + 1) * scale); sy++) {
        for (let sx = Math.floor(x * scale); sx < Math.floor((x + 1) * scale); sx++) {
          const i = (sy * png.width + sx) * 4;
          for (let k = 0; k < 4; k++) acc[k] += png.data[i + k];
          n++;
        }
      }
      const o = (y * size + x) * 4;
      for (let k = 0; k < 4; k++) out.data[o + k] = Math.round(acc[k] / n);
    }
  }
  return out;
}

const catalog = existsSync(CATALOG) ? JSON.parse(readFileSync(CATALOG, "utf8")) : {};

// ---------------------------------------------------------------------------
// Avatars: strip the 1MB thumbnail, keep only the expressions we animate,
// drop morph normals, nearest-filter textures and meshopt-compress.
// ---------------------------------------------------------------------------

const EXPRESSIONS = ["blink", "joy", "angry", "sorrow", "fun", "a", "o"];

async function buildAvatars() {
  const dir = path.join(OUT, "avatars");
  mkdir(dir);
  const list = [];
  // Some rigs have typos in bone names ("RighUpLeg_jnt", "LefttArm_jnt"); the VRM
  // humanoid map is reliable, so bones are renamed after the reference avatar.
  const reference = readGlb(path.join(SRC, "avatars", `${AVATARS[0][0]}.vrm`)).json;
  const canonical = Object.fromEntries(
    reference.extensions.VRM.humanoid.humanBones.map((b) => [b.bone, reference.nodes[b.node].name]),
  );
  for (const [id] of AVATARS) {
    const file = path.join(SRC, "avatars", `${id}.vrm`);
    const { json, image } = readGlb(file);
    const vrm = json.extensions?.VRM;
    const title = String(vrm?.meta?.title || id).replace(/^\d+_/, "");

    // Expression -> morph targets, from the VRM 0.x blend shape groups.
    const keep = new Map(); // "mesh:index" -> target name
    const expressions = {};
    for (const group of vrm?.blendShapeMaster?.blendShapeGroups ?? []) {
      const preset = String(group.presetName || "").toLowerCase();
      if (!EXPRESSIONS.includes(preset) || expressions[preset]) continue;
      const binds = (group.binds ?? []).filter((b) => b.weight > 0);
      if (!binds.length) continue;
      expressions[preset] = binds.map((b, k) => {
        const key = `${b.mesh}:${b.index}`;
        if (!keep.has(key)) keep.set(key, binds.length > 1 ? `${preset}_${k}` : preset);
        return { target: keep.get(key), weight: Math.min(1, b.weight / 100) };
      });
    }

    const doc = await io.setLogger(quiet).read(file);
    doc.setLogger(quiet);
    const nodes = doc.getRoot().listNodes();
    let renamed = 0;
    for (const { bone, node } of vrm?.humanoid?.humanBones ?? []) {
      const name = canonical[bone];
      if (name && nodes[node] && nodes[node].getName() !== name) {
        nodes[node].setName(name);
        renamed++;
      }
    }
    if (renamed) console.log(`  ${id}: renamed ${renamed} bones`);
    doc.getRoot().listMeshes().forEach((mesh, meshIndex) => {
      const names = [];
      for (const prim of mesh.listPrimitives()) {
        prim.listTargets().forEach((target, index) => {
          const name = keep.get(`${meshIndex}:${index}`);
          if (!name) {
            prim.removeTarget(target);
            target.dispose();
            return;
          }
          target.setAttribute("NORMAL", null);
          target.setAttribute("TANGENT", null);
          if (!names.includes(name)) names.push(name);
        });
      }
      mesh.setWeights(names.map(() => 0));
      mesh.setExtras({ ...mesh.getExtras(), targetNames: names });
    });
    nearest(doc);

    const rig = buildRig(doc);
    const v = new THREE.Vector3();
    const hips = rig.byName.get("Hips_jnt").position.toArray();
    const head = rig.byName.get("Head_jnt").getWorldPosition(v).toArray();
    const bounds = getBounds(doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]);

    await doc.transform(prune(), dedup(), weld(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
    const out = path.join(dir, `${id}.glb`);
    await io.write(out, doc);

    const thumb = json.images?.find((img) => /thumbnail/i.test(img.name ?? ""));
    if (thumb) {
      writeFileSync(path.join(dir, `${id}.png`), PNG.sync.write(downscale(PNG.sync.read(image(thumb)), 160)));
    }

    list.push({
      id,
      name: title,
      file: `/assets/avatars/${id}.glb`,
      portrait: `/assets/avatars/${id}.png`,
      hips,
      head,
      height: bounds.max[1],
      expressions,
      dealer: id === DEALER_AVATAR,
    });
    console.log(`  ${id}: ${kb(file)} -> ${kb(out)} (${Object.keys(expressions).join(",")})`);
  }
  catalog.avatars = list;
  catalog.dealer = DEALER_AVATAR;
}

// ---------------------------------------------------------------------------
// Animations: forward-kinematics retargeting onto the 100Avatars skeleton.
// All source rigs and the target rest in a T-pose, so each target bone takes
// the source bone's world-space rotation delta from rest. VRM 0.x avatars face
// -Z while the sources face +Z, hence the 180° conjugation (x, z negated).
// ---------------------------------------------------------------------------

const FINGERS = [
  ["Thumb", ["1", "2"]],
  ["Index", ["1", "2", "3"]],
  ["Middle", ["1", "2", "3"]],
  ["Ring", ["1", "2", "3"]],
  ["Pinky", ["1", "2", "3"]],
];

function fingerMap(source) {
  const out = {};
  for (const side of ["Left", "Right"]) {
    for (const [finger, joints] of FINGERS) {
      for (const j of joints) {
        const name = source(side, finger, Number(j));
        if (name) out[`${side}Hand_${finger}${j}_jnt`] = name;
      }
    }
  }
  return out;
}

const sideSuffix = (side, style) => (style === "dot" ? (side === "Left" ? ".L" : ".R") : side === "Left" ? "_l" : "_r");

function bodyMap(names) {
  const out = {};
  for (const side of ["Left", "Right"]) {
    for (const [target, source] of Object.entries(names(side))) out[target] = source;
  }
  return out;
}

const MAP_UAL1 = {
  Hips_jnt: "DEF-hips",
  Spine_jnt: "DEF-spine.001",
  Chest_jnt: "DEF-spine.002",
  UpperChest_jnt: "DEF-spine.003",
  Neck_jnt: "DEF-neck",
  Head_jnt: "DEF-head",
  ...bodyMap((side) => {
    const s = sideSuffix(side, "dot");
    return {
      [`${side}Shoulder_jnt`]: `DEF-shoulder${s}`,
      [`${side}Arm_jnt`]: `DEF-upper_arm${s}`,
      [`${side}ForeArm_jnt`]: `DEF-forearm${s}`,
      [`${side}Hand_jnt`]: `DEF-hand${s}`,
      [`${side}UpLeg_jnt`]: `DEF-thigh${s}`,
      [`${side}Leg_jnt`]: `DEF-shin${s}`,
      [`${side}Foot_jnt`]: `DEF-foot${s}`,
      [`${side}Toes_jnt`]: `DEF-toe${s}`,
    };
  }),
  ...fingerMap((side, finger, j) => {
    const s = sideSuffix(side, "dot");
    if (finger === "Thumb") return `DEF-thumb.0${j}${s}`;
    return `DEF-f_${finger.toLowerCase()}.0${j}${s}`;
  }),
};

const MAP_UE = {
  Hips_jnt: "pelvis",
  Spine_jnt: "spine_01",
  Chest_jnt: "spine_02",
  UpperChest_jnt: "spine_03",
  Neck_jnt: "neck_01",
  Head_jnt: "Head",
  ...bodyMap((side) => {
    const s = sideSuffix(side, "ue");
    return {
      [`${side}Shoulder_jnt`]: `clavicle${s}`,
      [`${side}Arm_jnt`]: `upperarm${s}`,
      [`${side}ForeArm_jnt`]: `lowerarm${s}`,
      [`${side}Hand_jnt`]: `hand${s}`,
      [`${side}UpLeg_jnt`]: `thigh${s}`,
      [`${side}Leg_jnt`]: `calf${s}`,
      [`${side}Foot_jnt`]: `foot${s}`,
      [`${side}Toes_jnt`]: `ball${s}`,
    };
  }),
  ...fingerMap((side, finger, j) => `${finger.toLowerCase()}_0${j}${sideSuffix(side, "ue")}`),
};

const MAP_KAYKIT = {
  Hips_jnt: "hips",
  Spine_jnt: "spine",
  Chest_jnt: "chest",
  Head_jnt: "head",
  ...bodyMap((side) => {
    const s = side === "Left" ? ".l" : ".r";
    return {
      [`${side}Arm_jnt`]: `upperarm${s}`,
      [`${side}ForeArm_jnt`]: `lowerarm${s}`,
      [`${side}Hand_jnt`]: `hand${s}`,
      [`${side}UpLeg_jnt`]: `upperleg${s}`,
      [`${side}Leg_jnt`]: `lowerleg${s}`,
      [`${side}Foot_jnt`]: `foot${s}`,
      [`${side}Toes_jnt`]: `toes${s}`,
    };
  }),
};

const SOURCES = {
  ual1: { file: "ual1/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb", map: MAP_UAL1 },
  ual2: { file: "ual2/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb", map: MAP_UE },
  kaykit: { file: "kaykit/Knight.glb", map: MAP_KAYKIT },
};

const FPS = 30;
const conjY = (q) => q.set(-q.x, q.y, -q.z, q.w);

async function loadSource(key) {
  const def = SOURCES[key];
  const doc = await io.setLogger(quiet).read(path.join(SRC, def.file));
  const rig = buildRig(doc);
  const restInv = new Map();
  for (const name of Object.values(def.map)) {
    const o = rig.byName.get(name);
    if (!o) throw new Error(`${key}: missing bone ${name}`);
    restInv.set(name, o.getWorldQuaternion(new THREE.Quaternion()).invert());
  }
  const hipsRest = rig.byName.get(def.map.Hips_jnt).getWorldPosition(new THREE.Vector3());
  return { ...def, doc, rig, restInv, hipsRest };
}

async function buildAnims() {
  const refDoc = await io.setLogger(quiet).read(path.join(SRC, "avatars", `${AVATARS[0][0]}.vrm`));
  const ref = buildRig(refDoc);
  const hipsObj = ref.byName.get("Hips_jnt");
  const order = [];
  const parentOf = new Map();
  hipsObj.traverse((o) => {
    if (!o.name.endsWith("_jnt")) return;
    order.push(o.name);
    parentOf.set(o.name, o.parent?.name?.endsWith("_jnt") ? o.parent.name : null);
  });
  const targetHips = hipsObj.position.clone();

  const out = new Document();
  out.setLogger(quiet);
  const buffer = out.createBuffer();
  const scene = out.createScene("Anims");
  out.getRoot().setDefaultScene(scene);
  const nodes = new Map();
  for (const name of order) {
    const node = out.createNode(name).setTranslation(ref.byName.get(name).position.toArray());
    nodes.set(name, node);
    const parent = parentOf.get(name);
    if (parent) nodes.get(parent).addChild(node);
    else scene.addChild(node);
  }

  const sources = {};
  const durations = {};
  const qw = new THREE.Quaternion();
  const v = new THREE.Vector3();
  for (const [name, key, clipName] of CLIPS) {
    const src = (sources[key] ??= await loadSource(key));
    const anim = src.doc.getRoot().listAnimations().find((a) => a.getName() === clipName);
    if (!anim) throw new Error(`${key}: clip ${clipName} not found`);
    const duration = clipDuration(anim);
    const frames = Math.max(2, Math.round(duration * FPS) + 1);
    const times = new Float32Array(frames);
    const rotations = new Map(order.map((b) => [b, new Float32Array(frames * 4)]));
    const hipsTrack = new Float32Array(frames * 3);
    const scale = targetHips.y / src.hipsRest.y;

    for (let f = 0; f < frames; f++) {
      const t = f === frames - 1 ? duration : Math.min(duration, f / FPS);
      times[f] = t;
      applyClip(src.rig, anim, t);
      const delta = new Map();
      for (const bone of order) {
        const sourceName = src.map[bone];
        let d;
        if (sourceName) {
          src.rig.byName.get(sourceName).getWorldQuaternion(qw);
          d = qw.clone().multiply(src.restInv.get(sourceName));
        } else {
          const parent = parentOf.get(bone);
          d = parent ? delta.get(parent).clone() : new THREE.Quaternion();
        }
        delta.set(bone, d);
      }
      for (const bone of order) {
        const parent = parentOf.get(bone);
        const local = parent ? delta.get(parent).clone().invert().multiply(delta.get(bone)) : delta.get(bone).clone();
        conjY(local);
        const arr = rotations.get(bone);
        if (f > 0) {
          const dot = arr[(f - 1) * 4] * local.x + arr[(f - 1) * 4 + 1] * local.y + arr[(f - 1) * 4 + 2] * local.z + arr[(f - 1) * 4 + 3] * local.w;
          if (dot < 0) local.set(-local.x, -local.y, -local.z, -local.w);
        }
        local.toArray(arr, f * 4);
      }
      src.rig.byName.get(src.map.Hips_jnt).getWorldPosition(v).sub(src.hipsRest).multiplyScalar(scale);
      hipsTrack.set([targetHips.x - v.x, targetHips.y + v.y, targetHips.z - v.z], f * 3);
    }

    const animation = out.createAnimation(name);
    const input = out.createAccessor().setType("SCALAR").setArray(times).setBuffer(buffer);
    for (const bone of order) {
      const output = out.createAccessor().setType("VEC4").setArray(rotations.get(bone)).setBuffer(buffer);
      const sampler = out.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR");
      const channel = out.createAnimationChannel().setTargetNode(nodes.get(bone)).setTargetPath("rotation").setSampler(sampler);
      animation.addSampler(sampler).addChannel(channel);
    }
    const hipsOut = out.createAccessor().setType("VEC3").setArray(hipsTrack).setBuffer(buffer);
    const hipsSampler = out.createAnimationSampler().setInput(input).setOutput(hipsOut).setInterpolation("LINEAR");
    animation
      .addSampler(hipsSampler)
      .addChannel(out.createAnimationChannel().setTargetNode(nodes.get("Hips_jnt")).setTargetPath("translation").setSampler(hipsSampler));
    durations[name] = Number(duration.toFixed(3));
    console.log(`  ${name} <- ${key}:${clipName} (${duration.toFixed(2)}s)`);
  }

  await out.transform(resample({ tolerance: 2e-4 }), dedup(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const file = path.join(OUT, "anims.glb");
  mkdir(OUT);
  await io.write(file, out);
  console.log(`  anims.glb ${kb(file)}`);
  catalog.clips = durations;
  catalog.skeletonHips = targetHips.toArray();
}

// ---------------------------------------------------------------------------
// Sprites: Kenney pixel-art cards and boardgame chips (recoloured for the
// higher denominations).
// ---------------------------------------------------------------------------

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map(Math.round);
}

/** Copies a chip sprite into the atlas, optionally shifting its saturated colours to `hue`. */
function blitChip(atlas, chip, slot, recolor) {
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      let [r, g, b] = [chip.data[i], chip.data[i + 1], chip.data[i + 2]];
      if (recolor) {
        const [, s, v] = rgbToHsv(r, g, b);
        if (s > 0.25) [r, g, b] = hsvToRgb(recolor.hue, Math.min(1, s * (recolor.sat ?? 1)), Math.min(1, v * (recolor.val ?? 1)));
      }
      const o = (y * atlas.width + slot * 64 + x) * 4;
      atlas.data[o] = r;
      atlas.data[o + 1] = g;
      atlas.data[o + 2] = b;
      atlas.data[o + 3] = chip.data[i + 3];
    }
  }
}

function buildSprites() {
  mkdir(OUT);
  const cardsSrc = path.join(SRC, "kenney-cards", "Tilesheet", "cardsLarge_tilemap_packed.png");
  copyFileSync(cardsSrc, path.join(OUT, "cards.png"));
  catalog.cards = {
    file: "/assets/cards.png",
    width: 896,
    height: 256,
    tile: 64,
    // Card rectangle inside each 64px tile (inclusive pixel bounds).
    rect: { x: 11, y: 2, w: 42, h: 60 },
    // Rows by suit, columns A..K; column 13 holds the specials.
    rows: { H: 0, D: 1, C: 2, S: 3 },
    ranks: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"],
    back: { col: 13, row: 1 },
  };

  const chipDir = path.join(SRC, "kenney-boardgame", "PNG", "Chips");
  const read = (f) => PNG.sync.read(readFileSync(path.join(chipDir, f)));
  const chips = [
    { value: 1, file: "chipWhiteBlue.png", color: "#f1f5f9" },
    { value: 5, file: "chipRedWhite.png", color: "#dc2626" },
    { value: 25, file: "chipGreenWhite.png", color: "#16a34a" },
    { value: 100, file: "chipBlackWhite.png", color: "#18181b" },
    { value: 500, file: "chipBlueWhite.png", color: "#7c3aed", recolor: { hue: 268, sat: 1 } },
    { value: 1000, file: "chipGreenWhite.png", color: "#eab308", recolor: { hue: 46, sat: 1.05, val: 1.1 } },
    { value: 5000, file: "chipRedWhite.png", color: "#ea580c", recolor: { hue: 24, sat: 1, val: 1.1 } },
    { value: 25000, file: "chipBlueWhite.png", color: "#db2777", recolor: { hue: 328, sat: 1 } },
    { value: 100000, file: "chipBlueWhite.png", color: "#0891b2", recolor: { hue: 188, sat: 1 } },
  ];
  const atlas = new PNG({ width: 64 * chips.length, height: 64 });
  chips.forEach((chip, slot) => blitChip(atlas, read(chip.file), slot, chip.recolor));
  writeFileSync(path.join(OUT, "chips.png"), PNG.sync.write(atlas));
  catalog.chips = {
    file: "/assets/chips.png",
    size: 64,
    values: chips.map(({ value, color }) => ({ value, color })),
  };
  console.log("  cards.png, chips.png");
}

function buildSfx() {
  const from = path.join(SRC, "kenney-casino-audio");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/^(card|chip)/.test(entry.name) && entry.name.endsWith(".ogg")) files.push(full);
    }
  };
  walk(from);
  const dir = path.join(OUT, "sfx");
  mkdir(dir);
  const groups = {};
  for (const file of files) {
    const name = path.basename(file);
    copyFileSync(file, path.join(dir, name));
    const group = name.replace(/-\d+\.ogg$/, "").replace(/\.ogg$/, "");
    (groups[group] ??= []).push(`/assets/sfx/${name}`);
  }
  for (const list of Object.values(groups)) list.sort();
  catalog.sfx = groups;
  console.log(`  ${files.length} sounds in ${Object.keys(groups).length} groups`);
}

async function buildProps() {
  const dir = path.join(OUT, "props");
  mkdir(dir);
  const props = {};
  const entries = [
    ...FURNITURE.map((n) => ["furniture", n]),
    ...RESTAURANT.map((n) => ["restaurant", n]),
  ];
  for (const [pack, name] of entries) {
    const doc = await io.setLogger(quiet).read(path.join(SRC, pack, `${name}.gltf`));
    nearest(doc);
    await doc.transform(prune(), dedup());
    const bounds = getBounds(doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]);
    const file = path.join(dir, `${name}.glb`);
    await io.write(file, doc);
    props[name] = {
      file: `/assets/props/${name}.glb`,
      min: bounds.min.map((x) => Number(x.toFixed(3))),
      max: bounds.max.map((x) => Number(x.toFixed(3))),
    };
  }
  catalog.props = props;
  console.log(`  ${entries.length} props`);
}

const steps = { avatars: buildAvatars, anims: buildAnims, sprites: buildSprites, sfx: buildSfx, props: buildProps };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(steps);
for (const step of wanted) {
  console.log(step);
  await steps[step]();
}
mkdir(path.dirname(CATALOG));
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n");
console.log(`catalog -> ${path.relative(ROOT, CATALOG)}`);
