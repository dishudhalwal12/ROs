import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { z } from 'zod';
import {
  CalendarClock,
  Filter,
  GripVertical,
  LayoutGrid,
  List,
  Plus,
  Save,
  SquareCheckBig,
  UserRound,
} from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/use-auth';
import { useUiStore } from '@/store/ui-store';
import { useWorkspace } from '@/hooks/use-workspace';
import { defaultTaskFilters, filterTasks, groupTasksByStatus, upsertSavedFilter } from '@/lib/domain';
import { formatShortDate } from '@/lib/format';
import { taskSchema } from '@/lib/validation';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/constants';

function TaskBoardCard({
  taskId,
  title,
  description,
  vertical,
  dueDate,
}: {
  taskId: string;
  title: string;
  description: string;
  vertical: string;
  dueDate?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: taskId,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'task-card task-card--dragging' : 'task-card'}
    >
      <div className="task-card__handle" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </div>
      <Badge tone="info">{vertical}</Badge>
      <strong>{title}</strong>
      <p>{description}</p>
      <small>{dueDate ? `Due ${formatShortDate(dueDate)}` : 'No due date'}</small>
    </article>
  );
}

function DroppableColumn({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className={isOver ? 'kanban-column kanban-column--over' : 'kanban-column'}>
      <header className="kanban-column__header">
        <strong>{title}</strong>
        <span>{count}</span>
      </header>
      <div className="kanban-column__body">{children}</div>
    </div>
  );
}

export function TasksPage() {
  type TaskFormInput = z.input<typeof taskSchema>;
  type TaskFormValues = z.output<typeof taskSchema>;
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    members,
    clients,
    projects,
    tasks,
    workspace,
    createTask,
    updateTaskStatus,
  } = useWorkspace();
  const { taskView, setTaskView, savedTaskFilters, setSavedTaskFilters } = useUiStore();
  const [filters, setFilters] = useState(defaultTaskFilters());
  const [modalOpen, setModalOpen] = useState(searchParams.get('compose') === 'task');
  const selectedTaskId = searchParams.get('task');

  useEffect(() => {
    setModalOpen(searchParams.get('compose') === 'task');
  }, [searchParams]);

  const filteredTasks = useMemo(() => filterTasks(tasks, filters), [filters, tasks]);
  const grouped = useMemo(() => groupTasksByStatus(filteredTasks), [filteredTasks]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const form = useForm<TaskFormInput, undefined, TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeIds: user ? [user.uid] : ([] as string[]),
      clientId: '',
      projectId: '',
      vertical: workspace?.verticals[0] ?? 'Operations',
      dueDate: '',
      estimateHours: 1,
    },
  });

  useEffect(() => {
    if (workspace?.verticals[0]) {
      form.setValue('vertical', workspace.verticals[0]);
    }
  }, [form, workspace?.verticals]);

  useEffect(() => {
    if (modalOpen && user && form.getValues('assigneeIds').length === 0) {
      form.setValue('assigneeIds', [user.uid], { shouldDirty: false, shouldValidate: true });
    }
  }, [form, modalOpen, user]);

  const selectedAssigneeIds = form.watch('assigneeIds');

  async function onSubmit(values: TaskFormValues) {
    await createTask({
      ...values,
      clientId: values.clientId || undefined,
      projectId: values.projectId || undefined,
      dueDate: values.dueDate || undefined,
      estimateHours: values.estimateHours || undefined,
    });
    form.reset({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      assigneeIds: user ? [user.uid] : [],
      clientId: '',
      projectId: '',
      vertical: workspace?.verticals[0] ?? 'Operations',
      dueDate: '',
      estimateHours: 1,
    });
    setModalOpen(false);
    searchParams.delete('compose');
    setSearchParams(searchParams);
  }

  function saveCurrentFilters() {
    const name = window.prompt('Name this saved filter view', 'My focus');
    if (!name) return;
    setSavedTaskFilters(
      upsertSavedFilter(savedTaskFilters, {
        id: crypto.randomUUID(),
        name,
        filters,
      }),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    const nextStatus = event.over.id.toString() as
      | 'todo'
      | 'in_progress'
      | 'review'
      | 'done';
    const taskId = event.active.id.toString();
    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask || targetTask.status === nextStatus) return;
    await updateTaskStatus(taskId, nextStatus);
  }

  return (
    <div className="page-stack">
      <section className="page-header page-header--split">
        <div>
          <span className="eyebrow">Tasks</span>
          <h1>Delivery board and task list</h1>
          <p>Filter by assignee, vertical, status, and urgency. Drag cards to move work.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="pill-button" onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            New task
          </button>
        </div>
      </section>

      <SectionCard
        title="Filters"
        subtitle="Save working views for daily use"
        action={
          <div className="toggle-group">
            <button
              type="button"
              className={taskView === 'board' ? 'toggle-button toggle-button--active' : 'toggle-button'}
              onClick={() => setTaskView('board')}
            >
              <LayoutGrid size={16} />
              Board
            </button>
            <button
              type="button"
              className={taskView === 'list' ? 'toggle-button toggle-button--active' : 'toggle-button'}
              onClick={() => setTaskView('list')}
            >
              <List size={16} />
              List
            </button>
          </div>
        }
      >
        <div className="filter-grid">
          <label>
            <span>Search</span>
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as typeof current.status,
                }))
              }
            >
              <option value="all">All</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            <span>Assignee</span>
            <select
              value={filters.assigneeId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  assigneeId: event.target.value,
                }))
              }
            >
              <option value="all">All</option>
              {members.map((member) => (
                <option key={member.id} value={member.uid}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Vertical</span>
            <select
              value={filters.vertical}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  vertical: event.target.value,
                }))
              }
            >
              <option value="all">All</option>
              {(workspace?.verticals ?? []).map((vertical) => (
                <option key={vertical} value={vertical}>
                  {vertical}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select
              value={filters.priority}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  priority: event.target.value as typeof current.priority,
                }))
              }
            >
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <div className="filter-grid__actions">
            <button type="button" className="secondary-button" onClick={saveCurrentFilters}>
              <Save size={16} />
              Save view
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setFilters(defaultTaskFilters())}
            >
              <Filter size={16} />
              Reset
            </button>
          </div>
        </div>
        {savedTaskFilters.length > 0 ? (
          <div className="saved-filters">
            {savedTaskFilters.map((savedFilter) => (
              <button
                key={savedFilter.id}
                type="button"
                className="saved-filter"
                onClick={() => setFilters(savedFilter.filters)}
              >
                {savedFilter.name}
              </button>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <div className={selectedTask ? 'three-column-layout' : 'page-stack'}>
        <SectionCard
          title={taskView === 'board' ? 'Kanban board' : 'Task list'}
          subtitle={`${filteredTasks.length} tasks in the current view`}
        >
          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={SquareCheckBig}
              title="No tasks match these filters"
              description="Clear the filters or create a fresh task to get started."
            />
          ) : taskView === 'board' ? (
            <DndContext onDragEnd={(event) => void handleDragEnd(event)}>
              <div className="kanban-grid">
                {[
                  { status: 'todo' as const, tasks: grouped.todo },
                  { status: 'in_progress' as const, tasks: grouped.in_progress },
                  { status: 'review' as const, tasks: grouped.review },
                  { status: 'done' as const, tasks: grouped.done },
                ].map((column) => (
                  <DroppableColumn
                    key={column.status}
                    id={column.status}
                    title={TASK_STATUS_LABELS[column.status]}
                    count={column.tasks.length}
                  >
                    {column.tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className="task-card-button"
                        onClick={() => setSearchParams(new URLSearchParams({ task: task.id }))}
                      >
                        <TaskBoardCard
                          taskId={task.id}
                          title={task.title}
                          description={task.description}
                          vertical={task.vertical}
                          dueDate={task.dueDate}
                        />
                      </button>
                    ))}
                  </DroppableColumn>
                ))}
              </div>
            </DndContext>
          ) : (
            <div className="list-stack">
              {filteredTasks.map((task) => {
                const assignees = members.filter((member) => task.assigneeIds.includes(member.uid));
                return (
                  <button
                    key={task.id}
                    type="button"
                    className="list-row list-row--button"
                    onClick={() => setSearchParams(new URLSearchParams({ task: task.id }))}
                  >
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.description}</p>
                    </div>
                    <div className="list-row__meta">
                      <Badge tone={task.priority === 'urgent' ? 'danger' : 'info'}>
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </Badge>
                      <div className="avatar-row">
                        {assignees.map((assignee) => (
                          <Avatar key={assignee.id} member={assignee} size="sm" />
                        ))}
                      </div>
                      <small>{task.dueDate ? formatShortDate(task.dueDate) : 'No due date'}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        {selectedTask ? (
          <SectionCard title="Task detail" subtitle="Linked context and assignment">
            <div className="detail-panel">
              <div className="detail-panel__hero">
                <Badge tone={selectedTask.priority === 'urgent' ? 'danger' : 'info'}>
                  {TASK_PRIORITY_LABELS[selectedTask.priority]}
                </Badge>
                <h3>{selectedTask.title}</h3>
                <p>{selectedTask.description}</p>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Status</span>
                  <strong>{TASK_STATUS_LABELS[selectedTask.status]}</strong>
                </div>
                <div>
                  <span>Due</span>
                  <strong>{selectedTask.dueDate ? formatShortDate(selectedTask.dueDate) : 'Not set'}</strong>
                </div>
                <div>
                  <span>Project</span>
                  <strong>
                    {projects.find((project) => project.id === selectedTask.projectId)?.name ??
                      'Standalone'}
                  </strong>
                </div>
                <div>
                  <span>Client</span>
                  <strong>
                    {clients.find((client) => client.id === selectedTask.clientId)?.company ??
                      'Internal'}
                  </strong>
                </div>
              </div>
              <div className="detail-panel__members">
                {members
                  .filter((member) => selectedTask.assigneeIds.includes(member.uid))
                  .map((member) => (
                    <div key={member.id} className="member-inline">
                      <Avatar member={member} />
                      <div>
                        <strong>{member.name}</strong>
                        <small>{member.title}</small>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>

      <Modal title="Create task" open={modalOpen} onClose={() => setModalOpen(false)} width="lg">
        <form className="form-grid" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
          <label>
            <span>Task title</span>
            <input type="text" {...form.register('title')} />
          </label>
          <label>
            <span>Vertical</span>
            <select {...form.register('vertical')}>
              {(workspace?.verticals ?? []).map((vertical) => (
                <option key={vertical} value={vertical}>
                  {vertical}
                </option>
              ))}
            </select>
          </label>
          <label className="form-grid__wide">
            <span>Description</span>
            <textarea rows={4} {...form.register('description')} />
          </label>
          <label>
            <span>Status</span>
            <select {...form.register('status')}>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select {...form.register('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
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
            <span>Due date</span>
            <input type="date" {...form.register('dueDate')} />
          </label>
          <label>
            <span>Estimate hours</span>
            <input type="number" step="0.5" min="0" {...form.register('estimateHours')} />
          </label>
          <fieldset className="checkbox-fieldset form-grid__wide">
            <legend>Assignees</legend>
            <div className="checkbox-grid">
              {members.map((member) => (
                <label key={member.id} className="checkbox-card">
                  <input
                    type="checkbox"
                    value={member.uid}
                    checked={selectedAssigneeIds.includes(member.uid)}
                    onChange={(event) => {
                      const current = form.getValues('assigneeIds');
                      const next = event.target.checked
                        ? [...current, member.uid]
                        : current.filter((value) => value !== member.uid);
                      form.setValue('assigneeIds', next);
                    }}
                  />
                  <span>
                    <UserRound size={14} />
                    {member.name}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <CalendarClock size={16} />
              Create task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
