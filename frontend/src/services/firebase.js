import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut
} from "firebase/auth";

// Firebase web client configuration read from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

/**
 * Checks whether required Firebase configuration variables have been set.
 */
export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
};

let app = null;
let auth = null;
let googleProvider = null;

/**
 * Lazily initializes and returns Firebase Auth and GoogleAuthProvider instances.
 */
export const getFirebaseAuth = () => {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured yet. Please add your Firebase project keys (VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID) to your frontend/.env file."
    );
  }

  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
  }

  return { auth, googleProvider };
};

/**
 * Initiates the Google Sign-In popup with Firebase and retrieves the ID token.
 */
export const signInWithGoogle = async () => {
  const { auth, googleProvider } = getFirebaseAuth();
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
    profile: {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      uid: result.user.uid,
    },
  };
};

/**
 * Signs out of the Firebase Auth session.
 */
export const logOutFromFirebase = async () => {
  try {
    if (auth) {
      await firebaseSignOut(auth);
    }
  } catch (_) {
    // Ignore error if Firebase was not initialized
  }
};
