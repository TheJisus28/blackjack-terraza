import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { EMULATOR_HOSTS, firebaseConfig, useEmulators } from "./config";

const globalForFirebase = globalThis as unknown as { __bjEmulatorsConnected?: boolean };

export function firebase() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  if (useEmulators && !globalForFirebase.__bjEmulatorsConnected) {
    globalForFirebase.__bjEmulatorsConnected = true;
    connectAuthEmulator(auth, `http://${EMULATOR_HOSTS.auth}`, { disableWarnings: true });
    const [host, port] = EMULATOR_HOSTS.database.split(":");
    connectDatabaseEmulator(db, host, Number(port));
  }
  return { app, auth, db };
}
