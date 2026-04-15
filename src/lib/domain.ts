import { endOfMonth, isBefore, isToday, parseISO, startOfMonth } from 'date-fns';

import type {
  Client,
  Invoice,
  InvoiceStatus,
  Member,
  SavedTaskFilter,
  SearchItem,
  Task,
  TaskFilterState,
  TimeEntry,
  WorkspaceCollections,
} from '@/types/models';
import { isWithinCurrentWeek } from '@/lib/format';

export function getEffectiveInvoiceStatus(
  invoice: Invoice,
  today = new Date(),
): InvoiceStatus {
  if (invoice.status === 'paid') return 'paid';
  const due = parseISO(invoice.dueDate);
  return isBefore(due, today) && !isToday(due) ? 'overdue' : invoice.status;
}

export function groupTasksByStatus(tasks: Task[]) {
  return {
    todo: tasks.filter((task) => task.status === 'todo'),
    in_progress: tasks.filter((task) => task.status === 'in_progress'),
    review: tasks.filter((task) => task.status === 'review'),
    done: tasks.filter((task) => task.status === 'done'),
  };
}

export function filterTasks(tasks: Task[], filters: TaskFilterState) {
  return tasks.filter((task) => {
    const matchesQuery =
      filters.query.length === 0 ||
      task.title.toLowerCase().includes(filters.query.toLowerCase()) ||
      task.description.toLowerCase().includes(filters.query.toLowerCase());

    const matchesStatus = filters.status === 'all' || task.status === filters.status;
    const matchesAssignee =
      filters.assigneeId === 'all' || task.assigneeIds.includes(filters.assigneeId);
    const matchesVertical =
      filters.vertical === 'all' || task.vertical === filters.vertical;
    const matchesPriority =
      filters.priority === 'all' || task.priority === filters.priority;

    return (
      matchesQuery &&
      matchesStatus &&
      matchesAssignee &&
      matchesVertical &&
      matchesPriority
    );
  });
}

export function calculateWeeklyHours(entries: TimeEntry[], memberId?: string) {
  return entries
    .filter((entry) => (!memberId ? true : entry.memberId === memberId))
    .filter((entry) => (entry.mode ?? 'work') === 'work')
    .filter((entry) => isWithinCurrentWeek(entry.startedAt))
    .reduce((sum, entry) => sum + entry.durationMinutes, 0);
}

export function calculateMyOpenTasks(tasks: Task[], userId: string) {
  return tasks.filter(
    (task) => task.assigneeIds.includes(userId) && task.status !== 'done',
  ).length;
}

export function calculateMonthlyRevenue(invoices: Invoice[], today = new Date()) {
  const start = startOfMonth(today);
  const end = endOfMonth(today);

  return invoices
    .filter((invoice) => {
      const issued = parseISO(invoice.issuedDate);
      return issued >= start && issued <= end;
    })
    .filter((invoice) => getEffectiveInvoiceStatus(invoice, today) !== 'draft')
    .reduce((sum, invoice) => sum + invoice.amount, 0);
}

export function calculateOverdueCount(tasks: Task[], invoices: Invoice[], today = new Date()) {
  const overdueTasks = tasks.filter(
    (task) =>
      task.dueDate &&
      task.status !== 'done' &&
      isBefore(parseISO(task.dueDate), today) &&
      !isToday(parseISO(task.dueDate)),
  ).length;
  const overdueInvoices = invoices.filter(
    (invoice) => getEffectiveInvoiceStatus(invoice, today) === 'overdue',
  ).length;
  return overdueTasks + overdueInvoices;
}

export function buildSearchItems(
  collections: Pick<WorkspaceCollections, 'members' | 'clients' | 'projects' | 'tasks'>,
): SearchItem[] {
  const memberItems = collections.members.map((member) => ({
    id: member.id,
    type: 'member' as const,
    title: member.name,
    subtitle: `${member.role} · ${member.title}`,
    route: '/team',
  }));

  const clientItems = collections.clients.map((client) => ({
    id: client.id,
    type: 'client' as const,
    title: client.company,
    subtitle: `${client.contactName} · ${client.stage}`,
    route: `/crm?client=${client.id}`,
  }));

  const projectItems = collections.projects.map((project) => ({
    id: project.id,
    type: 'project' as const,
    title: project.name,
    subtitle: `${project.vertical} · ${project.status}`,
    route: `/projects?project=${project.id}`,
  }));

  const taskItems = collections.tasks.map((task) => ({
    id: task.id,
    type: 'task' as const,
    title: task.title,
    subtitle: `${task.vertical} · ${task.status}`,
    route: `/tasks?task=${task.id}`,
  }));

  return [...taskItems, ...clientItems, ...projectItems, ...memberItems];
}

export function buildMemberPerformance(
  members: Member[],
  tasks: Task[],
  timeEntries: TimeEntry[],
) {
  return members.map((member) => {
    const memberTasks = tasks.filter((task) => task.assigneeIds.includes(member.uid));
    const completed = memberTasks.filter((task) => task.status === 'done').length;
    const active = memberTasks.filter((task) => task.status !== 'done').length;
    const overdue = memberTasks.filter(
      (task) =>
        task.dueDate &&
        task.status !== 'done' &&
        parseISO(task.dueDate) < new Date() &&
        !isToday(parseISO(task.dueDate)),
    ).length;
    const completionRate =
      memberTasks.length === 0 ? 0 : Math.round((completed / memberTasks.length) * 100);

    return {
      member,
      completed,
      active,
      overdue,
      completionRate,
      weeklyMinutes: calculateWeeklyHours(timeEntries, member.uid),
    };
  });
}

export function defaultTaskFilters(): TaskFilterState {
  return {
    query: '',
    status: 'all',
    assigneeId: 'all',
    vertical: 'all',
    priority: 'all',
  };
}

export function upsertSavedFilter(
  savedFilters: SavedTaskFilter[],
  nextFilter: SavedTaskFilter,
) {
  const existingIndex = savedFilters.findIndex((item) => item.id === nextFilter.id);
  if (existingIndex === -1) return [...savedFilters, nextFilter];
  return savedFilters.map((item) => (item.id === nextFilter.id ? nextFilter : item));
}

export function findRelatedClient(clients: Client[], clientId?: string) {
  return clients.find((client) => client.id === clientId) ?? null;
}
