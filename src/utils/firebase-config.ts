// Firebase Configuration for Vividbooks Classroom Sharing
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove, update, push, serverTimestamp } from 'firebase/database';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBhZjdioVEcLloJ9rKyMz6UcI7nzGkhKoM",
  authDomain: "vividbooks-3.firebaseapp.com",
  databaseURL: "https://vividbooks-3-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "vividbooks-3",
  storageBucket: "vividbooks-3.firebasestorage.app",
  messagingSenderId: "97293018354",
  appId: "1:97293018354:web:9bf048ec96ee9c30559c6b",
  measurementId: "G-F85SR5489S"
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
