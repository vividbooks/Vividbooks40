// Firebase Configuration for Vividbooks Classroom Sharing
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove, update, push, serverTimestamp } from 'firebase/database';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app: ReturnType<typeof initializeApp> | null = null;
let database: ReturnType<typeof getDatabase> | null = null;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  // Remove local mode flag since Firebase is now configured
  localStorage.removeItem('vivid-use-local-mode');
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

// Export database reference helpers
export { database, ref, set, get, onValue, remove, update, push, serverTimestamp };

// Check if Firebase is available
export const isFirebaseAvailable = () => database !== null;
