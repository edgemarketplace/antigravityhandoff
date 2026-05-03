import { App, cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

function parseServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return parsed
  } catch (error) {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON: must be valid JSON")
  }
}

function resolveProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    "edge-marketplace-hub"
  )
}

export function getFirebaseAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const projectId = resolveProjectId()
  const serviceAccount = parseServiceAccountFromEnv()

  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId,
    })
  }

  // Keyless path (recommended): uses ADC from gcloud/app runtime identity.
  return initializeApp({ projectId })
}

export function getFirestoreAdmin() {
  const app = getFirebaseAdminApp()
  return getFirestore(app)
}

export async function firebaseHealthcheck() {
  const db = getFirestoreAdmin()
  const projectId = resolveProjectId()
  const docRef = db.collection("_health").doc("medusa-edge")

  await docRef.set(
    {
      last_seen_at: new Date().toISOString(),
      source: "medusa-backend",
    },
    { merge: true }
  )

  const snap = await docRef.get()

  return {
    ok: true,
    projectId,
    exists: snap.exists,
    path: docRef.path,
  }
}
