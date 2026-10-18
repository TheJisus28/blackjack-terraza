// Downloads every third-party source asset into ./assets-src (git-ignored).
// Usage: node scripts/assets/fetch.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import {
  AVATARS,
  AVATAR_LISTS,
  FURNITURE,
  FURNITURE_BASE,
  KAYKIT_FILES,
  RESTAURANT,
  RESTAURANT_BASE,
  ZIPS,
} from "./catalog.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "assets-src");

async function download(url, file) {
  if (existsSync(file)) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return true;
    }
    console.warn(`  ${res.status} ${url} (attempt ${attempt})`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw new Error(`failed to download ${url}`);
}

function extract(zipFile, dir) {
  const files = unzipSync(new Uint8Array(readFileSync(zipFile)));
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith("/")) continue;
    const target = path.join(dir, name);
    if (!target.startsWith(dir)) throw new Error(`unsafe zip entry ${name}`);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
}

async function main() {
  mkdirSync(SRC, { recursive: true });

  console.log("zip packs");
  for (const [name, url] of Object.entries(ZIPS)) {
    const zip = path.join(SRC, `${name}.zip`);
    const fresh = await download(url, zip);
    const dir = path.join(SRC, name);
    if (fresh || !existsSync(dir)) extract(zip, dir);
    console.log(`  ${name}`);
  }

  console.log("kaykit");
  for (const [file, url] of Object.entries(KAYKIT_FILES)) await download(url, path.join(SRC, file));
  for (const name of FURNITURE) {
    for (const ext of ["gltf", "bin"]) await download(`${FURNITURE_BASE}/${name}.${ext}`, path.join(SRC, "furniture", `${name}.${ext}`));
  }
  await download(`${FURNITURE_BASE}/furniturebits_texture.png`, path.join(SRC, "furniture", "furniturebits_texture.png"));
  for (const name of RESTAURANT) {
    for (const ext of ["gltf", "bin"]) await download(`${RESTAURANT_BASE}/${name}.${ext}`, path.join(SRC, "restaurant", `${name}.${ext}`));
  }
  await download(`${RESTAURANT_BASE}/restaurantbits_texture.png`, path.join(SRC, "restaurant", "restaurantbits_texture.png"));

  console.log("avatars");
  const lists = [];
  for (const url of AVATAR_LISTS) lists.push(...(await (await fetch(url)).json()));
  for (const [id, name] of AVATARS) {
    const entry = lists.find((a) => a.name === name);
    if (!entry) throw new Error(`avatar ${name} not found`);
    await download(entry.metadata.alternateModels.voxel_vrm, path.join(SRC, "avatars", `${id}.vrm`));
    process.stdout.write(".");
  }
  console.log("\ndone");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
