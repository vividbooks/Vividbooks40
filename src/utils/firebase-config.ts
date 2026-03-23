// Firebase Configuration for Vividbooks Classroom Sharing
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove, update, push, serverTimestamp } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

function hasRealtimeDatabaseConfig(): boolean {
  const { apiKey, projectId, databaseURL } = firebaseConfig;
  if (!apiKey?.trim() || !projectId?.trim() || !databaseURL?.trim()) return false;
  const url = databaseURL.trim();
  return url.startsWith('https://') && (url.includes('firebasedatabase') || url.includes('firebaseio.com'));
}

let app: FirebaseApp | null = null;
let database: ReturnType<typeof getDatabase> | null = null;

if (hasRealtimeDatabaseConfig()) {
  try {
    app = initializeApp(firebaseConfig as Record<string, string>);
    database = getDatabase(app);
    try {
      localStorage.removeItem('vivid-use-local-mode');
    } catch {
      /* ignore */
    }
    console.log('✅ Firebase initialized (Realtime Database)');
  } catch (error) {
    app = null;
    database = null;
    console.warn('⚠️ Firebase init failed — classroom sdílení poběží přes localStorage:', error);
  }
} else {
  // GitHub Pages / build bez .env — initializeApp+getDatabase by házelo FATAL ERROR
  if (import.meta.env.DEV) {
    console.info(
      '[Firebase] Realtime Database vypnutá — doplň VITE_FIREBASE_* v .env (viz .env.example).',
    );
  }
}

export { database, ref, set, get, onValue, remove, update, push, serverTimestamp };

export const isFirebaseAvailable = (): boolean => database !== null;
