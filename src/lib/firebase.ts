/**
 * Firebase Realtime Database wiring for HYDRAXX.
 *
 * Connected to the HYDRAXX Firebase Realtime Database:
 *   https://hydrax-f65d9-default-rtdb.asia-southeast1.firebasedatabase.app
 *
 * For bench-testing stage, rules are currently public.
 * No service-account keys or administrator secrets are placed in browser code.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const DEFAULT_DATABASE_URL =
  "https://hydrax-f65d9-default-rtdb.asia-southeast1.firebasedatabase.app";
const DEFAULT_PROJECT_ID = "hydrax-f65d9";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL:
    (import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined) || DEFAULT_DATABASE_URL,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || DEFAULT_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(cfg.databaseURL);

let app: FirebaseApp | null = null;
let db: Database | null = null;

export function getDb(): Database | null {
  if (!firebaseConfigured) return null;
  if (typeof window === "undefined") return null;
  if (!app) {
    app =
      getApps()[0] ??
      initializeApp({
        databaseURL: cfg.databaseURL,
        projectId: cfg.projectId,
        ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
        ...(cfg.authDomain ? { authDomain: cfg.authDomain } : {}),
        ...(cfg.appId ? { appId: cfg.appId } : {}),
      });
    db = getDatabase(app);
  }
  return db;
}
