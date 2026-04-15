export type ThemeMode = 'light' | 'dark';
export type WorkMode = 'work' | 'rest';

export type Role = 'founder' | 'manager' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DealStage =
  | 'lead'
  | 'qualified'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';
export type InvoiceStatus = 'draft' | 'sent' | 'pending' | 'paid' | 'overdue';
export type ChannelType = 'team' | 'project' | 'direct';
export type NoteVisibility = 'team' | 'leadership' | 'private';
export type NoteCategory = 'note' | 'proposal' | 'document';
export type ProjectStatus = 'planning' | 'active' | 'review' | 'completed';

export interface Workspace {
  id: string;
  name: string;
  brandName: string;
  timezone: string;
  founderId: string;
  createdAt: string;
  updatedAt: string;
  defaultTheme: ThemeMode;
  verticals: string[];
  notificationDefaults: {
    emailDigests: boolean;
    mentionAlerts: boolean;
    dueDateAlerts: boolean;
  };
}

export interface Member {
  id: string;
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string;
  currentStatus?: LiveStatusRecord | null;
  title: string;
  role: Role;
  joinedAt: string;
  avatarColor: string;
  focusArea: string;
  weeklyCapacity: number;
  status: 'active' | 'invited';
  notificationPreferences: {
    mentions: boolean;
    billing: boolean;
    deadlines: boolean;
  };
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  token: string;
  invitedBy: string;
  createdAt: string;
  acceptedAt?: string;
  status: 'pending' | 'accepted' | 'revoked';
}

export interface Client {
  id: string;
  name: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  ownerId: string;
  stage: DealStage;
  value: number;
  nextFollowUpAt?: string;
  tags: string[];
  summary: string;
  activeProjectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  summary: string;
  vertical: string;
  ownerId: string;
  memberIds: string[];
  status: ProjectStatus;
  progress: number;
  startDate?: string;
  dueDate?: string;
  budget?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  reporterId: string;
  clientId?: string;
  projectId?: string;
  vertical: string;
  dueDate?: string;
  estimateHours?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteAttachment {
  name: string;
  path: string;
  url: string;
  size: number;
  contentType: string;
}

export interface NoteRecord {
  id: string;
  entityType: 'client' | 'project';
  entityId: string;
  category: NoteCategory;
  title: string;
  content: string;
  visibility: NoteVisibility;
  createdBy: string;
  createdAt: string;
  attachments: NoteAttachment[];
}

export interface MeetingRecord {
  id: string;
  entityType: 'client' | 'project';
  entityId: string;
  title: string;
  summary: string;
  actionItems: string;
  scheduledFor: string;
  attendees: string[];
  createdBy: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  memberId: string;
  mode?: WorkMode;
  source?: 'manual' | 'tracker';
  taskId?: string;
  projectId?: string;
  clientId?: string;
  description: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  projectId?: string;
  title: string;
  amount: number;
  dueDate: string;
  issuedDate: string;
  status: InvoiceStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string | 'all';
  title: string;
  body: string;
  kind: 'mention' | 'deadline' | 'billing' | 'system' | 'invite' | 'message';
  readBy: string[];
  actionRoute?: string;
  actorId?: string;
  channelId?: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  actorId: string;
  actorName: string;
  type:
    | 'workspace_bootstrap'
    | 'invite_created'
    | 'client_created'
    | 'project_created'
    | 'task_created'
    | 'task_updated'
    | 'invoice_created'
    | 'note_added'
    | 'meeting_logged'
    | 'time_logged'
    | 'file_uploaded';
  title: string;
  body: string;
  entityType?: 'client' | 'project' | 'task' | 'invoice' | 'member';
  entityId?: string;
  priority: 'normal' | 'high';
  createdAt: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  type: ChannelType;
  workspaceId: string;
  projectId?: string;
  participantIds: string[];
  createdBy: string;
  createdAt: string;
  lastMessage?: {
    body: string;
    createdAt: string;
    senderId: string;
  };
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface PresenceRecord {
  uid: string;
  name: string;
  state: 'online' | 'offline';
  lastSeenAt: string;
}

export interface LiveStatusRecord {
  memberId: string;
  mode: WorkMode;
  label: string;
  startedAt: string;
  updatedAt: string;
}

export interface StatusSession {
  id: string;
  memberId: string;
  mode: WorkMode;
  label: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  createdAt: string;
}

export interface SearchItem {
  id: string;
  type: 'task' | 'client' | 'project' | 'member';
  title: string;
  subtitle: string;
  route: string;
}

export interface TaskFilterState {
  query: string;
  status: 'all' | TaskStatus;
  assigneeId: 'all' | string;
  vertical: 'all' | string;
  priority: 'all' | TaskPriority;
}

export interface SavedTaskFilter {
  id: string;
  name: string;
  filters: TaskFilterState;
}

export interface WorkspaceCollections {
  workspace: Workspace | null;
  members: Member[];
  invites: Invite[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  notes: NoteRecord[];
  meetings: MeetingRecord[];
  timeEntries: TimeEntry[];
  statusSessions: StatusSession[];
  invoices: Invoice[];
  notifications: AppNotification[];
  activity: ActivityItem[];
}
