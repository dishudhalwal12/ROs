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

If you want the full Timepass voice/live-sharing experience locally, use:

```bash
npm run dev:timepass
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
- `VITE_LIVEKIT_WS_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

For Vercel or any other HTTPS deployment, `VITE_LIVEKIT_WS_URL` must be a secure `wss://...` address.

If you do not set them, the app now falls back to the bundled public Firebase web config for the current Rovexa project. Set the env vars whenever you want Vercel to point at a different Firebase project.

## Build Commands

```bash
npm run build
npm run typecheck
npm run test:unit
```

## Timepass Live Room

The `/time/timepass` experience uses:

- LiveKit OSS for live voice, presenter sharing, and tab/screen share
- Firebase Realtime Database for shared lounge state
- Firestore + Storage for uploaded Timepass media
- `POST /api/livekit/token` for secure token minting

For local development, the easiest path is:

```bash
npm run dev:timepass
```

That starts Vite and `livekit-server --dev` together, and Vite also serves the local `POST /api/livekit/token` endpoint for Timepass.

For local-only testing with the bundled LiveKit dev server, `VITE_LIVEKIT_WS_URL=ws://127.0.0.1:7880` is still fine.

If you want production-grade token verification locally, also set:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Without those admin credentials, local development falls back to a dev-only token path so you can still test Timepass on your own machine.
