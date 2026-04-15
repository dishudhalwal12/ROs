import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const bootstrapSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  workspaceName: z.string().min(2),
});

export const inviteAcceptSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  token: z.string().min(8),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['founder', 'manager', 'member']),
});

export const clientSchema = z.object({
  name: z.string().min(2),
  company: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  stage: z.enum([
    'lead',
    'qualified',
    'proposal_sent',
    'negotiation',
    'won',
    'lost',
  ]),
  value: z.coerce.number().min(0),
  nextFollowUpAt: z.string().optional(),
  tags: z.string().min(2),
  summary: z.string().min(4),
});

export const projectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(2),
  summary: z.string().min(4),
  vertical: z.string().min(2),
  memberIds: z.array(z.string()).min(1),
  status: z.enum(['planning', 'active', 'review', 'completed']),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
});

export const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(4),
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigneeIds: z.array(z.string()).min(1),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  vertical: z.string().min(2),
  dueDate: z.string().optional(),
  estimateHours: z.coerce.number().min(0).optional(),
});

export const noteSchema = z.object({
  entityType: z.enum(['client', 'project']),
  entityId: z.string().min(1),
  title: z.string().min(2),
  content: z.string().min(2),
  visibility: z.enum(['team', 'leadership', 'private']),
  category: z.enum(['note', 'proposal', 'document']),
});

export const meetingSchema = z.object({
  entityType: z.enum(['client', 'project']),
  entityId: z.string().min(1),
  title: z.string().min(2),
  summary: z.string().min(2),
  actionItems: z.string().min(2),
  scheduledFor: z.string().min(1),
  attendees: z.array(z.string()).min(1),
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional(),
  title: z.string().min(2),
  amount: z.coerce.number().min(0),
  issuedDate: z.string().min(1),
  dueDate: z.string().min(1),
  status: z.enum(['draft', 'sent', 'pending', 'paid', 'overdue']),
});

export const timeEntrySchema = z.object({
  description: z.string().min(2),
  taskId: z.string().optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  durationMinutes: z.coerce.number().min(1),
});

export const workspaceSchema = z.object({
  name: z.string().min(2),
  verticals: z.string().min(2),
});
