import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

let dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
if (!dbUrl || !dbUrl.startsWith("http")) {
  dbUrl = "https://bji-dawati-brothers-default-rtdb.asia-southeast1.firebasedatabase.app";
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA2vbkOUgtwdadwWOa5ymGpS5aUJzGy6XI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "bji-dawati-brothers.firebaseapp.com",
  databaseURL: dbUrl,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bji-dawati-brothers",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bji-dawati-brothers.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "744211691063",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:744211691063:web:bcfcb0c2d30642008df1b2",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-G0FXT1YSMC"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const database = getDatabase(app, dbUrl);

// Initialize Analytics conditionally on the client
let analytics: any = null;
if (typeof window !== "undefined") {
  import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    });
  }).catch(() => {
    // Analytics ignored if unsupported in environment
  });
}

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

if (process.env.NODE_ENV === "development" && useEmulator) {
  const globalAny = global as any;
  if (!globalAny._firebaseEmulatorsConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectDatabaseEmulator(database, "127.0.0.1", 9000);
    globalAny._firebaseEmulatorsConnected = true;
    console.log("Connected to Firebase Emulators");
  }
}

export { app, auth, database, analytics };
