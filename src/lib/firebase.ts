import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

import {
  getMissingFirebaseEnvKeys,
  resolveFirebaseConfig,
} from '@/lib/firebase-config';

const missingFirebaseEnvKeys = getMissingFirebaseEnvKeys(import.meta.env);

if (import.meta.env.DEV && missingFirebaseEnvKeys.length > 0) {
  console.info(
    `[firebase] Missing ${missingFirebaseEnvKeys.join(', ')}. Using bundled Rovexa Firebase defaults for local development.`,
  );
}

export const firebaseConfig = resolveFirebaseConfig(import.meta.env);

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
export const storage = getStorage(app);
export const realtimeDb = firebaseConfig.databaseURL ? getDatabase(app) : null;
export const isRealtimeConfigured = Boolean(firebaseConfig.databaseURL);

export function getDefaultRealtimeUrl() {
  return `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;
}
