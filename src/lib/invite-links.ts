export interface InviteLinkParams {
  inviteId: string;
  token: string;
  workspaceId: string;
}

export function buildInviteLink(origin: string, { inviteId, token, workspaceId }: InviteLinkParams) {
  const params = new URLSearchParams({
    invite: token,
    inviteId,
    workspace: workspaceId,
  });

  return `${origin}/login?${params.toString()}`;
}
