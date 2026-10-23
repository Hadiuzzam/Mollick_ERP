import { getApp, getApps, initializeApp } from "firebase/app";
import {
  get,
  getDatabase,
  onValue,
  ref,
  set,
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAXLwJGm-5JkXFU44eGUi28Fm0o1ykWXzA",
  authDomain: "brighthospital-46154.firebaseapp.com",
  databaseURL:
    "https://brighthospital-46154-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "brighthospital-46154",
  storageBucket: "brighthospital-46154.firebasestorage.app",
  messagingSenderId: "71552807441",
  appId: "1:71552807441:web:32057930123e93b9a8b7b0",
  measurementId: "G-TZEJJJ8XXG",
};

// Keep Mollick ERP isolated from any other app/data in this Firebase project.
const databasePath = "mollick_erp/main-store";

let database;

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function getDb() {
  if (!database) {
    database = getDatabase(getFirebaseApp());
  }

  return database;
}

export function isFirebaseReady() {
  return true;
}

export function getStoreMode() {
  return "firebase";
}

export function getStoreRef() {
  return ref(getDb(), databasePath);
}

export async function loadFirebaseData() {
  const snapshot = await get(getStoreRef());
  return snapshot.exists() ? snapshot.val() : null;
}

export async function saveFirebaseData(data) {
  await set(getStoreRef(), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export function subscribeFirebaseData(callback, onError) {
  return onValue(
    getStoreRef(),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    },
    onError,
  );
}