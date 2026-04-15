import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ProfileEditorModal } from '@/components/shell/ProfileEditorModal';

const authState = {
  member: {
    uid: 'user_1',
    name: 'Dishu Founder',
    avatarColor: '#2f4bde',
    avatarUrl: 'https://example.com/original.png',
  },
};

const workspaceState = {
  updateMyProfile: vi.fn(),
  uploadProfileAvatar: vi.fn(),
};

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => workspaceState,
}));

describe('ProfileEditorModal', () => {
  beforeEach(() => {
    workspaceState.updateMyProfile.mockReset();
    workspaceState.uploadProfileAvatar.mockReset();
  });

  it('shows a validation error when the display name is empty', async () => {
    const user = userEvent.setup();
    workspaceState.updateMyProfile.mockRejectedValueOnce(new Error('Name is required.'));
    render(<ProfileEditorModal open onClose={() => undefined} />);

    const nameInput = screen.getByLabelText('Display name');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(workspaceState.updateMyProfile).toHaveBeenCalledWith({ name: '' });
  });

  it('saves the trimmed display name and closes the modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    workspaceState.updateMyProfile.mockResolvedValue(undefined);

    render(<ProfileEditorModal open onClose={onClose} />);

    const nameInput = screen.getByLabelText('Display name');
    await user.clear(nameInput);
    await user.type(nameInput, '  Dishu Ops  ');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(workspaceState.updateMyProfile).toHaveBeenCalledWith({
        name: '  Dishu Ops  ',
      });
    });
    expect(onClose).toHaveBeenCalled();
  });
});
