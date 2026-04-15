import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Clock3,
  CreditCard,
  MessageSquare,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatRelativeTime } from '@/lib/format';
import type { AppNotification } from '@/types/models';

interface ToastItem {
  id: string;
  notification: AppNotification;
}

const TOAST_LIMIT = 4;
const TOAST_LIFETIME_MS = 9000;

function notificationTone(kind: AppNotification['kind']) {
  switch (kind) {
    case 'billing':
      return 'info';
    case 'deadline':
      return 'warning';
    case 'mention':
    case 'message':
      return 'success';
    default:
      return 'neutral';
  }
}

function notificationIcon(kind: AppNotification['kind']): LucideIcon {
  switch (kind) {
    case 'billing':
      return CreditCard;
    case 'deadline':
      return Clock3;
    case 'mention':
    case 'message':
      return MessageSquare;
    case 'invite':
      return Sparkles;
    default:
      return Bell;
  }
}

export function NotificationToasts() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const { notifications, markNotificationRead } = useWorkspace();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const timeoutIdsRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const queueToast = useCallback((notification: AppNotification) => {
    setToasts((current) => {
      const next = [
        { id: notification.id, notification },
        ...current.filter((toast) => toast.id !== notification.id),
      ].slice(0, TOAST_LIMIT);

      return next;
    });

    const existingTimeoutId = timeoutIdsRef.current.get(notification.id);
    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      dismissToast(notification.id);
    }, TOAST_LIFETIME_MS);
    timeoutIdsRef.current.set(notification.id, timeoutId);
  }, [dismissToast]);

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;
    return () => {
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutIds.clear();
    };
  }, []);

  useEffect(() => {
    if (!member?.uid) return;

    if (knownNotificationIdsRef.current.size === 0) {
      knownNotificationIdsRef.current = new Set(notifications.map((notification) => notification.id));
      return;
    }

    const unseenNotifications = notifications.filter((notification) => {
      if (knownNotificationIdsRef.current.has(notification.id)) {
        return false;
      }

      if (notification.actorId && notification.actorId === member.uid) {
        return false;
      }

      if (notification.readBy.includes(member.uid)) {
        return false;
      }

      return true;
    });

    notifications.forEach((notification) => {
      knownNotificationIdsRef.current.add(notification.id);
    });

    unseenNotifications.forEach((notification) => {
      queueToast(notification);
    });
  }, [member?.uid, notifications, queueToast]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="notification-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(({ id, notification }) => {
        const Icon = notificationIcon(notification.kind);
        const unread = !notification.readBy.includes(member?.uid ?? '');

        return (
          <article
            key={id}
            className={`notification-toast notification-toast--${notification.kind}`}
            onClick={() => {
              if (unread) {
                void markNotificationRead(notification.id);
              }
              dismissToast(notification.id);
              navigate(notification.actionRoute ?? '/activity');
            }}
          >
            <div className="notification-toast__icon">
              <Icon size={18} />
            </div>
            <div className="notification-toast__content">
              <div className="notification-toast__meta">
                <Badge tone={notificationTone(notification.kind)}>{notification.kind}</Badge>
                <small>{formatRelativeTime(notification.createdAt)}</small>
              </div>
              <strong>{notification.title}</strong>
              <p>{notification.body}</p>
            </div>
            <button
              type="button"
              className="notification-toast__close"
              aria-label="Dismiss notification preview"
              onClick={(event) => {
                event.stopPropagation();
                dismissToast(notification.id);
              }}
            >
              <X size={16} />
            </button>
          </article>
        );
      })}
    </div>
  );
}
