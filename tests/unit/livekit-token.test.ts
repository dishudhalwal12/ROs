import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('livekit-server-sdk', () => ({
  AccessToken: class {
    addGrant() {}

    async toJwt() {
      return 'mock-livekit-jwt';
    }
  },
}));

vi.mock('../../api/_lib/firebase-admin', () => ({
  getAdminAuth: vi.fn(),
  getAdminDb: vi.fn(),
  hasFirebaseAdminCredentials: vi.fn(() => false),
}));

function createIdToken(userId: string) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64url');

  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub: userId })}.signature`;
}

function createMockResponse() {
  let statusCode = 200;
  let body: unknown = null;

  return {
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
    },
    setHeader: vi.fn(),
  };
}

describe('LiveKit token handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      VITE_LIVEKIT_WS_URL: 'wss://livekit.example.com',
      LIVEKIT_API_KEY: 'livekit-key',
      LIVEKIT_API_SECRET: 'livekit-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('falls back to Firestore-backed verification when admin credentials are unavailable', async () => {
    const idToken = createIdToken('member-123');
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          fields: {
            uid: { stringValue: 'member-123' },
            name: { stringValue: 'Rovexa Teammate' },
            role: { stringValue: 'manager' },
            status: { stringValue: 'active' },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const { default: handler } = await import('../../api/livekit/token.ts');
    const response = createMockResponse();

    await handler(
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${idToken}`,
          'x-forwarded-proto': 'https',
        },
        body: {
          workspaceId: 'workspace-1',
        },
      },
      response,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/workspaces/workspace-1/members/member-123?'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${idToken}`,
        }),
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        wsUrl: 'wss://livekit.example.com',
        memberRole: 'manager',
        emergencyOverride: true,
      }),
    );
  });
});
