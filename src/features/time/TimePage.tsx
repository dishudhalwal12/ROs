import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Clock3, Coffee, TimerReset, UsersRound } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, isSameDay, startOfDay, subDays } from 'date-fns';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { calculateWeeklyHours } from '@/lib/domain';
import {
  formatLongDateTime,
  formatMinutesAsHours,
  formatRelativeTime,
} from '@/lib/format';
import { timeEntrySchema } from '@/lib/validation';
import type { TimeEntry, WorkMode } from '@/types/models';

const WORK_COLOR = '#2f4bde';
const REST_COLOR = '#e58857';
const CHART_COLORS = ['#2f4bde', '#5f83ff', '#ef9b68', '#f3c86b', '#5bb59a', '#9174f8'];

function formatTooltipMinutes(
  value: number | string | ReadonlyArray<number | string> | undefined,
) {
  if (Array.isArray(value)) {
    return `${value[0] ?? 0} min`;
  }

  return `${value ?? 0} min`;
}

function isWorkEntry(entry: TimeEntry) {
  return (entry.mode ?? 'work') === 'work';
}

function isToday(value: string) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function buildFocusLabel(entry: TimeEntry) {
  return entry.description || 'Unlabeled focus';
}

export function TimePage() {
  type TimeEntryFormInput = z.input<typeof timeEntrySchema>;
  type TimeEntryFormValues = z.output<typeof timeEntrySchema>;

  const navigate = useNavigate();
  const { member } = useAuth();
  const {
    tasks,
    projects,
    clients,
    timeEntries,
    members,
    presence,
    liveStatuses,
    createTimeEntry,
  } = useWorkspace();

  const form = useForm<TimeEntryFormInput, undefined, TimeEntryFormValues>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      description: '',
      taskId: '',
      projectId: '',
      clientId: '',
      startedAt: '',
      endedAt: '',
      durationMinutes: 30,
    },
  });

  const myEntries = useMemo(
    () => timeEntries.filter((entry) => entry.memberId === member?.uid),
    [member?.uid, timeEntries],
  );
  const myWorkEntries = useMemo(
    () => myEntries.filter((entry) => (entry.mode ?? 'work') === 'work'),
    [myEntries],
  );
  const myRestEntries = useMemo(
    () => myEntries.filter((entry) => entry.mode === 'rest'),
    [myEntries],
  );
  const myWeeklyWorkMinutes = calculateWeeklyHours(timeEntries, member?.uid);
  const myWeeklyRestMinutes = useMemo(
    () =>
      myRestEntries
        .filter((entry) => {
          const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
          return new Date(entry.startedAt) >= sevenDaysAgo;
        })
        .reduce((sum, entry) => sum + entry.durationMinutes, 0),
    [myRestEntries],
  );
  const teamMinutesToday = useMemo(
    () =>
      timeEntries.reduce((sum, entry) => {
        return isToday(entry.startedAt) && isWorkEntry(entry)
          ? sum + entry.durationMinutes
          : sum;
      }, 0),
    [timeEntries],
  );
  const activeWorkCount = Object.values(liveStatuses).filter((entry) => entry.mode === 'work').length;
  const activeRestCount = Object.values(liveStatuses).filter((entry) => entry.mode === 'rest').length;
  const onlineCount = Object.values(presence).filter((entry) => entry.state === 'online').length;

  const myTrendData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(startOfDay(new Date()), 6 - index);
      const dayEntries = myEntries.filter((entry) => isSameDay(new Date(entry.startedAt), day));
      const work = dayEntries
        .filter((entry) => (entry.mode ?? 'work') === 'work')
        .reduce((sum, entry) => sum + entry.durationMinutes, 0);
      const rest = dayEntries
        .filter((entry) => entry.mode === 'rest')
        .reduce((sum, entry) => sum + entry.durationMinutes, 0);

      return {
        label: format(day, 'EEE'),
        work,
        rest,
      };
    });
  }, [myEntries]);

  const myFocusBreakdown = useMemo(() => {
    const grouped = myWorkEntries.reduce<Record<string, number>>((accumulator, entry) => {
      const label = buildFocusLabel(entry);
      accumulator[label] = (accumulator[label] ?? 0) + entry.durationMinutes;
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .map(([name, minutes]) => ({
        name,
        minutes,
      }))
      .sort((left, right) => right.minutes - left.minutes)
      .slice(0, 6);
  }, [myWorkEntries]);

  const recentSessions = useMemo(
    () =>
      myEntries
        .slice()
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
        .slice(0, 12),
    [myEntries],
  );

  const teamBoard = useMemo(
    () =>
      members
        .map((teamMember) => {
          const memberEntries = timeEntries.filter((entry) => entry.memberId === teamMember.uid);
          const workMinutesToday = memberEntries
            .filter((entry) => isToday(entry.startedAt) && (entry.mode ?? 'work') === 'work')
            .reduce((sum, entry) => sum + entry.durationMinutes, 0);
          const restMinutesToday = memberEntries
            .filter((entry) => isToday(entry.startedAt) && entry.mode === 'rest')
            .reduce((sum, entry) => sum + entry.durationMinutes, 0);

          return {
            member: teamMember,
            liveStatus: liveStatuses[teamMember.uid],
            isOnline: presence[teamMember.uid]?.state === 'online',
            workMinutesToday,
            restMinutesToday,
          };
        })
        .sort((left, right) => {
          if (left.member.uid === member?.uid) return -1;
          if (right.member.uid === member?.uid) return 1;
          if (left.isOnline !== right.isOnline) return left.isOnline ? -1 : 1;
          if (Boolean(left.liveStatus) !== Boolean(right.liveStatus)) return left.liveStatus ? -1 : 1;
          return right.workMinutesToday - left.workMinutesToday;
        }),
    [liveStatuses, member?.uid, members, presence, timeEntries],
  );

  async function submitManualEntry(values: TimeEntryFormValues) {
    const startedAt = values.startedAt || new Date().toISOString();
    const endedAt =
      values.endedAt ||
      new Date(new Date(startedAt).getTime() + values.durationMinutes * 60000).toISOString();

    await createTimeEntry({
      mode: 'work',
      source: 'manual',
      description: values.description,
      taskId: values.taskId || undefined,
      projectId: values.projectId || undefined,
      clientId: values.clientId || undefined,
      startedAt,
      endedAt,
      durationMinutes: values.durationMinutes,
    });

    form.reset({
      description: '',
      taskId: '',
      projectId: '',
      clientId: '',
      startedAt: '',
      endedAt: '',
      durationMinutes: 30,
    });
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="eyebrow">Time</span>
          <h1>Work and rest history, live status, and focus analytics</h1>
          <p>Track what you worked on, when you rested, and how your week is actually being spent.</p>
        </div>
      </section>

      <section className="hero-panel timepass-launcher">
        <div>
          <span className="eyebrow">Timepass</span>
          <h1>Flip the room into a synced lounge for music, watch parties, and live sharing.</h1>
          <p>
            Jump into the immersive Timepass mode for premium room audio, YouTube sync, screen sharing,
            push-to-talk voice, and a much more playful full-screen vibe.
          </p>
        </div>
        <div className="hero-panel__summary">
          <div>
            <strong>DJ queue</strong>
            <span>Uploads + YouTube watch party</span>
          </div>
          <div>
            <strong>Voice room</strong>
            <span>Push-to-talk or open mic</span>
          </div>
          <div>
            <strong>Live sharing</strong>
            <span>Tabs, screens, and system audio</span>
          </div>
        </div>
        <div className="page-header__actions">
          <button type="button" className="primary-button" onClick={() => navigate('/time/timepass')}>
            <Activity size={16} />
            Enter Timepass
          </button>
        </div>
      </section>

      <div className="stats-grid stats-grid--four">
        <article className="stat-card stat-card--mint">
          <div className="stat-card__icon">
            <Activity size={18} />
          </div>
          <div className="stat-card__meta">
            <strong>{activeWorkCount}</strong>
            <span>Working now</span>
          </div>
        </article>
        <article className="stat-card stat-card--peach">
          <div className="stat-card__icon">
            <Coffee size={18} />
          </div>
          <div className="stat-card__meta">
            <strong>{activeRestCount}</strong>
            <span>Resting now</span>
          </div>
        </article>
        <article className="stat-card stat-card--blue">
          <div className="stat-card__icon">
            <UsersRound size={18} />
          </div>
          <div className="stat-card__meta">
            <strong>{onlineCount}</strong>
            <span>Online teammates</span>
          </div>
        </article>
        <article className="stat-card stat-card--gold">
          <div className="stat-card__icon">
            <Clock3 size={18} />
          </div>
          <div className="stat-card__meta">
            <strong>{formatMinutesAsHours(teamMinutesToday)}</strong>
            <span>Team work today</span>
          </div>
        </article>
      </div>

      <div className="stats-grid stats-grid--four">
        <article className="stat-card">
          <div className="stat-card__meta">
            <strong>{formatMinutesAsHours(myWeeklyWorkMinutes)}</strong>
            <span>Your work this week</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card__meta">
            <strong>{formatMinutesAsHours(myWeeklyRestMinutes)}</strong>
            <span>Your rest this week</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card__meta">
            <strong>{myWorkEntries.length}</strong>
            <span>Work sessions logged</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card__meta">
            <strong>{myRestEntries.length}</strong>
            <span>Rest sessions logged</span>
          </div>
        </article>
      </div>

      <div className="two-column-layout">
        <SectionCard title="Live team board" subtitle="Who is working or resting right now">
          {teamBoard.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No team data yet"
              description="Invite the team to start seeing live work and rest state here."
            />
          ) : (
            <div className="team-status-grid">
              {teamBoard.map((entry) => (
                <article key={entry.member.uid} className="team-status-card">
                  <div className="team-status-card__header">
                    <div className="member-inline">
                      <span
                        className={
                          entry.isOnline
                            ? 'presence-ring presence-ring--online'
                            : 'presence-ring presence-ring--offline'
                        }
                      >
                        <Avatar member={entry.member} shape="circle" />
                      </span>
                      <div>
                        <strong>{entry.member.uid === member?.uid ? 'You' : entry.member.name}</strong>
                        <p>{entry.member.title}</p>
                      </div>
                    </div>
                    <Badge
                      tone={
                        entry.liveStatus?.mode === 'work'
                          ? 'success'
                          : entry.liveStatus?.mode === 'rest'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {entry.liveStatus?.mode ?? 'idle'}
                    </Badge>
                  </div>
                  <p className="team-status-card__label">
                    {entry.liveStatus?.label ?? 'No live status right now.'}
                  </p>
                  <div className="team-status-card__footer">
                    <span>{entry.isOnline ? 'Online' : 'Offline'}</span>
                    <span>Work {formatMinutesAsHours(entry.workMinutesToday)}</span>
                    <span>Rest {formatMinutesAsHours(entry.restMinutesToday)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Your weekly trend" subtitle="Stacked work vs rest for the last 7 days">
          {myEntries.length === 0 ? (
            <EmptyState
              icon={TimerReset}
              title="No tracked sessions yet"
              description="Use the floating work/rest widget and your trend chart will show up here."
            />
          ) : (
            <div className="chart-panel">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={myTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(80, 61, 31, 0.12)" />
                  <XAxis dataKey="label" stroke="#6e6255" />
                  <YAxis stroke="#6e6255" tickFormatter={(value) => `${value}m`} />
                  <Tooltip formatter={(value) => [formatTooltipMinutes(value), '']} />
                  <Legend />
                  <Bar dataKey="work" name="Work" stackId="time" fill={WORK_COLOR} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="rest" name="Rest" stackId="time" fill={REST_COLOR} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="two-column-layout">
        <SectionCard title="Focus split" subtitle="Where your tracked work time went">
          {myFocusBreakdown.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No work sessions yet"
              description="Once you log work, this pie chart will break down your focus areas."
            />
          ) : (
            <div className="chart-panel">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={myFocusBreakdown}
                    dataKey="minutes"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={3}
                  >
                    {myFocusBreakdown.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatTooltipMinutes(value), 'Tracked time']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent sessions" subtitle="What you did, what mode it was, and when">
          {recentSessions.length === 0 ? (
            <EmptyState
              icon={TimerReset}
              title="No session history yet"
              description="Start work or rest from the floating widget and your history will appear here."
            />
          ) : (
            <div className="list-stack">
              {recentSessions.map((entry) => {
                const task = tasks.find((taskItem) => taskItem.id === entry.taskId);
                const project = projects.find((projectItem) => projectItem.id === entry.projectId);
                const mode = (entry.mode ?? 'work') as WorkMode;

                return (
                  <article key={entry.id} className="list-row">
                    <div>
                      <strong>{entry.description}</strong>
                      <p>{task?.title ?? project?.name ?? (mode === 'rest' ? 'Rest session' : 'General work')}</p>
                      <small>
                        {formatLongDateTime(entry.startedAt)} to {formatLongDateTime(entry.endedAt)}
                      </small>
                    </div>
                    <div className="list-row__meta">
                      <Badge tone={mode === 'work' ? 'success' : 'warning'}>{mode}</Badge>
                      <span>{formatMinutesAsHours(entry.durationMinutes)}</span>
                      <small>{formatRelativeTime(entry.startedAt)}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Manual work log" subtitle="Add completed work if you forgot to start the tracker">
        <form className="form-grid" onSubmit={form.handleSubmit((values) => void submitManualEntry(values))}>
          <label className="form-grid__wide">
            <span>Description</span>
            <input type="text" {...form.register('description')} />
          </label>
          <label>
            <span>Task</span>
            <select {...form.register('taskId')}>
              <option value="">Optional</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Project</span>
            <select {...form.register('projectId')}>
              <option value="">Optional</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Client</span>
            <select {...form.register('clientId')}>
              <option value="">Optional</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Start</span>
            <input type="datetime-local" {...form.register('startedAt')} />
          </label>
          <label>
            <span>End</span>
            <input type="datetime-local" {...form.register('endedAt')} />
          </label>
          <label>
            <span>Minutes</span>
            <input type="number" min="1" {...form.register('durationMinutes')} />
          </label>
          <div className="modal-actions form-grid__wide">
            <button type="submit" className="primary-button">
              <Clock3 size={16} />
              Save work entry
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
