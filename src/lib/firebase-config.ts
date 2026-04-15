export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
}

type FirebaseEnv = Partial<{
  VITE_FIREBASE_API_KEY: string;
  VITE_FIREBASE_AUTH_DOMAIN: string;
  VITE_FIREBASE_PROJECT_ID: string;
  VITE_FIREBASE_STORAGE_BUCKET: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  VITE_FIREBASE_APP_ID: string;
  VITE_FIREBASE_DATABASE_URL: string;
}>;

export const DEFAULT_FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyBstjAgc-G65kHMtgY1GnWgvbfgSGshtqc',
  authDomain: 'ghunghat-os.firebaseapp.com',
  projectId: 'ghunghat-os',
  storageBucket: 'ghunghat-os.firebasestorage.app',
  messagingSenderId: '61529153760',
  appId: '1:61529153760:web:78f53731a6b09ad9c3b085',
  databaseURL: 'https://ghunghat-os-default-rtdb.asia-southeast1.firebasedatabase.app',
};

function normalizeEnvValue(value?: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export function resolveFirebaseConfig(env: FirebaseEnv): FirebaseWebConfig {
  return {
    apiKey: normalizeEnvValue(env.VITE_FIREBASE_API_KEY) ?? DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: normalizeEnvValue(env.VITE_FIREBASE_AUTH_DOMAIN) ?? DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: normalizeEnvValue(env.VITE_FIREBASE_PROJECT_ID) ?? DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket:
      normalizeEnvValue(env.VITE_FIREBASE_STORAGE_BUCKET) ?? DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId:
      normalizeEnvValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID) ??
      DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: normalizeEnvValue(env.VITE_FIREBASE_APP_ID) ?? DEFAULT_FIREBASE_CONFIG.appId,
    databaseURL:
      normalizeEnvValue(env.VITE_FIREBASE_DATABASE_URL) ?? DEFAULT_FIREBASE_CONFIG.databaseURL,
  };
}

export function getMissingFirebaseEnvKeys(env: FirebaseEnv) {
  return [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ].filter((key) => !normalizeEnvValue(env[key as keyof FirebaseEnv]));
}
