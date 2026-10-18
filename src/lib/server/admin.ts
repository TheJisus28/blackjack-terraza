import "server-only";
import { applicationDefault, cert, getApp, getApps, initializeApp, type App, type Credential } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { firebaseConfig } from "@/lib/firebase/config";

const APP_NAME = "blackjack-admin";

/**
 * Credentials, in order of preference:
 *  1. FIREBASE_SERVICE_ACCOUNT_KEY: the service-account JSON (raw or base64).
 *  2. FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY.
 *  3. Emulators (FIREBASE_DATABASE_EMULATOR_HOST): no credential needed.
 *  4. Application Default Credentials (gcloud auth application-default login).
 */
function credential(): Credential | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (raw) {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    return cert(JSON.parse(json));
  }
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return cert({ projectId: firebaseConfig.projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") });
  }
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) return undefined;
  return applicationDefault();
}

export function adminApp(): App {
  if (getApps().some((a) => a.name === APP_NAME)) return getApp(APP_NAME);
  const cred = credential();
  return initializeApp(
    {
      ...(cred ? { credential: cred } : {}),
      projectId: firebaseConfig.projectId,
      databaseURL: firebaseConfig.databaseURL,
    },
    APP_NAME,
  );
}

export const adminDb = () => getDatabase(adminApp());
export const adminAuth = () => getAuth(adminApp());
