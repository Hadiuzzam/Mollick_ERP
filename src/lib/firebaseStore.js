import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getDatabase, onValue, ref, runTransaction, set } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requested = import.meta.env.VITE_FIREBASE_ENABLED === "true";
const enabled = requested &&
  Object.values(firebaseConfig).every(Boolean);

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function getStoreRef(userId) {
  if (!userId) throw new Error("A signed-in account is required");
  return ref(getDatabase(getFirebaseApp()), `organizations/${userId}/main-store`);
}

export function isFirebaseReady() {
  return enabled;
}

export function getStoreMode() {
  return enabled ? "connecting" : requested ? "setup-error" : "local";
}

export function subscribeAuth(callback, onError) {
  return onAuthStateChanged(getAuth(getFirebaseApp()), callback, onError);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(getAuth(getFirebaseApp()), email, password);
}

export function register(email, password) {
  return createUserWithEmailAndPassword(getAuth(getFirebaseApp()), email, password);
}

export function signOutUser() {
  return signOut(getAuth(getFirebaseApp()));
}

export function resetPassword(email) {
  return sendPasswordResetEmail(getAuth(getFirebaseApp()), email);
}

export function subscribeFirebaseData(userId, callback, onError) {
  return onValue(
    getStoreRef(userId),
    (snapshot) => callback(snapshot.exists() ? snapshot.val() : null),
    onError,
  );
}

export async function mutateFirebaseData(userId, mutator) {
  const result = await runTransaction(
    getStoreRef(userId),
    (current) => mutator(current),
    { applyLocally: false },
  );
  if (!result.committed) {
    const error = new Error("The data changed before this save");
    error.code = "transaction/aborted";
    throw error;
  }
  return result.snapshot.val();
}

export function replaceFirebaseData(userId, data) {
  return set(getStoreRef(userId), data);
}
