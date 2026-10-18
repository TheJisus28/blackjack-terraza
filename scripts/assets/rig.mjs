// Small skeleton toolkit used by the asset build: builds a three.js Object3D
// hierarchy from a glTF-Transform document and samples its animations.
import * as THREE from "three";

export function buildRig(doc) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const root = new THREE.Object3D();
  const objects = new Map();
  const byName = new Map();
  const visit = (node, parent) => {
    const o = new THREE.Object3D();
    o.name = node.getName();
    o.position.fromArray(node.getTranslation());
    o.quaternion.fromArray(node.getRotation());
    o.scale.fromArray(node.getScale());
    o.userData.rest = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
    parent.add(o);
    objects.set(node, o);
    if (!byName.has(o.name)) byName.set(o.name, o);
    for (const child of node.listChildren()) visit(child, o);
  };
  for (const node of scene.listChildren()) visit(node, root);
  root.updateMatrixWorld(true);
  return {
    root,
    objects,
    byName,
    reset() {
      for (const o of objects.values()) {
        const { p, q, s } = o.userData.rest;
        o.position.copy(p);
        o.quaternion.copy(q);
        o.scale.copy(s);
      }
    },
    update() {
      root.updateMatrixWorld(true);
    },
  };
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

function element(accessor, index) {
  return accessor.getElement(index, new Array(accessor.getElementSize()).fill(0));
}

/** Value of an animation channel at time t (handles LINEAR, STEP and CUBICSPLINE). */
export function sampleChannel(channel, t) {
  const sampler = channel.getSampler();
  const input = sampler.getInput();
  const output = sampler.getOutput();
  const interp = sampler.getInterpolation();
  const path = channel.getTargetPath();
  const count = input.getCount();
  const cubic = interp === "CUBICSPLINE";
  const value = (k) => {
    if (!cubic) return element(output, k);
    return element(output, k * 3 + 1);
  };
  const time = (k) => input.getScalar(k);
  if (count === 1 || t <= time(0)) return value(0);
  if (t >= time(count - 1)) return value(count - 1);
  let i = 0;
  while (i < count - 2 && time(i + 1) <= t) i++;
  const t0 = time(i);
  const t1 = time(i + 1);
  const a = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const v0 = value(i);
  const v1 = value(i + 1);
  if (interp === "STEP") return v0;
  if (path === "rotation") {
    qa.fromArray(v0);
    qb.fromArray(v1);
    qa.slerp(qb, a).normalize();
    return qa.toArray();
  }
  return v0.map((v, k) => v + (v1[k] - v) * a);
}

export function clipDuration(anim) {
  let max = 0;
  for (const s of anim.listSamplers()) {
    const input = s.getInput();
    max = Math.max(max, input.getScalar(input.getCount() - 1));
  }
  return max;
}

/** Poses the rig with the animation at time t (unanimated nodes keep their bind pose). */
export function applyClip(rig, anim, t) {
  rig.reset();
  for (const channel of anim.listChannels()) {
    const node = channel.getTargetNode();
    const o = node && rig.objects.get(node);
    if (!o) continue;
    const v = sampleChannel(channel, t);
    switch (channel.getTargetPath()) {
      case "translation":
        o.position.fromArray(v);
        break;
      case "rotation":
        o.quaternion.fromArray(v).normalize();
        break;
      case "scale":
        o.scale.fromArray(v);
        break;
    }
  }
  rig.update();
}

export function worldDir(rig, from, to) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  rig.byName.get(from).getWorldPosition(a);
  rig.byName.get(to).getWorldPosition(b);
  return b.sub(a).normalize();
}
