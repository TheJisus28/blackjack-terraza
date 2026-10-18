// Runs `next dev` wired to the local Firebase emulators started with `npm run emulators`.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const env = {
  ...process.env,
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:9000",
};

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
