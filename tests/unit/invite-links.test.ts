import { buildInviteLink } from '@/lib/invite-links';

describe('invite links', () => {
  it('includes the invite token and direct document path params', () => {
    expect(
      buildInviteLink('https://rovexa.app', {
        inviteId: 'invite_123',
        token: 'token_456',
        workspaceId: 'workspace_789',
      }),
    ).toBe(
      'https://rovexa.app/login?invite=token_456&inviteId=invite_123&workspace=workspace_789',
    );
  });
});
