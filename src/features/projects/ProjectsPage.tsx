import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, FilePlus2, FolderKanban, FolderUp, MessageSquareShare, Plus, TimerReset } from 'lucide-react';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatMinutesAsHours, formatRelativeTime, formatShortDate } from '@/lib/format';
import { meetingSchema, noteSchema, projectSchema, taskSchema } from '@/lib/validation';
import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from '@/lib/constants';

const projectTabs = ['board', 'notes', 'meetings', 'files', 'time', 'channel'] as const;

type ComposeMode = 'project' | 'task' | 'note' | 'meeting' | 'document' | null;

export function ProjectsPage() {
  type ProjectFormInput = z.input<typeof projectSchema>;
  type ProjectFormValues = z.output<typeof projectSchema>;
  type TaskFormInput = z.input<typeof taskSchema>;
  type TaskFormValues = z.output<typeof taskSchema>;
  type NoteFormInput = z.input<typeof noteSchema>;
  type NoteFormValues = z.output<typeof noteSchema>;
  type MeetingFormInput = z.input<typeof meetingSchema>;
  type MeetingFormValues = z.output<typeof meetingSchema>;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    clients,
    members,
    projects,
    tasks,
    notes,
    meetings,
    timeEntries,
    workspace,
    createProject,
    createTask,
    createNote,
    createMeeting,
    uploadAttachment,
    channels,
    realtimeEnabled,
  } = useWorkspace();
  const [activeTab, setActiveTab] = useState<(typeof projectTabs)[number]>('board');
  const [composeMode, setComposeMode] = useState<ComposeMode>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const selectedProjectId = searchParams.get('project') ?? projects[0]?.id ?? null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const relatedTasks = useMemo(
    () => tasks.filter((task) => task.projectId === selectedProjectId),
    [selectedProjectId, tasks],
  );
  const relatedNotes = useMemo(
    () => notes.filter((note) => note.entityType === 'project' && note.entityId === selectedProjectId),
    [notes, selectedProjectId],
  );
  const relatedMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.entityType === 'project' && meeting.entityId === selectedProjectId),
    [meetings, selectedProjectId],
  );
  const relatedTime = useMemo(
    () => timeEntries.filter((entry) => entry.projectId === selectedProjectId),
    [selectedProjectId, timeEntries],
  );

  const projectForm = useForm<ProjectFormInput, undefined, ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      clientId: clients[0]?.id ?? '',
      name: '',
      summary: '',
      vertical: workspace?.verticals[0] ?? 'Operations',
      memberIds: user ? [user.uid] : ([] as string[]),
      status: 'active',
      startDate: '',
      dueDate: '',
      budget: 0,
    },
  });
  const taskForm = useForm<TaskFormInput, undefined, TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeIds: user ? [user.uid] : ([] as string[]),
      clientId: selectedProject?.clientId ?? '',
      projectId: selectedProjectId ?? '',
      vertical: selectedProject?.vertical ?? workspace?.verticals[0] ?? 'Operations',
      dueDate: '',
      estimateHours: 1,
    },
  });
  const noteForm = useForm<NoteFormInput, undefined, NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      entityType: 'project',
      entityId: selectedProjectId ?? '',
      title: '',
      content: '',
      visibility: 'team',
      category: 'note',
    },
  });
  const meetingForm = useForm<MeetingFormInput, undefined, MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      entityType: 'project',
      entityId: selectedProjectId ?? '',
      title: '',
      summary: '',
      actionItems: '',
      scheduledFor: '',
      attendees: user ? [user.uid] : ([] as string[]),
    },
  });

  useEffect(() => {
    if (selectedProjectId && selectedProject) {
      taskForm.setValue('projectId', selectedProjectId);
      taskForm.setValue('clientId', selectedProject.clientId);
      taskForm.setValue('vertical', selectedProject.vertical);
      noteForm.setValue('entityId', selectedProjectId);
      meetingForm.setValue('entityId', selectedProjectId);
    }
  }, [meetingForm, noteForm, selectedProject, selectedProjectId, taskForm]);

  useEffect(() => {
    if (!user) return;

    if (composeMode === 'project' && projectForm.getValues('memberIds').length === 0) {
      projectForm.setValue('memberIds', [user.uid], { shouldDirty: false, shouldValidate: true });
    }

    if (composeMode === 'task' && taskForm.getValues('assigneeIds').length === 0) {
      taskForm.setValue('assigneeIds', [user.uid], { shouldDirty: false, shouldValidate: true });
    }

    if (composeMode === 'meeting' && meetingForm.getValues('attendees').length === 0) {
      meetingForm.setValue('attendees', [user.uid], { shouldDirty: false, shouldValidate: true });
    }
  }, [composeMode, meetingForm, projectForm, taskForm, user]);

  const selectedProjectMemberIds = projectForm.watch('memberIds');
  const selectedTaskAssigneeIds = taskForm.watch('assigneeIds');
  const selectedMeetingAttendees = meetingForm.watch('attendees');

  async function submitProject(values: ProjectFormValues) {
    const project = await createProject({
      ...values,
      startDate: values.startDate || undefined,
      dueDate: values.dueDate || undefined,
      budget: values.budget || undefined,
    });
    setComposeMode(null);
    setSearchParams(new URLSearchParams({ project: project.id }));
    projectForm.reset({
      clientId: clients[0]?.id ?? '',
      name: '',
      summary: '',
      vertical: workspace?.verticals[0] ?? 'Operations',
      memberIds: user ? [user.uid] : [],
      status: 'active',
      startDate: '',
      dueDate: '',
      budget: 0,
    });
  }

  async function submitTask(values: TaskFormValues) {
    await createTask({
      ...values,
      clientId: values.clientId || undefined,
      projectId: values.projectId || undefined,
      dueDate: values.dueDate || undefined,
      estimateHours: values.estimateHours || undefined,
    });
    setComposeMode(null);
    taskForm.reset({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeIds: user ? [user.uid] : [],
      clientId: selectedProject?.clientId ?? '',
      projectId: selectedProjectId ?? '',
      vertical: selectedProject?.vertical ?? workspace?.verticals[0] ?? 'Operations',
      dueDate: '',
      estimateHours: 1,
    });
  }

  async function submitNote(values: NoteFormValues) {
    setRecordError(null);
    try {
      const attachments =
        values.category === 'document' && pendingFile
          ? [
              await uploadAttachment({
                entityType: 'project',
                entityId: values.entityId,
                category: values.category,
                file: pendingFile,
              }),
            ]
          : [];
      await createNote({ ...values, attachments });
      setComposeMode(null);
      setPendingFile(null);
      noteForm.reset({
        entityType: 'project',
        entityId: selectedProjectId ?? '',
        title: '',
        content: '',
        visibility: 'team',
        category: 'note',
      });
    } catch (error) {
      setRecordError(
        error instanceof Error ? error.message : 'Unable to save this project record.',
      );
    }
  }

  async function submitMeeting(values: MeetingFormValues) {
    await createMeeting(values);
    setComposeMode(null);
    meetingForm.reset({
      entityType: 'project',
      entityId: selectedProjectId ?? '',
      title: '',
      summary: '',
      actionItems: '',
      scheduledFor: '',
      attendees: user ? [user.uid] : [],
    });
  }

  return (
    <div className="page-stack">
      <section className="page-header page-header--split">
        <div>
          <span className="eyebrow">Projects</span>
          <h1>Execution workspace by account and vertical</h1>
          <p>Run delivery, notes, meetings, files, time, and project chat from one place.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="pill-button" onClick={() => setComposeMode('project')}>
            <Plus size={16} />
            New project
          </button>
        </div>
      </section>

      <div className="two-column-layout two-column-layout--wide-left">
        <SectionCard title="Project list" subtitle="Current accounts and delivery status">
          {projects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Convert a won client into a project or create one directly here."
            />
          ) : (
            <div className="list-stack">
              {projects.map((project) => {
                const client = clients.find((client) => client.id === project.clientId);
                return (
                  <button
                    key={project.id}
                    type="button"
                    className={
                      project.id === selectedProjectId
                        ? 'project-row project-row--active'
                        : 'project-row'
                    }
                    onClick={() => setSearchParams(new URLSearchParams({ project: project.id }))}
                  >
                    <div>
                      <strong>{project.name}</strong>
                      <p>{client?.company ?? 'Internal project'}</p>
                    </div>
                    <div className="list-row__meta">
                      <Badge tone={project.status === 'completed' ? 'success' : 'info'}>
                        {PROJECT_STATUS_LABELS[project.status]}
                      </Badge>
                      <small>{project.vertical}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        {selectedProject ? (
          <SectionCard
            title={selectedProject.name}
            subtitle={selectedProject.summary}
            action={
              <div className="toggle-group">
                <button type="button" className="secondary-button" onClick={() => setComposeMode('task')}>
                  <Plus size={16} />
                  Add task
                </button>
                <button type="button" className="secondary-button" onClick={() => setComposeMode('note')}>
                  <FilePlus2 size={16} />
                  Add note
                </button>
                <button type="button" className="secondary-button" onClick={() => setComposeMode('meeting')}>
                  <CalendarDays size={16} />
                  Log meeting
                </button>
              </div>
            }
          >
            <div className="tab-row">
              {projectTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? 'tab-button tab-button--active' : 'tab-button'}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'board' ? (
              <div className="kanban-preview">
                {(['todo', 'in_progress', 'review', 'done'] as const).map((status) => (
                  <div key={status} className="kanban-preview__column">
                    <header>
                      <strong>{TASK_STATUS_LABELS[status]}</strong>
                      <span>{relatedTasks.filter((task) => task.status === status).length}</span>
                    </header>
                    {relatedTasks
                      .filter((task) => task.status === status)
                      .map((task) => (
                        <article key={task.id} className="kanban-preview__card">
                          <Badge tone={task.priority === 'urgent' ? 'danger' : 'info'}>
                            {task.priority}
                          </Badge>
                          <strong>{task.title}</strong>
                          <p>{task.description}</p>
                          <small>{task.dueDate ? formatShortDate(task.dueDate) : 'No due date'}</small>
                        </article>
                      ))}
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === 'notes' ? (
              <ProjectRecordList
                title="Notes"
                records={relatedNotes.filter((note) => note.category === 'note')}
                emptyTitle="No project notes yet"
                emptyDescription="Store decisions, briefs, and context here."
                onAdd={() => {
                  noteForm.setValue('category', 'note');
                  setComposeMode('note');
                }}
              />
            ) : null}

            {activeTab === 'meetings' ? (
              <div className="list-stack">
                {relatedMeetings.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="No meetings logged"
                    description="Kickoffs, reviews, and standups will appear here."
                  />
                ) : (
                  relatedMeetings.map((meeting) => (
                    <article key={meeting.id} className="record-card">
                      <div className="record-card__header">
                        <strong>{meeting.title}</strong>
                        <small>{formatShortDate(meeting.scheduledFor)}</small>
                      </div>
                      <p>{meeting.summary}</p>
                      <small>{meeting.actionItems}</small>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {activeTab === 'files' ? (
              <ProjectRecordList
                title="Files"
                records={relatedNotes.filter((note) => note.category === 'document')}
                emptyTitle="No files uploaded"
                emptyDescription="Upload project documents, design files, and supporting material."
                onAdd={() => {
                  noteForm.setValue('category', 'document');
                  setComposeMode('document');
                }}
              />
            ) : null}

            {activeTab === 'time' ? (
              <div className="list-stack">
                {relatedTime.length === 0 ? (
                  <EmptyState
                    icon={TimerReset}
                    title="No time logged"
                    description="Time entries linked to this project will appear here."
                  />
                ) : (
                  relatedTime.map((entry) => {
                    const member = members.find((teamMember) => teamMember.uid === entry.memberId);
                    return (
                      <article key={entry.id} className="list-row">
                        <div>
                          <strong>{entry.description}</strong>
                          <p>{member?.name ?? 'Team member'}</p>
                        </div>
                        <div className="list-row__meta">
                          <span>{formatMinutesAsHours(entry.durationMinutes)}</span>
                          <small>{formatRelativeTime(entry.startedAt)}</small>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            ) : null}

            {activeTab === 'channel' ? (
              <div className="list-stack">
                {realtimeEnabled ? (
                  <>
                    <article className="record-card">
                      <div className="record-card__header">
                        <strong>{channels.find((channel) => channel.projectId === selectedProject.id)?.name ?? selectedProject.name}</strong>
                        <small>Realtime channel</small>
                      </div>
                      <p>
                        Keep project chat connected to tasks, files, and meetings instead of
                        splitting context into a separate app.
                      </p>
                    </article>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => navigate(`/messages?channel=project_${selectedProject.id}`)}
                    >
                      <MessageSquareShare size={16} />
                      Open project channel
                    </button>
                  </>
                ) : (
                  <EmptyState
                    icon={MessageSquareShare}
                    title="Realtime Database not configured"
                    description="Add the database URL to enable project channels and live messaging."
                  />
                )}
              </div>
            ) : null}
          </SectionCard>
        ) : null}
      </div>

      <Modal title="Create project" open={composeMode === 'project'} onClose={() => setComposeMode(null)} width="lg">
        <form className="form-grid" onSubmit={projectForm.handleSubmit((values) => void submitProject(values))}>
          <label>
            <span>Client</span>
            <select {...projectForm.register('clientId')}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Project name</span>
            <input type="text" {...projectForm.register('name')} />
          </label>
          <label>
            <span>Vertical</span>
            <select {...projectForm.register('vertical')}>
              {(workspace?.verticals ?? []).map((vertical) => (
                <option key={vertical} value={vertical}>
                  {vertical}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select {...projectForm.register('status')}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="form-grid__wide">
            <span>Summary</span>
            <textarea rows={4} {...projectForm.register('summary')} />
          </label>
          <label>
            <span>Start date</span>
            <input type="date" {...projectForm.register('startDate')} />
          </label>
          <label>
            <span>Due date</span>
            <input type="date" {...projectForm.register('dueDate')} />
          </label>
          <label>
            <span>Budget</span>
            <input type="number" min="0" {...projectForm.register('budget')} />
          </label>
          <fieldset className="checkbox-fieldset form-grid__wide">
            <legend>Team members</legend>
            <div className="checkbox-grid">
              {members.map((member) => (
                <label key={member.id} className="checkbox-card">
                  <input
                    type="checkbox"
                    value={member.uid}
                    checked={selectedProjectMemberIds.includes(member.uid)}
                    onChange={(event) => {
                      const current = projectForm.getValues('memberIds');
                      const next = event.target.checked
                        ? [...current, member.uid]
                        : current.filter((value) => value !== member.uid);
                      projectForm.setValue('memberIds', next);
                    }}
                  />
                  <span>{member.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setComposeMode(null)}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Plus size={16} />
              Create project
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Add project task" open={composeMode === 'task'} onClose={() => setComposeMode(null)} width="lg">
        <form className="form-grid" onSubmit={taskForm.handleSubmit((values) => void submitTask(values))}>
          <label>
            <span>Task title</span>
            <input type="text" {...taskForm.register('title')} />
          </label>
          <label>
            <span>Priority</span>
            <select {...taskForm.register('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="form-grid__wide">
            <span>Description</span>
            <textarea rows={4} {...taskForm.register('description')} />
          </label>
          <label>
            <span>Status</span>
            <select {...taskForm.register('status')}>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input type="date" {...taskForm.register('dueDate')} />
          </label>
          <fieldset className="checkbox-fieldset form-grid__wide">
            <legend>Assignees</legend>
            <div className="checkbox-grid">
              {members.map((member) => (
                <label key={member.id} className="checkbox-card">
                  <input
                    type="checkbox"
                    value={member.uid}
                    checked={selectedTaskAssigneeIds.includes(member.uid)}
                    onChange={(event) => {
                      const current = taskForm.getValues('assigneeIds');
                      const next = event.target.checked
                        ? [...current, member.uid]
                        : current.filter((value) => value !== member.uid);
                      taskForm.setValue('assigneeIds', next);
                    }}
                  />
                  <span>{member.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setComposeMode(null)}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Plus size={16} />
              Create task
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={composeMode === 'document' ? 'Upload project file' : 'Add project note'}
        open={composeMode === 'note' || composeMode === 'document'}
        onClose={() => setComposeMode(null)}
      >
        <form className="form-grid" onSubmit={noteForm.handleSubmit((values) => void submitNote(values))}>
          {recordError ? <div className="form-error form-grid__wide">{recordError}</div> : null}
          <label>
            <span>Title</span>
            <input type="text" {...noteForm.register('title')} />
          </label>
          <label>
            <span>Visibility</span>
            <select {...noteForm.register('visibility')}>
              <option value="team">Team</option>
              <option value="leadership">Leadership</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="form-grid__wide">
            <span>Content</span>
            <textarea rows={5} {...noteForm.register('content')} />
          </label>
          {composeMode === 'document' ? (
            <label className="form-grid__wide">
              <span>Attachment</span>
              <input type="file" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
            </label>
          ) : null}
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setComposeMode(null)}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              onClick={() =>
                noteForm.setValue('category', composeMode === 'document' ? 'document' : 'note')
              }
            >
              {composeMode === 'document' ? <FolderUp size={16} /> : <FilePlus2 size={16} />}
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal title="Log meeting" open={composeMode === 'meeting'} onClose={() => setComposeMode(null)} width="lg">
        <form className="form-grid" onSubmit={meetingForm.handleSubmit((values) => void submitMeeting(values))}>
          <label>
            <span>Meeting title</span>
            <input type="text" {...meetingForm.register('title')} />
          </label>
          <label>
            <span>Scheduled for</span>
            <input type="datetime-local" {...meetingForm.register('scheduledFor')} />
          </label>
          <label className="form-grid__wide">
            <span>Summary</span>
            <textarea rows={4} {...meetingForm.register('summary')} />
          </label>
          <label className="form-grid__wide">
            <span>Action items</span>
            <textarea rows={4} {...meetingForm.register('actionItems')} />
          </label>
          <fieldset className="checkbox-fieldset form-grid__wide">
            <legend>Attendees</legend>
            <div className="checkbox-grid">
              {members.map((member) => (
                <label key={member.id} className="checkbox-card">
                  <input
                    type="checkbox"
                    value={member.uid}
                    checked={selectedMeetingAttendees.includes(member.uid)}
                    onChange={(event) => {
                      const current = meetingForm.getValues('attendees');
                      const next = event.target.checked
                        ? [...current, member.uid]
                        : current.filter((value) => value !== member.uid);
                      meetingForm.setValue('attendees', next);
                    }}
                  />
                  <span>{member.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setComposeMode(null)}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <CalendarDays size={16} />
              Save meeting
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ProjectRecordList({
  title,
  records,
  emptyTitle,
  emptyDescription,
  onAdd,
}: {
  title: string;
  records: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
    attachments?: Array<{ url: string; name: string }>;
  }>;
  emptyTitle: string;
  emptyDescription: string;
  onAdd: () => void;
}) {
  return (
    <div className="list-stack">
      <div className="section-inline-actions">
        <button type="button" className="secondary-button" onClick={onAdd}>
          <Plus size={16} />
          Add {title.toLowerCase()}
        </button>
      </div>
      {records.length === 0 ? (
        <EmptyState icon={FilePlus2} title={emptyTitle} description={emptyDescription} />
      ) : (
        records.map((record) => (
          <article key={record.id} className="record-card">
            <div className="record-card__header">
              <strong>{record.title}</strong>
              <small>{formatRelativeTime(record.createdAt)}</small>
            </div>
            <p>{record.content}</p>
            {record.attachments?.length ? (
              <div className="record-card__attachments">
                {record.attachments.map((attachment) => (
                  <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">
                    {attachment.name}
                  </a>
                ))}
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
