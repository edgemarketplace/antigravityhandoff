import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

let appInstance: App | null = null;

type ServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

function readServiceAccountFromPath(): ServiceAccountShape | null {
  const rawPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!rawPath) return null;

  const absolutePath = resolvePath(rawPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH file not found: ${absolutePath}`);
  }

  const raw = readFileSync(absolutePath, "utf8");
  return JSON.parse(raw) as ServiceAccountShape;
}

function readServiceAccountFromJsonEnv(): ServiceAccountShape | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) return null;
  return JSON.parse(rawJson) as ServiceAccountShape;
}

function getServiceAccount() {
  const envJson = readServiceAccountFromJsonEnv();
  const pathJson = readServiceAccountFromPath();

  const projectId = envJson?.project_id ?? pathJson?.project_id ?? process.env.FIREBASE_PROJECT_ID;
  const clientEmail = envJson?.client_email ?? pathJson?.client_email ?? process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = envJson?.private_key ?? pathJson?.private_key ?? process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId) {
    throw new Error("Missing Firebase project id. Set FIREBASE_PROJECT_ID or include project_id in service account JSON.");
  }

  if (!clientEmail) {
    throw new Error("Missing Firebase client email. Set FIREBASE_CLIENT_EMAIL or include client_email in service account JSON.");
  }

  if (!privateKeyRaw) {
    throw new Error("Missing Firebase private key. Set FIREBASE_PRIVATE_KEY or include private_key in service account JSON.");
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKeyRaw),
  };
}

export function getFirebaseAdminApp(): App {
  if (appInstance) return appInstance;

  if (getApps().length > 0) {
    appInstance = getApps()[0]!;
    return appInstance;
  }

  const serviceAccount = getServiceAccount();

  appInstance = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  return appInstance;
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAdminStorage(): Storage {
  return getStorage(getFirebaseAdminApp());
}
