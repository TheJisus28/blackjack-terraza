// Prints arm/foot directions of a rig in its bind pose and along its T-pose clip.
// Usage: node scripts/assets/diag-pose.mjs <file.glb> <upperArm> <foreArm> <hips> <foot> <toe> [tposeClip]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import * as THREE from "three";
import { applyClip, buildRig, clipDuration, worldDir } from "./rig.mjs";

const [file, upperArm, foreArm, hips, foot, toe, tposeClip] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const rig = buildRig(doc);
const fmt = (v) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
const hipsPos = () => rig.byName.get(hips).getWorldPosition(new THREE.Vector3());
const report = (label) =>
  console.log(`${label}: arm ${fmt(worldDir(rig, upperArm, foreArm))} foot->toe ${fmt(worldDir(rig, foot, toe))} hips ${fmt(hipsPos())}`);

console.log(`roots: ${rig.root.children.map((c) => `${c.name} q=[${c.quaternion.toArray().map((x) => x.toFixed(2))}] s=[${c.scale.toArray().map((x) => x.toFixed(3))}]`).join("; ")}`);
report("bind");
if (tposeClip) {
  const anim = doc.getRoot().listAnimations().find((a) => a.getName() === tposeClip);
  const d = clipDuration(anim);
  for (const t of [0, d / 2, d]) {
    applyClip(rig, anim, t);
    report(`${tposeClip}@${t.toFixed(2)}`);
  }
}
