import {
  buildMemberPerformance,
  calculateMonthlyRevenue,
  calculateOverdueCount,
  calculateWeeklyHours,
  defaultTaskFilters,
  filterTasks,
  getEffectiveInvoiceStatus,
} from '@/lib/domain';
import type { Invoice, Member, Task, TimeEntry } from '@/types/models';

const members: Member[] = [
  {
    id: 'm1',
    uid: 'u1',
    email: 'founder@rovexa.com',
    name: 'Asha Founder',
    title: 'Founder',
    role: 'founder',
    joinedAt: '2026-04-01T10:00:00.000Z',
    avatarColor: '#2f4bde',
    focusArea: 'Leadership',
    weeklyCapacity: 40,
    status: 'active',
    notificationPreferences: {
      mentions: true,
      billing: true,
      deadlines: true,
    },
  },
];

const tasks: Task[] = [
  {
    id: 't1',
    title: 'Build dashboard',
    description: 'Create the overview shell',
    status: 'done',
    priority: 'high',
    assigneeIds: ['u1'],
    reporterId: 'u1',
    vertical: 'Web Experience',
    dueDate: '2026-04-10T10:00:00.000Z',
    createdAt: '2026-04-08T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
  },
  {
    id: 't2',
    title: 'Review billing flow',
    description: 'Check overdue invoice state',
    status: 'in_progress',
    priority: 'urgent',
    assigneeIds: ['u1'],
    reporterId: 'u1',
    vertical: 'Automation Ops',
    dueDate: '2026-04-01T10:00:00.000Z',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  },
];

const invoices: Invoice[] = [
  {
    id: 'i1',
    clientId: 'c1',
    title: 'Retainer April',
    amount: 120000,
    dueDate: '2026-04-01',
    issuedDate: '2026-04-01',
    status: 'pending',
    createdBy: 'u1',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 'i2',
    clientId: 'c2',
    title: 'Project kickoff',
    amount: 85000,
    dueDate: '2026-04-20',
    issuedDate: '2026-04-05',
    status: 'paid',
    createdBy: 'u1',
    createdAt: '2026-04-05T10:00:00.000Z',
    updatedAt: '2026-04-07T10:00:00.000Z',
  },
];

const timeEntries: TimeEntry[] = [
  {
    id: 'time1',
    memberId: 'u1',
    description: 'Overview dashboard',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationMinutes: 180,
    createdAt: new Date().toISOString(),
  },
];

describe('domain helpers', () => {
  it('computes overdue invoice status from due date', () => {
    expect(getEffectiveInvoiceStatus(invoices[0], new Date('2026-04-15'))).toBe('overdue');
    expect(getEffectiveInvoiceStatus(invoices[1], new Date('2026-04-15'))).toBe('paid');
  });

  it('filters tasks by query, status, and priority', () => {
    const filtered = filterTasks(tasks, {
      ...defaultTaskFilters(),
      query: 'billing',
      priority: 'urgent',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('t2');
  });

  it('calculates weekly hours and monthly revenue', () => {
    expect(calculateWeeklyHours(timeEntries, 'u1')).toBe(180);
    expect(calculateMonthlyRevenue(invoices, new Date('2026-04-15'))).toBe(205000);
  });

  it('builds workload metrics and overdue counts', () => {
    const performance = buildMemberPerformance(members, tasks, timeEntries);

    expect(performance[0]?.completionRate).toBe(50);
    expect(performance[0]?.overdue).toBe(1);
    expect(calculateOverdueCount(tasks, invoices, new Date('2026-04-15'))).toBe(2);
  });
});
