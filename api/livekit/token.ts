import { AccessToken } from 'livekit-server-sdk';
import { resolveFirebaseConfig } from '../../src/lib/firebase-config';

import {
  getAdminAuth,
  getAdminDb,
  hasFirebaseAdminCredentials,
} from '../_lib/firebase-admin';

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: {
    workspaceId?: string;
    memberId?: string;
    memberName?: string;
    memberRole?: string;
    memberStatus?: string;
  };
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface FirestoreDocumentValue {
  stringValue?: string;
}

interface FirestoreDocumentResponse {
  name?: string;
  fields?: Record<string, FirestoreDocumentValue>;
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getBearerToken(request: ApiRequest) {
  const authHeader = getHeader(request.headers, 'authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function isLocalDevFallbackEnabled() {
  return process.env.NODE_ENV !== 'production' && !hasFirebaseAdminCredentials();
}

function decodeBase64Url(value: string) {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(
    normalizedValue.length + ((4 - (normalizedValue.length % 4)) % 4),
    '=',
  );

  return Buffer.from(paddedValue, 'base64').toString('utf8');
}

function getUserIdFromIdToken(idToken: string) {
  const segments = idToken.split('.');
  if (segments.length < 2) {
    throw new Error('Invalid Firebase ID token.');
  }

  const payload = JSON.parse(decodeBase64Url(segments[1])) as Record<string, unknown>;
  const userId =
    typeof payload.user_id === 'string'
      ? payload.user_id
      : typeof payload.sub === 'string'
        ? payload.sub
        : null;

  if (!userId) {
    throw new Error('Unable to identify the Firebase user from the provided ID token.');
  }

  return userId;
}

function getStringField(
  fields: FirestoreDocumentResponse['fields'],
  fieldName: string,
) {
  return fields?.[fieldName]?.stringValue?.trim() || null;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
  }

  return fallback;
}

async function readWorkspaceMemberFromFirestore(workspaceId: string, userId: string, idToken: string) {
  const firebaseConfig = resolveFirebaseConfig(process.env);
  const encodedPath = ['workspaces', workspaceId, 'members', userId]
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const searchParams = new URLSearchParams();
  searchParams.append('mask.fieldPaths', 'uid');
  searchParams.append('mask.fieldPaths', 'name');
  searchParams.append('mask.fieldPaths', 'role');
  searchParams.append('mask.fieldPaths', 'status');
  const documentUrl =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/(default)/documents/${encodedPath}` +
    `?${searchParams.toString()}`;

  const response = await fetch(documentUrl, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Unable to verify workspace membership.'));
  }

  const documentPayload = payload as FirestoreDocumentResponse;
  const memberId = getStringField(documentPayload.fields, 'uid') ?? userId;

  return {
    id: memberId,
    name: getStringField(documentPayload.fields, 'name'),
    role: getStringField(documentPayload.fields, 'role'),
    status: getStringField(documentPayload.fields, 'status'),
  };
}

function getLivekitTransportError(request: ApiRequest, wsUrl: string) {
  const forwardedProto = getHeader(request.headers, 'x-forwarded-proto');
  const isSecureDeployment = forwardedProto === 'https' || process.env.VERCEL === '1';

  if (isSecureDeployment && wsUrl.startsWith('ws://')) {
    return 'VITE_LIVEKIT_WS_URL must use wss:// for HTTPS deployments like Vercel.';
  }

  return null;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const wsUrl = process.env.VITE_LIVEKIT_WS_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const workspaceId = request.body?.workspaceId?.trim();
  const idToken = getBearerToken(request);
  const useLocalDevFallback = isLocalDevFallbackEnabled();
  const hasAdminCredentials = hasFirebaseAdminCredentials();

  if (!wsUrl || !apiKey || !apiSecret) {
    response.status(500).json({
      error:
        'LiveKit server configuration is missing. Set VITE_LIVEKIT_WS_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.',
    });
    return;
  }

  const livekitTransportError = getLivekitTransportError(request, wsUrl);
  if (livekitTransportError) {
    response.status(500).json({ error: livekitTransportError });
    return;
  }

  if (!workspaceId) {
    response.status(400).json({ error: 'workspaceId is required.' });
    return;
  }

  if (!idToken && !useLocalDevFallback) {
    response.status(401).json({ error: 'Missing Firebase ID token.' });
    return;
  }

  try {
    let memberId = '';
    let memberName = 'Rovexa teammate';
    let memberRole = 'member';
    let memberStatus = 'active';

    if (useLocalDevFallback) {
      memberId = request.body?.memberId?.trim() ?? '';
      memberName = request.body?.memberName?.trim() || memberName;
      memberRole = request.body?.memberRole?.trim() || memberRole;
      memberStatus = request.body?.memberStatus?.trim() || memberStatus;

      if (!memberId) {
        response.status(400).json({
          error:
            'Local Timepass token fallback needs memberId. Sign into Rovexa before opening Timepass.',
        });
        return;
      }
    } else if (hasAdminCredentials) {
      const decoded = await getAdminAuth().verifyIdToken(idToken!);
      const memberRef = getAdminDb().doc(`workspaces/${workspaceId}/members/${decoded.uid}`);
      const memberSnapshot = await memberRef.get();

      if (!memberSnapshot.exists) {
        response.status(403).json({ error: 'You are not a member of this workspace.' });
        return;
      }

      const member = memberSnapshot.data() as {
        role?: string;
        name?: string;
        status?: string;
      };

      memberId = decoded.uid;
      memberName = member.name ?? decoded.name ?? decoded.email ?? memberName;
      memberRole = member.role ?? memberRole;
      memberStatus = member.status ?? memberStatus;
    } else {
      const firebaseUserId = getUserIdFromIdToken(idToken!);
      const member = await readWorkspaceMemberFromFirestore(workspaceId, firebaseUserId, idToken!);

      if (!member) {
        response.status(403).json({ error: 'You are not a member of this workspace.' });
        return;
      }

      memberId = member.id;
      memberName = member.name ?? request.body?.memberName?.trim() ?? memberName;
      memberRole = member.role ?? memberRole;
      memberStatus = member.status ?? memberStatus;
    }

    if (memberStatus !== 'active') {
      response.status(403).json({ error: 'Only active workspace members can join Timepass.' });
      return;
    }

    const roomName = `workspace:${workspaceId}:timepass`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: memberId,
      name: memberName,
      ttl: '2h',
      metadata: JSON.stringify({
        workspaceId,
        role: memberRole,
      }),
      attributes: {
        workspaceId,
        role: memberRole,
      },
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      roomAdmin: memberRole === 'founder' || memberRole === 'manager',
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    });

    response.status(200).json({
      token: await token.toJwt(),
      roomName,
      wsUrl,
      memberRole,
      emergencyOverride: memberRole === 'founder' || memberRole === 'manager',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create LiveKit token.';
    response.status(500).json({ error: message });
  }
}
