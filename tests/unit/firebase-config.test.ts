import {
  DEFAULT_FIREBASE_CONFIG,
  getMissingFirebaseEnvKeys,
  resolveFirebaseConfig,
} from '@/lib/firebase-config';

describe('firebase config resolution', () => {
  it('falls back to the bundled Firebase config when env vars are missing', () => {
    expect(resolveFirebaseConfig({})).toEqual(DEFAULT_FIREBASE_CONFIG);
  });

  it('prefers provided env vars and trims whitespace', () => {
    const resolvedConfig = resolveFirebaseConfig({
      VITE_FIREBASE_API_KEY: ' custom-key ',
      VITE_FIREBASE_AUTH_DOMAIN: ' custom-auth-domain ',
      VITE_FIREBASE_PROJECT_ID: ' custom-project ',
      VITE_FIREBASE_STORAGE_BUCKET: ' custom-bucket ',
      VITE_FIREBASE_MESSAGING_SENDER_ID: ' 123456 ',
      VITE_FIREBASE_APP_ID: ' custom-app ',
      VITE_FIREBASE_DATABASE_URL: ' https://example.firebaseio.com ',
    });

    expect(resolvedConfig).toEqual({
      apiKey: 'custom-key',
      authDomain: 'custom-auth-domain',
      projectId: 'custom-project',
      storageBucket: 'custom-bucket',
      messagingSenderId: '123456',
      appId: 'custom-app',
      databaseURL: 'https://example.firebaseio.com',
    });
  });

  it('reports which required Firebase env vars are missing', () => {
    expect(
      getMissingFirebaseEnvKeys({
        VITE_FIREBASE_API_KEY: 'set',
        VITE_FIREBASE_AUTH_DOMAIN: '',
        VITE_FIREBASE_PROJECT_ID: '   ',
      }),
    ).toEqual([
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
    ]);
  });
});
