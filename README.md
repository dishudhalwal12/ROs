# Rovexa OS

Rovexa OS is a Vite + React + TypeScript workspace app backed by Firebase Auth, Firestore, Storage, and optional Realtime Database messaging.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the template:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm run dev
```

## Vercel Deployment

This repo is configured for Vercel with:

- `vercel.json` using the Vite build output in `dist`
- SPA rewrites so routes like `/login`, `/settings`, and `/projects` work on refresh
- `.env.example` for required client-side Firebase environment variables

Set these environment variables in Vercel before deploying:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_URL`

If you do not set them, the app now falls back to the bundled public Firebase web config for the current Rovexa project. Set the env vars whenever you want Vercel to point at a different Firebase project.

## Build Commands

```bash
npm run build
npm run typecheck
npm run test:unit
```
