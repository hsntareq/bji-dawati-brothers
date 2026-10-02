import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

let dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
if (!dbUrl || !dbUrl.startsWith("http")) {
  dbUrl = "https://demo-project-default-rtdb.firebaseio.com";
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: dbUrl,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "demo-app-id"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const database = getDatabase(app, dbUrl);

if (process.env.NODE_ENV === 'development') {
  const globalAny = global as any;
  if (!globalAny._firebaseEmulatorsConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectDatabaseEmulator(database, "127.0.0.1", 9000);
    globalAny._firebaseEmulatorsConnected = true;
    console.log("Connected to Firebase Emulators");
  }
}

export { app, auth, database };
