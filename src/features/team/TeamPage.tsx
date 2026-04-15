import { useNavigate } from 'react-router-dom';
import { BarChart3, MessageCircleMore, Users } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useWorkspace } from '@/hooks/use-workspace';
import { buildMemberPerformance } from '@/lib/domain';
import { formatMinutesAsHours } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/constants';

export function TeamPage() {
  const navigate = useNavigate();
  const { members, tasks, timeEntries, createDirectChannel } = useWorkspace();
  const performance = buildMemberPerformance(members, tasks, timeEntries);

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="eyebrow">Team</span>
          <h1>Workload, ownership, and performance</h1>
          <p>See who is overloaded, who is free, and where task completion is trending.</p>
        </div>
      </section>

      {members.length === 0 ? (
        <SectionCard title="No team members yet" subtitle="Invite people to build the operating layer">
          <EmptyState
            icon={Users}
            title="Your workspace is still solo"
            description="Invite managers and members from Settings to activate team visibility."
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Team roster" subtitle="Status, role, and workload at a glance">
            <div className="team-grid">
              {performance.map((entry) => (
                <article key={entry.member.id} className="team-card">
                  <div className="team-card__header">
                    <Avatar member={entry.member} />
                    <div>
                      <strong>{entry.member.name}</strong>
                      <p>{entry.member.title}</p>
                    </div>
                    <Badge tone="info">{ROLE_LABELS[entry.member.role]}</Badge>
                  </div>
                  <div className="detail-grid">
                    <div>
                      <span>Active</span>
                      <strong>{entry.active}</strong>
                    </div>
                    <div>
                      <span>Overdue</span>
                      <strong>{entry.overdue}</strong>
                    </div>
                    <div>
                      <span>Completion</span>
                      <strong>{entry.completionRate}%</strong>
                    </div>
                    <div>
                      <span>Logged</span>
                      <strong>{formatMinutesAsHours(entry.weeklyMinutes)}</strong>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: `${entry.completionRate}%` }} />
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      const channelId = await createDirectChannel(entry.member.uid);
                      navigate(`/messages?channel=${channelId}`);
                    }}
                  >
                    <MessageCircleMore size={16} />
                    Message
                  </button>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Performance bars" subtitle="Completion trends derived from tasks and time">
            <div className="list-stack">
              {performance.map((entry) => (
                <article key={entry.member.id} className="metric-row">
                  <div className="metric-row__title">
                    <span>{entry.member.name}</span>
                    <small>{entry.completed} completed tasks</small>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: `${entry.completionRate}%` }} />
                  </div>
                  <div className="metric-row__footer">
                    <small>{entry.active} in progress</small>
                    <small>{formatMinutesAsHours(entry.weeklyMinutes)} this week</small>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Utilization notes" subtitle="What the derived metrics mean">
            <div className="empty-state empty-state--inline">
              <div className="empty-state__icon">
                <BarChart3 size={22} />
              </div>
              <div>
                <h3>Completion is tied to real tasks and logged effort</h3>
                <p>
                  These percentages are generated from current task assignments, completed
                  work, overdue items, and weekly time logged against actual project records.
                </p>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
