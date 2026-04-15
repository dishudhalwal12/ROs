import { useEffect, useRef } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  playNotificationPing,
  primeNotificationSound,
} from '@/lib/notification-sound';

export function NotificationSound() {
  const { member } = useAuth();
  const { notifications } = useWorkspace();
  const latestNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    function unlockSound() {
      void primeNotificationSound();
    }

    window.addEventListener('pointerdown', unlockSound, { passive: true });
    window.addEventListener('keydown', unlockSound);

    return () => {
      window.removeEventListener('pointerdown', unlockSound);
      window.removeEventListener('keydown', unlockSound);
    };
  }, []);

  useEffect(() => {
    const latestNotification = notifications[0];
    if (!latestNotification) return;

    if (latestNotificationIdRef.current === null) {
      latestNotificationIdRef.current = latestNotification.id;
      return;
    }

    if (latestNotification.id === latestNotificationIdRef.current) {
      return;
    }

    latestNotificationIdRef.current = latestNotification.id;

    if (latestNotification.actorId && latestNotification.actorId === member?.uid) {
      return;
    }

    void playNotificationPing();
  }, [member?.uid, notifications]);

  return null;
}
