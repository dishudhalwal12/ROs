import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock3, Play, Square, TimerReset } from 'lucide-react';
import { z } from 'zod';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { calculateWeeklyHours } from '@/lib/domain';
import { formatLongDateTime, formatMinutesAsHours } from '@/lib/format';
import { timeEntrySchema } from '@/lib/validation';

interface RunningTimerState {
  startedAt: string;
  description: string;
  taskId?: string;
  projectId?: string;
  clientId?: string;
}

const TIMER_STORAGE_KEY = 'rovexa-running-timer';

export function TimePage() {
  type TimeEntryFormInput = z.input<typeof timeEntrySchema>;
  type TimeEntryFormValues = z.output<typeof timeEntrySchema>;
  const { member } = useAuth();
  const { tasks, projects, clients, timeEntries, members, createTimeEntry } = useWorkspace();
  const [runningTimer, setRunningTimer] = useState<RunningTimerState | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

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

  useEffect(() => {
    const saved = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as RunningTimerState;
    setRunningTimer(parsed);
  }, []);

  useEffect(() => {
    if (!runningTimer) {
      setElapsedMinutes(0);
      return;
    }

    const updateElapsed = () => {
      const minutes = Math.max(
        1,
        Math.round((Date.now() - new Date(runningTimer.startedAt).getTime()) / 60000),
      );
      setElapsedMinutes(minutes);
    };

    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [runningTimer]);

  const myEntries = timeEntries.filter((entry) => entry.memberId === member?.uid);
  const weeklyMinutes = calculateWeeklyHours(timeEntries, member?.uid);
  const teamMinutesToday = useMemo(
    () =>
      timeEntries.reduce((sum, entry) => {
        const today = new Date().toDateString();
        return new Date(entry.startedAt).toDateString() === today
          ? sum + entry.durationMinutes
          : sum;
      }, 0),
    [timeEntries],
  );

  async function startTimer() {
    const values = form.getValues();
    const nextTimer: RunningTimerState = {
      startedAt: new Date().toISOString(),
      description: values.description || 'Focused work block',
      taskId: values.taskId || undefined,
      projectId: values.projectId || undefined,
      clientId: values.clientId || undefined,
    };
    setRunningTimer(nextTimer);
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(nextTimer));
  }

  async function stopTimer() {
    if (!runningTimer) return;
    const endedAt = new Date().toISOString();
    const durationMinutes = Math.max(
      1,
      Math.round((new Date(endedAt).getTime() - new Date(runningTimer.startedAt).getTime()) / 60000),
    );

    await createTimeEntry({
      description: runningTimer.description,
      taskId: runningTimer.taskId,
      projectId: runningTimer.projectId,
      clientId: runningTimer.clientId,
      startedAt: runningTimer.startedAt,
      endedAt,
      durationMinutes,
    });
    setRunningTimer(null);
    window.localStorage.removeItem(TIMER_STORAGE_KEY);
  }

  async function submitManualEntry(values: TimeEntryFormValues) {
    const startedAt = values.startedAt || new Date().toISOString();
    const endedAt =
      values.endedAt ||
      new Date(new Date(startedAt).getTime() + values.durationMinutes * 60000).toISOString();
    await createTimeEntry({
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
          <h1>Focused work blocks and manual logging</h1>
          <p>Track effort against tasks, clients, and projects without losing delivery context.</p>
        </div>
      </section>

      <div className="dashboard-grid">
        <SectionCard title="Live timer" subtitle="Start a block and stop when done">
          <div className="timer-panel">
            <div className="timer-panel__clock">
              <strong>{formatMinutesAsHours(elapsedMinutes)}</strong>
              <small>{runningTimer ? runningTimer.description : 'No timer running'}</small>
            </div>
            <form className="form-grid">
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
            </form>
            <div className="timer-panel__actions">
              {runningTimer ? (
                <button type="button" className="primary-button" onClick={() => void stopTimer()}>
                  <Square size={16} />
                  Stop timer
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={() => void startTimer()}>
                  <Play size={16} />
                  Start timer
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Weekly pulse" subtitle="Your logged time and the team total">
          <div className="detail-grid">
            <div>
              <span>Your week</span>
              <strong>{formatMinutesAsHours(weeklyMinutes)}</strong>
            </div>
            <div>
              <span>Team today</span>
              <strong>{formatMinutesAsHours(teamMinutesToday)}</strong>
            </div>
            <div>
              <span>Entries logged</span>
              <strong>{myEntries.length}</strong>
            </div>
            <div>
              <span>Active members</span>
              <strong>{members.length}</strong>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="two-column-layout">
        <SectionCard title="Manual log" subtitle="Add a completed block after the fact">
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
                Save entry
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Recent entries" subtitle="Latest logged blocks">
          {myEntries.length === 0 ? (
            <EmptyState
              icon={TimerReset}
              title="No time entries yet"
              description="Start a timer or log a manual block to build the accountability view."
            />
          ) : (
            <div className="list-stack">
              {myEntries.slice(0, 10).map((entry) => {
                const task = tasks.find((task) => task.id === entry.taskId);
                const project = projects.find((project) => project.id === entry.projectId);
                return (
                  <article key={entry.id} className="list-row">
                    <div>
                      <strong>{entry.description}</strong>
                      <p>{task?.title ?? project?.name ?? 'General work'}</p>
                    </div>
                    <div className="list-row__meta">
                      <span>{formatMinutesAsHours(entry.durationMinutes)}</span>
                      <small>{formatLongDateTime(entry.startedAt)}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
