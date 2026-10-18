// Firebase web configuration is public by design; access is enforced by the
// database rules and by the server. Env vars allow pointing at another project.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyCLw4wm_bYM4VpU3Reyhpsj8S59x3z9A5A",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "blackjack-terraza.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "https://blackjack-terraza-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "blackjack-terraza",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "blackjack-terraza.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "1094515099590",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:1094515099590:web:7a9d15f93cf1e130d354c7",
};

export const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

export const EMULATOR_HOSTS = {
  auth: "127.0.0.1:9099",
  database: "127.0.0.1:9000",
};
