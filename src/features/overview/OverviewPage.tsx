import {
  BriefcaseBusiness,
  Clock3,
  FolderKanban,
  Siren,
  SquareCheckBig,
  TrendingUp,
} from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import {
  buildMemberPerformance,
  calculateMonthlyRevenue,
  calculateMyOpenTasks,
  calculateOverdueCount,
  calculateWeeklyHours,
  getEffectiveInvoiceStatus,
} from '@/lib/domain';
import { formatCurrency, formatMinutesAsHours, formatRelativeTime, formatShortDate } from '@/lib/format';
import { DEAL_STAGE_LABELS, INVOICE_STATUS_LABELS, TASK_STATUS_LABELS } from '@/lib/constants';

export function OverviewPage() {
  const { member } = useAuth();
  const {
    activity,
    channels,
    clients,
    invoices,
    notifications,
    projects,
    tasks,
    timeEntries,
    members,
  } = useWorkspace();

  if (!member) return null;

  const myTasks = tasks.filter((task) => task.assigneeIds.includes(member.uid));
  const dueSoonTasks = myTasks
    .filter((task) => task.status !== 'done')
    .sort((left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? ''))
    .slice(0, 5);
  const highPriorityNotifications = notifications.slice(0, 6);
  const activeClients = clients.filter((client) => client.stage !== 'lost').length;
  const performance = buildMemberPerformance(members, tasks, timeEntries).slice(0, 4);
  const kanbanPreview = ['todo', 'in_progress', 'review', 'done'].map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status).slice(0, 3),
  }));
  const generalChannel = channels.find((channel) => channel.id === 'general') ?? channels[0];

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">Daily command center</span>
          <h1>Stay up to date, {member.name.split(' ')[0]}.</h1>
          <p>
            Track delivery, team movement, billing health, and client momentum without
            leaving the workspace.
          </p>
        </div>
        <div className="hero-panel__summary">
          <div>
            <strong>{projects.filter((project) => project.status !== 'completed').length}</strong>
            <span>Active projects</span>
          </div>
          <div>
            <strong>{channels.length}</strong>
            <span>Live channels</span>
          </div>
          <div>
            <strong>{members.length}</strong>
            <span>Connected teammates</span>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          title="Open tasks"
          value={String(calculateMyOpenTasks(tasks, member.uid))}
          change="Assigned and still moving"
          icon={SquareCheckBig}
          tone="violet"
        />
        <StatCard
          title="Active clients"
          value={String(activeClients)}
          change="Across pipeline and delivery"
          icon={BriefcaseBusiness}
          tone="mint"
        />
        <StatCard
          title="Monthly revenue"
          value={formatCurrency(calculateMonthlyRevenue(invoices))}
          change="Drafts excluded"
          icon={TrendingUp}
          tone="peach"
        />
        <StatCard
          title="Hours this week"
          value={formatMinutesAsHours(calculateWeeklyHours(timeEntries, member.uid))}
          change="Tracked against tasks"
          icon={Clock3}
          tone="blue"
        />
        <StatCard
          title="Overdue items"
          value={String(calculateOverdueCount(tasks, invoices))}
          change="Tasks plus invoices"
          icon={Siren}
          tone="gold"
        />
      </section>

      <div className="two-column-layout">
        <SectionCard title="Today’s queue" subtitle="What needs motion next">
          {dueSoonTasks.length === 0 ? (
            <EmptyState
              icon={SquareCheckBig}
              title="All clear"
              description="New tasks assigned to you will appear here."
            />
          ) : (
            <div className="list-stack">
              {dueSoonTasks.map((task) => (
                <article key={task.id} className="list-row">
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.description}</p>
                  </div>
                  <div className="list-row__meta">
                    <Badge tone={task.priority === 'urgent' ? 'danger' : 'info'}>
                      {task.priority}
                    </Badge>
                    <span>{task.dueDate ? formatShortDate(task.dueDate) : 'No due date'}</span>
                    <small>{TASK_STATUS_LABELS[task.status]}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Notifications & pings" subtitle="The latest operational signal">
          <div className="list-stack">
            {highPriorityNotifications.map((notification) => (
              <article key={notification.id} className="list-row">
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                </div>
                <div className="list-row__meta">
                  <Badge
                    tone={
                      notification.kind === 'billing'
                        ? 'warning'
                        : notification.kind === 'deadline'
                          ? 'danger'
                          : 'info'
                    }
                  >
                    {notification.kind}
                  </Badge>
                  <small>{formatRelativeTime(notification.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="dashboard-grid">
        <SectionCard title="CRM pipeline" subtitle="Leads to retained accounts">
          <div className="mini-grid">
            {clients.slice(0, 4).map((client) => (
              <article key={client.id} className="pipeline-card">
                <div className="pipeline-card__top">
                  <div>
                    <strong>{client.company}</strong>
                    <p>{client.contactName}</p>
                  </div>
                  <Badge tone={client.stage === 'won' ? 'success' : 'neutral'}>
                    {DEAL_STAGE_LABELS[client.stage]}
                  </Badge>
                </div>
                <div className="pipeline-card__bottom">
                  <span>{formatCurrency(client.value)}</span>
                  <small>
                    {client.nextFollowUpAt
                      ? `Follow up ${formatShortDate(client.nextFollowUpAt)}`
                      : 'No follow-up set'}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Time tracker" subtitle="This week by team member">
          <div className="list-stack">
            {performance.map((item) => (
              <article key={item.member.id} className="list-row">
                <div className="member-inline">
                  <Avatar member={item.member} />
                  <div>
                    <strong>{item.member.name}</strong>
                    <p>{item.member.title}</p>
                  </div>
                </div>
                <div className="list-row__meta">
                  <span>{formatMinutesAsHours(item.weeklyMinutes)}</span>
                  <small>{item.active} active tasks</small>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Revenue & billing" subtitle="Invoices in motion">
          <div className="list-stack">
            {invoices.slice(0, 5).map((invoice) => {
              const client = clients.find((entry) => entry.id === invoice.clientId);
              const status = getEffectiveInvoiceStatus(invoice);
              return (
                <article key={invoice.id} className="list-row">
                  <div>
                    <strong>{invoice.title}</strong>
                    <p>{client?.company ?? 'Unknown client'}</p>
                  </div>
                  <div className="list-row__meta">
                    <Badge tone={status === 'paid' ? 'success' : status === 'overdue' ? 'danger' : 'warning'}>
                      {INVOICE_STATUS_LABELS[status]}
                    </Badge>
                    <span>{formatCurrency(invoice.amount)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Team performance" subtitle="Completion and load">
          <div className="list-stack">
            {performance.map((item) => (
              <article key={item.member.id} className="metric-row">
                <div className="metric-row__title">
                  <span>{item.member.name}</span>
                  <small>{item.completed} complete</small>
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${item.completionRate}%` }} />
                </div>
                <div className="metric-row__footer">
                  <small>{item.active} in flight</small>
                  <small>{item.completionRate}% done</small>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="two-column-layout">
        <SectionCard title="Project board preview" subtitle="Work across all statuses">
          <div className="kanban-preview">
            {kanbanPreview.map((column) => (
              <div key={column.status} className="kanban-preview__column">
                <header>
                  <strong>{TASK_STATUS_LABELS[column.status as keyof typeof TASK_STATUS_LABELS]}</strong>
                  <span>{column.tasks.length}</span>
                </header>
                {column.tasks.map((task) => (
                  <article key={task.id} className="kanban-preview__card">
                    <Badge tone={task.priority === 'urgent' ? 'danger' : 'info'}>
                      {task.vertical}
                    </Badge>
                    <strong>{task.title}</strong>
                    <p>{task.description}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Team messages" subtitle="Channel pulse">
          {generalChannel ? (
            <article className="channel-preview">
              <div className="channel-preview__header">
                <div>
                  <strong>{generalChannel.name}</strong>
                  <p>{generalChannel.type} channel</p>
                </div>
                <Badge tone="success">{generalChannel.participantIds.length} active</Badge>
              </div>
              <div className="channel-preview__message">
                <p>{generalChannel.lastMessage?.body ?? 'No messages yet.'}</p>
                <small>
                  {generalChannel.lastMessage
                    ? formatRelativeTime(generalChannel.lastMessage.createdAt)
                    : 'Waiting for the first update'}
                </small>
              </div>
            </article>
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="Channels appear here"
              description="Enable Realtime Database and start the general conversation."
            />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent activity" subtitle="The latest cross-module events">
        <div className="activity-feed">
          {activity.slice(0, 8).map((item) => (
            <article key={item.id} className="activity-item">
              <div className="activity-item__marker" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{formatRelativeTime(item.createdAt)}</small>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
