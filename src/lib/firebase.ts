/**
 * Firebase Realtime Database & Authentication wiring for HYDRAX.
 *
 * Connected to the HYDRAX Firebase Project:
 *   Database: https://hydrax-f65d9-default-rtdb.asia-southeast1.firebasedatabase.app
 *   Auth Domain: hydrax-f65d9.firebaseapp.com
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth } from "firebase/auth";

export const firebaseConfig = {
  apiKey:
    (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ||
    "AIzaSyCilQstd46mmaZ_8diLEs8KeMP9WLVHfq0",
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ||
    "hydrax-f65d9.firebaseapp.com",
  databaseURL:
    (import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined) ||
    "https://hydrax-f65d9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:
    (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ||
    "hydrax-f65d9",
  storageBucket:
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ||
    "hydrax-f65d9.firebasestorage.app",
  messagingSenderId:
    (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ||
    "646180198001",
  appId:
    (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ||
    "1:646180198001:web:ca5423de71907484d92dd0",
  measurementId:
    (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined) ||
    "G-EH282RC83T",
};

export const firebaseConfigured = Boolean(firebaseConfig.databaseURL);

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return app;
}

export function getDb(): Database | null {
  if (!firebaseConfigured) return null;
  const a = getFirebaseApp();
  if (!a) return null;
  if (!db) {
    db = getDatabase(a);
  }
  return db;
}

export function getFirebaseAuth(): Auth | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!auth) {
    auth = getAuth(a);
  }
  return auth;
}
