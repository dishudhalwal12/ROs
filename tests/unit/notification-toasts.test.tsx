import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationToasts } from '@/components/shell/NotificationToasts';
import type { AppNotification } from '@/types/models';

const navigateMock = vi.fn();
const markNotificationReadMock = vi.fn();

let authState = {
  member: {
    uid: 'member-1',
  },
};

let workspaceState = {
  notifications: [] as AppNotification[],
  markNotificationRead: markNotificationReadMock,
};

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => workspaceState,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

function buildNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'notification-1',
    userId: 'all',
    title: 'New direct message',
    body: 'Lakshya: tracker updated',
    kind: 'message',
    readBy: [],
    createdAt: '2026-04-16T01:00:00.000Z',
    ...overrides,
  };
}

describe('NotificationToasts', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    markNotificationReadMock.mockReset();
    authState = {
      member: {
        uid: 'member-1',
      },
    };
    workspaceState = {
      notifications: [],
      markNotificationRead: markNotificationReadMock,
    };
  });

  it('shows only new notifications as stacked preview toasts', async () => {
    const existingNotification = buildNotification({
      id: 'existing-notification',
      title: 'Earlier update',
    });

    workspaceState.notifications = [existingNotification];

    const { rerender } = render(<NotificationToasts />);

    expect(screen.queryByText('Earlier update')).not.toBeInTheDocument();

    const nextNotification = buildNotification({
      id: 'next-notification',
      title: 'Fresh client ping',
      body: 'A new client message just landed.',
      createdAt: '2026-04-16T01:01:00.000Z',
    });

    workspaceState.notifications = [nextNotification, existingNotification];
    rerender(<NotificationToasts />);

    await waitFor(() => {
      expect(screen.getByText('Fresh client ping')).toBeInTheDocument();
    });
  });

  it('opens the destination and marks the toast as read when clicked', async () => {
    const initialNotification = buildNotification({
      id: 'seed-notification',
      title: 'Seed',
    });

    workspaceState.notifications = [initialNotification];
    const { rerender } = render(<NotificationToasts />);

    const latestNotification = buildNotification({
      id: 'action-notification',
      title: 'Invoice updated',
      body: 'Tap to open billing',
      kind: 'billing',
      actionRoute: '/billing?invoice=123',
      createdAt: '2026-04-16T01:03:00.000Z',
    });

    workspaceState.notifications = [latestNotification, initialNotification];
    rerender(<NotificationToasts />);

    const toastTitle = await screen.findByText('Invoice updated');
    fireEvent.click(toastTitle.closest('.notification-toast') as HTMLElement);

    expect(markNotificationReadMock).toHaveBeenCalledWith('action-notification');
    expect(navigateMock).toHaveBeenCalledWith('/billing?invoice=123');
  });
});
