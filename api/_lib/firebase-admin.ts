import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function readEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

export function hasFirebaseAdminCredentials() {
  return Boolean(
    readEnv('FIREBASE_ADMIN_PROJECT_ID') &&
      readEnv('FIREBASE_ADMIN_CLIENT_EMAIL') &&
      readEnv('FIREBASE_ADMIN_PRIVATE_KEY'),
  );
}

function getCredentialConfig() {
  const projectId = readEnv('FIREBASE_ADMIN_PROJECT_ID');
  const clientEmail = readEnv('FIREBASE_ADMIN_CLIENT_EMAIL');
  const privateKey = readEnv('FIREBASE_ADMIN_PRIVATE_KEY')?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.',
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

let cachedAdminApp: App | null = null;

function createAdminApp(): App {
  const { projectId, clientEmail, privateKey } = getCredentialConfig();

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminApp() {
  if (cachedAdminApp) {
    return cachedAdminApp;
  }

  cachedAdminApp = getApps()[0] ?? createAdminApp();
  return cachedAdminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
