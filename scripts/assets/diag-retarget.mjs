// Compares limb directions of a source clip with the baked clip on the avatar rig.
// Usage: node scripts/assets/diag-retarget.mjs <clip> <sourceFile> <sourceArm> <sourceForeArm> <sourceClip> [t]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import * as THREE from "three";
import { applyClip, buildRig, worldDir } from "./rig.mjs";

const [clip, srcFile, srcArm, srcFore, srcClip, tArg] = process.argv.slice(2);
const t = Number(tArg ?? 0);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const fmt = (v) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;

const src = await io.read(srcFile);
const srcRig = buildRig(src);
applyClip(srcRig, src.getRoot().listAnimations().find((a) => a.getName() === srcClip), t);
console.log(`source ${srcClip}@${t}: upper arm ${fmt(worldDir(srcRig, srcArm, srcFore))}`);

const baked = await io.read("public/assets/anims.glb");
const rig = buildRig(baked);
applyClip(rig, baked.getRoot().listAnimations().find((a) => a.getName() === clip), t);
const d = worldDir(rig, "LeftArm_jnt", "LeftForeArm_jnt");
console.log(`baked ${clip}@${t}: upper arm (avatar space, faces -Z) ${fmt(d)} -> turned 180° ${fmt(new THREE.Vector3(-d.x, d.y, -d.z))}`);
const legs = worldDir(rig, "LeftUpLeg_jnt", "LeftLeg_jnt");
console.log(`baked ${clip}@${t}: thigh ${fmt(legs)}`);
