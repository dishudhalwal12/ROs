import type {
  DealStage,
  InvoiceStatus,
  ProjectStatus,
  Role,
  TaskPriority,
  TaskStatus,
} from '@/types/models';

export const APP_NAME = 'Rovexa Team OS';
export const DEFAULT_WORKSPACE_NAME = 'Rovexa HQ';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const DEFAULT_VERTICALS = [
  'Brand Strategy',
  'Performance Marketing',
  'Content Studio',
  'Web Experience',
  'Automation Ops',
];

export const ROLE_LABELS: Record<Role, string> = {
  founder: 'Founder',
  manager: 'Manager',
  member: 'Member',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal_sent: 'Proposal sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  review: 'Review',
  completed: 'Completed',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  pending: 'Pending',
  paid: 'Paid',
  overdue: 'Overdue',
};

export const SIDEBAR_NAV = [
  { to: '/', label: 'Overview' },
  { to: '/activity', label: 'Activity' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/crm', label: 'CRM' },
  { to: '/projects', label: 'Projects' },
  { to: '/messages', label: 'Messages' },
  { to: '/time', label: 'Time' },
  { to: '/billing', label: 'Billing' },
  { to: '/team', label: 'Team' },
  { to: '/settings', label: 'Settings' },
] as const;
