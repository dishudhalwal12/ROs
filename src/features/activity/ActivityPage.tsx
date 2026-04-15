import { BellRing, History, Inbox } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatRelativeTime } from '@/lib/format';

export function ActivityPage() {
  const { member } = useAuth();
  const { activity, notifications, markNotificationRead } = useWorkspace();

  const personalNotifications = notifications.filter(
    (notification) => notification.userId === 'all' || notification.userId === member?.uid,
  );

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="eyebrow">Activity</span>
          <h1>Team movement and alerts</h1>
          <p>Follow every important change across CRM, delivery, billing, and ops.</p>
        </div>
      </section>

      <div className="two-column-layout">
        <SectionCard title="Notifications" subtitle="Unread and recent signals">
          {personalNotifications.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="Nothing new"
              description="Mentions, alerts, and automated notices will appear here."
            />
          ) : (
            <div className="list-stack">
              {personalNotifications.map((notification) => {
                const unread = !notification.readBy.includes(member?.uid ?? '');
                return (
                  <article key={notification.id} className="list-row">
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                    </div>
                    <div className="list-row__meta">
                      <Badge tone={unread ? 'danger' : 'neutral'}>
                        {unread ? 'Unread' : 'Seen'}
                      </Badge>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void markNotificationRead(notification.id)}
                      >
                        Mark read
                      </button>
                      <small>{formatRelativeTime(notification.createdAt)}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Activity log" subtitle="Linked actions across the workspace">
          {activity.length === 0 ? (
            <EmptyState
              icon={History}
              title="No activity yet"
              description="Create your first client or task to start the activity stream."
            />
          ) : (
            <div className="activity-feed">
              {activity.map((item) => (
                <article key={item.id} className="activity-item">
                  <div className="activity-item__marker" />
                  <div>
                    <div className="activity-item__header">
                      <strong>{item.title}</strong>
                      <Badge tone={item.priority === 'high' ? 'danger' : 'info'}>
                        {item.priority}
                      </Badge>
                    </div>
                    <p>{item.body}</p>
                    <small>{formatRelativeTime(item.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Operational inbox" subtitle="What this stream is for">
        <div className="empty-state empty-state--inline">
          <div className="empty-state__icon">
            <Inbox size={22} />
          </div>
          <div>
            <h3>One feed for the full workflow</h3>
            <p>
              This page is meant to replace scattered pings and manual follow-up by surfacing
              the changes that matter most to the team.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
