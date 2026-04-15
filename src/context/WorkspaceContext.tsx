import {
  createContext,
  type PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import {
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';

import { useAuth } from '@/hooks/use-auth';
import { db, isRealtimeConfigured, realtimeDb, storage } from '@/lib/firebase';
import {
  hasEveryoneMention,
  shouldBroadcastChannelMessage,
} from '@/lib/chat-notifications';
import { buildSearchItems } from '@/lib/domain';
import { nowIso, uniqueStrings } from '@/lib/utils';
import type {
  ActivityItem,
  AppNotification,
  ChatChannel,
  ChatMessage,
  Client,
  Invite,
  MeetingRecord,
  Member,
  NoteAttachment,
  NoteCategory,
  NoteRecord,
  PresenceRecord,
  Project,
  Role,
  SearchItem,
  Task,
  TaskStatus,
  TimeEntry,
  Invoice,
  Workspace,
  WorkspaceCollections,
} from '@/types/models';

interface CreateClientPayload {
  name: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  stage: Client['stage'];
  value: number;
  nextFollowUpAt?: string;
  tags: string[];
  summary: string;
}

interface CreateProjectPayload {
  clientId: string;
  name: string;
  summary: string;
  vertical: string;
  memberIds: string[];
  status: Project['status'];
  startDate?: string;
  dueDate?: string;
  budget?: number;
}

interface CreateTaskPayload {
  title: string;
  description: string;
  status: Task['status'];
  priority: Task['priority'];
  assigneeIds: string[];
  clientId?: string;
  projectId?: string;
  vertical: string;
  dueDate?: string;
  estimateHours?: number;
}

interface CreateNotePayload {
  entityType: NoteRecord['entityType'];
  entityId: string;
  title: string;
  content: string;
  visibility: NoteRecord['visibility'];
  category: NoteCategory;
  attachments?: NoteAttachment[];
}

interface CreateMeetingPayload {
  entityType: MeetingRecord['entityType'];
  entityId: string;
  title: string;
  summary: string;
  actionItems: string;
  scheduledFor: string;
  attendees: string[];
}

interface CreateTimeEntryPayload {
  description: string;
  taskId?: string;
  projectId?: string;
  clientId?: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

interface CreateInvoicePayload {
  clientId: string;
  projectId?: string;
  title: string;
  amount: number;
  issuedDate: string;
  dueDate: string;
  status: Invoice['status'];
}

interface UploadAttachmentPayload {
  entityType: 'client' | 'project';
  entityId: string;
  category: NoteCategory;
  file: File;
}

interface UpdateWorkspacePayload {
  name: string;
  verticals: string[];
  defaultTheme: Workspace['defaultTheme'];
}

interface WorkspaceContextValue extends WorkspaceCollections {
  loading: boolean;
  searchItems: SearchItem[];
  channels: ChatChannel[];
  unreadByChannel: Record<string, number>;
  presence: Record<string, PresenceRecord>;
  typingByChannel: Record<string, string[]>;
  realtimeEnabled: boolean;
  createInvite: (email: string, role: Role) => Promise<Invite>;
  revokeInvite: (inviteId: string) => Promise<void>;
  createClient: (payload: CreateClientPayload) => Promise<Client>;
  updateClientStage: (clientId: string, stage: Client['stage']) => Promise<void>;
  convertClientToProject: (clientId: string) => Promise<void>;
  createProject: (payload: CreateProjectPayload) => Promise<Project>;
  createTask: (payload: CreateTaskPayload) => Promise<Task>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  createNote: (payload: CreateNotePayload) => Promise<NoteRecord>;
  createMeeting: (payload: CreateMeetingPayload) => Promise<MeetingRecord>;
  createTimeEntry: (payload: CreateTimeEntryPayload) => Promise<TimeEntry>;
  createInvoice: (payload: CreateInvoicePayload) => Promise<Invoice>;
  updateInvoiceStatus: (invoiceId: string, status: Invoice['status']) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  updateWorkspaceProfile: (payload: UpdateWorkspacePayload) => Promise<void>;
  updateWorkspaceNotifications: (
    input: Workspace['notificationDefaults'],
  ) => Promise<void>;
  updateMemberRole: (memberId: string, role: Role) => Promise<void>;
  updateMyNotificationPreferences: (
    input: Member['notificationPreferences'],
  ) => Promise<void>;
  uploadAttachment: (payload: UploadAttachmentPayload) => Promise<NoteAttachment>;
  createDirectChannel: (targetMemberId: string) => Promise<string>;
  createTeamChannel: (name: string) => Promise<string>;
  subscribeToMessages: (
    channelId: string,
    callback: (messages: ChatMessage[]) => void,
  ) => () => void;
  sendMessage: (channelId: string, body: string) => Promise<void>;
  markChannelRead: (channelId: string) => Promise<void>;
  setTypingState: (channelId: string, active: boolean) => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const emptyCollections: WorkspaceCollections = {
  workspace: null,
  members: [],
  invites: [],
  clients: [],
  projects: [],
  tasks: [],
  notes: [],
  meetings: [],
  timeEntries: [],
  invoices: [],
  notifications: [],
  activity: [],
};

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { member, user, workspaceId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<WorkspaceCollections>(emptyCollections);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceRecord>>({});
  const [typingByChannel, setTypingByChannel] = useState<Record<string, string[]>>({});
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!workspaceId) {
      setCollections(emptyCollections);
      setChannels([]);
      setPresence({});
      setTypingByChannel({});
      setUnreadByChannel({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribers = [
      onSnapshot(doc(db, 'workspaces', workspaceId), (snapshot) => {
        setCollections((current) => ({
          ...current,
          workspace: snapshot.exists()
            ? ({ id: snapshot.id, ...(snapshot.data() as Omit<Workspace, 'id'>) } as Workspace)
            : null,
        }));
      }),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'members'), orderBy('joinedAt', 'asc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            members: snapshot.docs.map(
              (memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() }) as Member,
            ),
          }));
        },
      ),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'invites'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            invites: snapshot.docs.map(
              (inviteDoc) => ({ id: inviteDoc.id, ...inviteDoc.data() }) as Invite,
            ),
          }));
        },
      ),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'clients'), orderBy('updatedAt', 'desc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            clients: snapshot.docs.map(
              (clientDoc) => ({ id: clientDoc.id, ...clientDoc.data() }) as Client,
            ),
          }));
        },
      ),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'projects'), orderBy('updatedAt', 'desc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            projects: snapshot.docs.map(
              (projectDoc) => ({ id: projectDoc.id, ...projectDoc.data() }) as Project,
            ),
          }));
        },
      ),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'tasks'), orderBy('updatedAt', 'desc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            tasks: snapshot.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }) as Task),
          }));
        },
      ),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'notes'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            notes: snapshot.docs.map(
              (noteDoc) => ({ id: noteDoc.id, ...noteDoc.data() }) as NoteRecord,
            ),
          }));
        },
      ),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'meetings'), orderBy('scheduledFor', 'desc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            meetings: snapshot.docs.map(
              (meetingDoc) =>
                ({ id: meetingDoc.id, ...meetingDoc.data() }) as MeetingRecord,
            ),
          }));
        },
      ),
      onSnapshot(
        query(
          collection(db, 'workspaces', workspaceId, 'timeEntries'),
          orderBy('startedAt', 'desc'),
        ),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            timeEntries: snapshot.docs.map(
              (timeDoc) => ({ id: timeDoc.id, ...timeDoc.data() }) as TimeEntry,
            ),
          }));
        },
      ),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'invoices'), orderBy('updatedAt', 'desc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            invoices: snapshot.docs.map(
              (invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() }) as Invoice,
            ),
          }));
        },
      ),
      onSnapshot(
        query(
          collection(db, 'workspaces', workspaceId, 'notifications'),
          orderBy('createdAt', 'desc'),
        ),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            notifications: snapshot.docs
              .map(
                (notificationDoc) =>
                  ({ id: notificationDoc.id, ...notificationDoc.data() }) as AppNotification,
              )
              .filter(
                (notification) =>
                  notification.userId === 'all' || notification.userId === user?.uid,
              ),
          }));
        },
      ),
      onSnapshot(
        query(collection(db, 'workspaces', workspaceId, 'activity'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setCollections((current) => ({
            ...current,
            activity: snapshot.docs.map(
              (activityDoc) => ({ id: activityDoc.id, ...activityDoc.data() }) as ActivityItem,
            ),
          }));
          setLoading(false);
        },
      ),
    ];

    if (isRealtimeConfigured && realtimeDb) {
      unsubscribers.push(
        onValue(ref(realtimeDb, `workspaces/${workspaceId}/channels`), (snapshot) => {
          const raw = snapshot.val() ?? {};
          const nextChannels = Object.values(raw) as ChatChannel[];
          nextChannels.sort((left, right) => {
            const leftAt = left.lastMessage?.createdAt ?? left.createdAt;
            const rightAt = right.lastMessage?.createdAt ?? right.createdAt;
            return rightAt.localeCompare(leftAt);
          });
          setChannels(nextChannels);
        }),
      );

      unsubscribers.push(
        onValue(ref(realtimeDb, `workspaces/${workspaceId}/presence`), (snapshot) => {
          const raw = snapshot.val() ?? {};
          const nextPresence = Object.fromEntries(
            Object.entries(raw).map(([uid, value]) => {
              const record = value as { name: string; state: string; lastSeenAt?: number };
              return [
                uid,
                {
                  uid,
                  name: record.name,
                  state: record.state === 'online' ? 'online' : 'offline',
                  lastSeenAt: record.lastSeenAt
                    ? new Date(record.lastSeenAt).toISOString()
                    : nowIso(),
                },
              ];
            }),
          ) as Record<string, PresenceRecord>;
          setPresence(nextPresence);
        }),
      );

      if (user) {
        unsubscribers.push(
          onValue(ref(realtimeDb, `workspaces/${workspaceId}/typing`), (snapshot) => {
            const raw = snapshot.val() ?? {};
            const nextTyping = Object.fromEntries(
              Object.entries(raw).map(([channelId, state]) => [
                channelId,
                Object.entries((state as Record<string, boolean>) ?? {})
                  .filter(([, active]) => Boolean(active))
                  .map(([uid]) => uid)
                  .filter((uid) => uid !== user.uid),
              ]),
            ) as Record<string, string[]>;
            setTypingByChannel(nextTyping);
          }),
        );

        unsubscribers.push(
          onValue(ref(realtimeDb, `workspaces/${workspaceId}/unread/${user.uid}`), (snapshot) => {
            setUnreadByChannel((snapshot.val() ?? {}) as Record<string, number>);
          }),
        );
      }
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !user || !member || !isRealtimeConfigured || !realtimeDb) return;

    const presenceRef = ref(realtimeDb, `workspaces/${workspaceId}/presence/${user.uid}`);
    const onlineState = {
      uid: user.uid,
      name: member.name,
      state: 'online',
      lastSeenAt: serverTimestamp(),
    };
    const offlineState = {
      uid: user.uid,
      name: member.name,
      state: 'offline',
      lastSeenAt: serverTimestamp(),
    };

    void set(presenceRef, onlineState);
    void onDisconnect(presenceRef).set(offlineState);

    const heartbeat = window.setInterval(() => {
      void update(presenceRef, { lastSeenAt: serverTimestamp() });
    }, 30000);

    return () => {
      window.clearInterval(heartbeat);
      void set(presenceRef, offlineState);
    };
  }, [member, user, workspaceId]);

  const searchItems = useMemo(
    () => buildSearchItems(collections),
    [collections.clients, collections.members, collections.projects, collections.tasks],
  );

  async function logActivity(input: Omit<ActivityItem, 'id'>) {
    if (!workspaceId) throw new Error('Workspace unavailable.');
    await addDoc(collection(db, 'workspaces', workspaceId, 'activity'), input);
  }

  async function pushNotification(input: Omit<AppNotification, 'id'>) {
    if (!workspaceId) throw new Error('Workspace unavailable.');
    await addDoc(collection(db, 'workspaces', workspaceId, 'notifications'), input);
  }

  function getEntityRoute(entityType?: ActivityItem['entityType'], entityId?: string) {
    if (!entityType || !entityId) return undefined;

    switch (entityType) {
      case 'client':
        return `/crm?client=${entityId}`;
      case 'project':
        return `/projects?project=${entityId}`;
      case 'task':
        return `/tasks?task=${entityId}`;
      case 'invoice':
        return `/billing?invoice=${entityId}`;
      default:
        return '/activity';
    }
  }

  async function pushWorkspaceWideNotification(input: {
    title: string;
    body: string;
    kind: AppNotification['kind'];
    createdAt: string;
    actionRoute?: string;
    actorId?: string;
    channelId?: string;
  }) {
    await pushNotification({
      userId: 'all',
      title: input.title,
      body: input.body,
      kind: input.kind,
      readBy: input.actorId ? [input.actorId] : [],
      actionRoute: input.actionRoute,
      actorId: input.actorId,
      channelId: input.channelId,
      createdAt: input.createdAt,
    });
  }

  async function pushPersonalNotifications(input: {
    userIds: string[];
    title: string;
    body: string;
    kind: AppNotification['kind'];
    createdAt: string;
    actionRoute?: string;
    actorId?: string;
    channelId?: string;
  }) {
    const targetUserIds = uniqueStrings(input.userIds).filter((userId) => userId !== input.actorId);
    if (targetUserIds.length === 0) return;

    await Promise.all(
      targetUserIds.map((userId) =>
        pushNotification({
          userId,
          title: input.title,
          body: input.body,
          kind: input.kind,
          readBy: [],
          actionRoute: input.actionRoute,
          actorId: input.actorId,
          channelId: input.channelId,
          createdAt: input.createdAt,
        }),
      ),
    );
  }

  async function ensureProjectChannel(project: Project) {
    if (!workspaceId || !user || !isRealtimeConfigured || !realtimeDb) return;
    const channelId = `project_${project.id}`;
    const channelRef = ref(realtimeDb, `workspaces/${workspaceId}/channels/${channelId}`);
    const existing = await get(channelRef);
    if (existing.exists()) return;

    await set(channelRef, {
      id: channelId,
      name: project.name,
      type: 'project',
      workspaceId,
      projectId: project.id,
      participantIds: uniqueStrings([...project.memberIds, project.ownerId]),
      createdBy: user.uid,
      createdAt: nowIso(),
    } satisfies ChatChannel);
  }

  async function createInvite(email: string, role: Role) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const createdAt = nowIso();
    const inviteDoc = await addDoc(collection(db, 'workspaces', workspaceId, 'invites'), {
      email: email.trim().toLowerCase(),
      role,
      token: crypto.randomUUID(),
      invitedBy: user.uid,
      createdAt,
      status: 'pending',
    } satisfies Omit<Invite, 'id'>);

    const invite = {
      id: inviteDoc.id,
      email: email.trim().toLowerCase(),
      role,
      token: '',
      invitedBy: user.uid,
      createdAt,
      status: 'pending',
    } as Invite;

      const inviteSnapshot = await getDoc(inviteDoc);
      invite.token = (inviteSnapshot.data() as Omit<Invite, 'id'>).token;

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'invite_created',
      title: 'Invite created',
      body: `${email} invited as ${role}.`,
      entityType: 'member',
      priority: 'normal',
      createdAt,
    });

    await pushNotification({
      userId: 'all',
      title: 'Invite ready',
      body: `${email} can now join the workspace.`,
      kind: 'invite',
      readBy: [user.uid],
      actionRoute: '/settings',
      actorId: user.uid,
      createdAt,
    });

    return invite;
  }

  async function revokeInvite(inviteId: string) {
    if (!workspaceId) throw new Error('Workspace unavailable.');
    await updateDoc(doc(db, 'workspaces', workspaceId, 'invites', inviteId), {
      status: 'revoked',
    });
  }

  async function createClient(payload: CreateClientPayload) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const createdAt = nowIso();
    const clientDoc = await addDoc(collection(db, 'workspaces', workspaceId, 'clients'), {
      ...payload,
      ownerId: user.uid,
      tags: uniqueStrings(payload.tags),
      createdAt,
      updatedAt: createdAt,
    } satisfies Omit<Client, 'id'>);

    const client = {
      id: clientDoc.id,
      ...payload,
      ownerId: user.uid,
      tags: uniqueStrings(payload.tags),
      createdAt,
      updatedAt: createdAt,
    } as Client;

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'client_created',
      title: 'Client added',
      body: `${payload.company} entered the pipeline.`,
      entityType: 'client',
      entityId: clientDoc.id,
      priority: 'normal',
      createdAt,
    });

    await pushWorkspaceWideNotification({
      title: 'New CRM lead added',
      body: `${payload.company} entered the pipeline.`,
      kind: 'system',
      actionRoute: `/crm?client=${client.id}`,
      actorId: user.uid,
      createdAt,
    });

    return client;
  }

  async function updateClientStage(clientId: string, stage: Client['stage']) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const updatedAt = nowIso();
    await updateDoc(doc(db, 'workspaces', workspaceId, 'clients', clientId), {
      stage,
      updatedAt,
    });

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'task_updated',
      title: 'CRM stage updated',
      body: `Client moved to ${stage.replace('_', ' ')}.`,
      entityType: 'client',
      entityId: clientId,
      priority: stage === 'won' ? 'high' : 'normal',
      createdAt: updatedAt,
    });

    await pushWorkspaceWideNotification({
      title: 'CRM stage updated',
      body: `Client moved to ${stage.replace('_', ' ')}.`,
      kind: 'system',
      actionRoute: `/crm?client=${clientId}`,
      actorId: user.uid,
      createdAt: updatedAt,
    });
  }

  async function createProject(payload: CreateProjectPayload) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const createdAt = nowIso();
    const projectDoc = await addDoc(collection(db, 'workspaces', workspaceId, 'projects'), {
      ...payload,
      ownerId: user.uid,
      progress: 0,
      createdAt,
      updatedAt: createdAt,
    } satisfies Omit<Project, 'id'>);

    const project = {
      id: projectDoc.id,
      ...payload,
      ownerId: user.uid,
      progress: 0,
      createdAt,
      updatedAt: createdAt,
    } as Project;

    await ensureProjectChannel(project);
    await updateDoc(doc(db, 'workspaces', workspaceId, 'clients', payload.clientId), {
      activeProjectId: project.id,
      stage: 'won',
      updatedAt: createdAt,
    });

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'project_created',
      title: 'Project created',
      body: `${payload.name} is now active.`,
      entityType: 'project',
      entityId: project.id,
      priority: 'high',
      createdAt,
    });

    await pushNotification({
      userId: 'all',
      title: 'New project live',
      body: `${payload.name} is ready for execution.`,
      kind: 'system',
      readBy: [user.uid],
      actionRoute: `/projects?project=${project.id}`,
      actorId: user.uid,
      createdAt,
    });

    return project;
  }

  async function convertClientToProject(clientId: string) {
    const client = collections.clients.find((entry) => entry.id === clientId);
    if (!client) throw new Error('Client not found.');

    await createProject({
      clientId: client.id,
      name: `${client.company} Launch`,
      summary: client.summary,
      vertical: client.tags[0] ?? collections.workspace?.verticals[0] ?? 'Operations',
      memberIds: member ? [member.uid] : [],
      status: 'active',
      budget: client.value,
    });
  }

  async function createTask(payload: CreateTaskPayload) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const createdAt = nowIso();
    const taskDoc = await addDoc(collection(db, 'workspaces', workspaceId, 'tasks'), {
      ...payload,
      reporterId: user.uid,
      createdAt,
      updatedAt: createdAt,
    } satisfies Omit<Task, 'id'>);

    const task = {
      id: taskDoc.id,
      ...payload,
      reporterId: user.uid,
      createdAt,
      updatedAt: createdAt,
    } as Task;

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'task_created',
      title: 'Task created',
      body: payload.title,
      entityType: 'task',
      entityId: task.id,
      priority: payload.priority === 'urgent' ? 'high' : 'normal',
      createdAt,
    });

    await pushWorkspaceWideNotification({
      title: 'New task created',
      body: payload.title,
      kind: 'deadline',
      actionRoute: `/tasks?task=${task.id}`,
      actorId: user.uid,
      createdAt,
    });

    return task;
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const updatedAt = nowIso();
    await updateDoc(doc(db, 'workspaces', workspaceId, 'tasks', taskId), {
      status,
      updatedAt,
    });

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'task_updated',
      title: 'Task moved',
      body: `Task moved to ${status.replace('_', ' ')}.`,
      entityType: 'task',
      entityId: taskId,
      priority: status === 'review' ? 'high' : 'normal',
      createdAt: updatedAt,
    });

    await pushWorkspaceWideNotification({
      title: 'Task status changed',
      body: `Task moved to ${status.replace('_', ' ')}.`,
      kind: 'deadline',
      actionRoute: `/tasks?task=${taskId}`,
      actorId: user.uid,
      createdAt: updatedAt,
    });
  }

  async function createNote(payload: CreateNotePayload) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const createdAt = nowIso();
    const noteDoc = await addDoc(collection(db, 'workspaces', workspaceId, 'notes'), {
      ...payload,
      createdBy: user.uid,
      createdAt,
      attachments: payload.attachments ?? [],
    } satisfies Omit<NoteRecord, 'id'>);

    const note = {
      id: noteDoc.id,
      ...payload,
      attachments: payload.attachments ?? [],
      createdBy: user.uid,
      createdAt,
    } as NoteRecord;

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: payload.category === 'document' ? 'file_uploaded' : 'note_added',
      title:
        payload.category === 'proposal'
          ? 'Proposal updated'
          : payload.category === 'document'
            ? 'Document uploaded'
            : 'Note added',
      body: payload.title,
      entityType: payload.entityType,
      entityId: payload.entityId,
      priority: 'normal',
      createdAt,
    });

    await pushWorkspaceWideNotification({
      title:
        payload.category === 'proposal'
          ? 'Proposal updated'
          : payload.category === 'document'
            ? 'Document uploaded'
            : 'Note added',
      body: payload.title,
      kind: 'system',
      actionRoute: getEntityRoute(payload.entityType, payload.entityId),
      actorId: user.uid,
      createdAt,
    });

    return note;
  }

  async function createMeeting(payload: CreateMeetingPayload) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const createdAt = nowIso();
    const meetingDoc = await addDoc(collection(db, 'workspaces', workspaceId, 'meetings'), {
      ...payload,
      createdBy: user.uid,
      createdAt,
    } satisfies Omit<MeetingRecord, 'id'>);

    const meeting = {
      id: meetingDoc.id,
      ...payload,
      createdBy: user.uid,
      createdAt,
    } as MeetingRecord;

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'meeting_logged',
      title: 'Meeting logged',
      body: payload.title,
      entityType: payload.entityType,
      entityId: payload.entityId,
      priority: 'normal',
      createdAt,
    });

    await pushWorkspaceWideNotification({
      title: 'Meeting logged',
      body: payload.title,
      kind: 'system',
      actionRoute: getEntityRoute(payload.entityType, payload.entityId),
      actorId: user.uid,
      createdAt,
    });

    return meeting;
  }

  async function createTimeEntry(payload: CreateTimeEntryPayload) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const createdAt = nowIso();
    const timeDoc = await addDoc(collection(db, 'workspaces', workspaceId, 'timeEntries'), {
      ...payload,
      memberId: user.uid,
      createdAt,
    } satisfies Omit<TimeEntry, 'id'>);

    const timeEntry = {
      id: timeDoc.id,
      ...payload,
      memberId: user.uid,
      createdAt,
    } as TimeEntry;

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'time_logged',
      title: 'Time logged',
      body: payload.description,
      entityType: payload.projectId ? 'project' : 'task',
      entityId: payload.projectId ?? payload.taskId,
      priority: 'normal',
      createdAt,
    });

    await pushWorkspaceWideNotification({
      title: 'Time logged',
      body: payload.description,
      kind: 'system',
      actionRoute: payload.projectId
        ? `/projects?project=${payload.projectId}`
        : payload.taskId
          ? `/tasks?task=${payload.taskId}`
          : '/time',
      actorId: user.uid,
      createdAt,
    });

    return timeEntry;
  }

  async function createInvoice(payload: CreateInvoicePayload) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    const createdAt = nowIso();
    const invoiceDoc = await addDoc(collection(db, 'workspaces', workspaceId, 'invoices'), {
      ...payload,
      createdBy: user.uid,
      createdAt,
      updatedAt: createdAt,
    } satisfies Omit<Invoice, 'id'>);

    const invoice = {
      id: invoiceDoc.id,
      ...payload,
      createdBy: user.uid,
      createdAt,
      updatedAt: createdAt,
    } as Invoice;

    await logActivity({
      actorId: user.uid,
      actorName: member?.name ?? user.email ?? 'Workspace',
      type: 'invoice_created',
      title: 'Invoice created',
      body: payload.title,
      entityType: 'invoice',
      entityId: invoice.id,
      priority: 'normal',
      createdAt,
    });

    await pushWorkspaceWideNotification({
      title: 'Invoice created',
      body: payload.title,
      kind: 'billing',
      actionRoute: `/billing?invoice=${invoice.id}`,
      actorId: user.uid,
      createdAt,
    });

    return invoice;
  }

  async function updateInvoiceStatus(invoiceId: string, status: Invoice['status']) {
    if (!workspaceId) throw new Error('Workspace unavailable.');
    const updatedAt = nowIso();
    const invoice = collections.invoices.find((entry) => entry.id === invoiceId);

    await updateDoc(doc(db, 'workspaces', workspaceId, 'invoices', invoiceId), {
      status,
      updatedAt,
    });

    await pushWorkspaceWideNotification({
      title: 'Invoice updated',
      body: `${invoice?.title ?? 'Invoice'} is now ${status}.`,
      kind: 'billing',
      actionRoute: `/billing?invoice=${invoiceId}`,
      actorId: user?.uid,
      createdAt: updatedAt,
    });
  }

  async function markNotificationRead(notificationId: string) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    await updateDoc(doc(db, 'workspaces', workspaceId, 'notifications', notificationId), {
      readBy: arrayUnion(user.uid),
    });
  }

  async function updateWorkspaceProfile(payload: UpdateWorkspacePayload) {
    if (!workspaceId) throw new Error('Workspace unavailable.');
    await updateDoc(doc(db, 'workspaces', workspaceId), {
      name: payload.name,
      verticals: uniqueStrings(payload.verticals),
      defaultTheme: payload.defaultTheme,
      updatedAt: nowIso(),
    });
  }

  async function updateWorkspaceNotifications(input: Workspace['notificationDefaults']) {
    if (!workspaceId) throw new Error('Workspace unavailable.');
    await updateDoc(doc(db, 'workspaces', workspaceId), {
      notificationDefaults: input,
      updatedAt: nowIso(),
    });
  }

  async function updateMemberRole(memberId: string, role: Role) {
    if (!workspaceId) throw new Error('Workspace unavailable.');
    const target = collections.members.find((entry) => entry.id === memberId);
    if (!target) throw new Error('Member not found.');

    await updateDoc(doc(db, 'workspaces', workspaceId, 'members', memberId), { role });
    if (isRealtimeConfigured && realtimeDb) {
      await update(ref(realtimeDb, `workspaces/${workspaceId}/members/${memberId}`), { role });
    }
  }

  async function updateMyNotificationPreferences(input: Member['notificationPreferences']) {
    if (!workspaceId || !user) throw new Error('Workspace unavailable.');
    await updateDoc(doc(db, 'workspaces', workspaceId, 'members', user.uid), {
      notificationPreferences: input,
    });
  }

  async function uploadAttachment(payload: UploadAttachmentPayload) {
    if (!workspaceId) throw new Error('Workspace unavailable.');
    const folder =
      payload.category === 'proposal'
        ? `proposals/${payload.entityId}`
        : `${payload.entityType === 'client' ? 'clients' : 'projects'}/${payload.entityId}`;
    const fileRef = storageRef(
      storage,
      `workspaces/${workspaceId}/${folder}/${Date.now()}-${payload.file.name}`,
    );
    let snapshot;
    try {
      snapshot = await uploadBytes(fileRef, payload.file);
    } catch (error) {
      if (
        error instanceof Error &&
        /Storage has not been set up|storage/i.test(error.message)
      ) {
        throw new Error(
          'Firebase Storage is not initialized for this project yet. Open Firebase Storage in the console once, click Get Started, and retry the upload.',
        );
      }
      throw error;
    }
    const url = await getDownloadURL(snapshot.ref);

    return {
      name: payload.file.name,
      path: snapshot.ref.fullPath,
      url,
      size: payload.file.size,
      contentType: payload.file.type,
    };
  }

  async function createDirectChannel(targetMemberId: string) {
    if (!workspaceId || !user || !isRealtimeConfigured || !realtimeDb) {
      throw new Error('Realtime Database is not configured yet.');
    }

    const participantIds = uniqueStrings([user.uid, targetMemberId]).sort();
    const existing = channels.find(
      (channel) =>
        channel.type === 'direct' &&
        channel.participantIds.slice().sort().join('|') === participantIds.join('|'),
    );
    if (existing) return existing.id;

    const channelId = `dm_${crypto.randomUUID().slice(0, 12)}`;
    await set(ref(realtimeDb, `workspaces/${workspaceId}/channels/${channelId}`), {
      id: channelId,
      name: 'Direct',
      type: 'direct',
      workspaceId,
      participantIds,
      createdBy: user.uid,
      createdAt: nowIso(),
    } satisfies ChatChannel);

    return channelId;
  }

  async function createTeamChannel(name: string) {
    if (!workspaceId || !user || !isRealtimeConfigured || !realtimeDb) {
      throw new Error('Realtime Database is not configured yet.');
    }
    const channelId = `team_${crypto.randomUUID().slice(0, 12)}`;
    await set(ref(realtimeDb, `workspaces/${workspaceId}/channels/${channelId}`), {
      id: channelId,
      name,
      type: 'team',
      workspaceId,
      participantIds: collections.members.map((item) => item.uid),
      createdBy: user.uid,
      createdAt: nowIso(),
    } satisfies ChatChannel);
    return channelId;
  }

  function subscribeToMessages(
    channelId: string,
    callback: (messages: ChatMessage[]) => void,
  ) {
    if (!workspaceId || !isRealtimeConfigured || !realtimeDb) {
      callback([]);
      return () => undefined;
    }

    return onValue(ref(realtimeDb, `workspaces/${workspaceId}/messages/${channelId}`), (snapshot) => {
      const raw = snapshot.val() ?? {};
      const messages = Object.values(raw) as ChatMessage[];
      messages.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      callback(messages);
    });
  }

  async function sendMessage(channelId: string, body: string) {
    if (!workspaceId || !user || !isRealtimeConfigured || !realtimeDb) {
      throw new Error('Realtime Database is not configured yet.');
    }

    const trimmed = body.trim();
    if (!trimmed) return;

    const channel = channels.find((entry) => entry.id === channelId);
    if (!channel) throw new Error('Channel not found.');

    const messageRef = push(ref(realtimeDb, `workspaces/${workspaceId}/messages/${channelId}`));
    const message: ChatMessage = {
      id: messageRef.key ?? crypto.randomUUID(),
      channelId,
      senderId: user.uid,
      body: trimmed,
      createdAt: nowIso(),
    };

    await set(messageRef, message);
    await update(ref(realtimeDb, `workspaces/${workspaceId}/channels/${channelId}`), {
      lastMessage: {
        body: message.body,
        createdAt: message.createdAt,
        senderId: user.uid,
      },
      participantIds: uniqueStrings(channel.participantIds),
    });

    const database = realtimeDb;
    await Promise.all(
      channel.participantIds
        .filter((participantId) => participantId !== user.uid)
        .map((participantId) =>
          runTransaction(
            ref(database, `workspaces/${workspaceId}/unread/${participantId}/${channelId}`),
            (current) => (typeof current === 'number' ? current + 1 : 1),
          ),
        ),
    );

    const senderName = member?.name ?? user.email ?? 'Team member';
    const actionRoute = `/messages?channel=${channelId}`;
    if (channel.type === 'direct') {
      await pushPersonalNotifications({
        userIds: channel.participantIds,
        title: `New direct message from ${senderName}`,
        body: trimmed,
        kind: 'message',
        actionRoute,
        actorId: user.uid,
        channelId,
        createdAt: message.createdAt,
      });
    } else if (shouldBroadcastChannelMessage(channel, trimmed)) {
      await pushWorkspaceWideNotification({
        title: hasEveryoneMention(trimmed)
          ? `${senderName} mentioned @everyone in ${channel.name}`
          : `New message in ${channel.name}`,
        body: trimmed,
        kind: hasEveryoneMention(trimmed) ? 'mention' : 'message',
        actionRoute,
        actorId: user.uid,
        channelId,
        createdAt: message.createdAt,
      });
    }

    await markChannelRead(channelId);
  }

  async function markChannelRead(channelId: string) {
    if (!workspaceId || !user || !isRealtimeConfigured || !realtimeDb) return;
    await set(ref(realtimeDb, `workspaces/${workspaceId}/unread/${user.uid}/${channelId}`), 0);
  }

  async function setTypingState(channelId: string, active: boolean) {
    if (!workspaceId || !user || !isRealtimeConfigured || !realtimeDb) return;
    const typingRef = ref(realtimeDb, `workspaces/${workspaceId}/typing/${channelId}/${user.uid}`);
    if (active) {
      await set(typingRef, true);
      return;
    }

    await remove(typingRef);
  }

  const value = useMemo(
    () => ({
      ...collections,
      loading,
      searchItems,
      channels,
      unreadByChannel,
      presence,
      typingByChannel,
      realtimeEnabled: isRealtimeConfigured,
      createInvite,
      revokeInvite,
      createClient,
      updateClientStage,
      convertClientToProject,
      createProject,
      createTask,
      updateTaskStatus,
      createNote,
      createMeeting,
      createTimeEntry,
      createInvoice,
      updateInvoiceStatus,
      markNotificationRead,
      updateWorkspaceProfile,
      updateWorkspaceNotifications,
      updateMemberRole,
      updateMyNotificationPreferences,
      uploadAttachment,
      createDirectChannel,
      createTeamChannel,
      subscribeToMessages,
      sendMessage,
      markChannelRead,
      setTypingState,
    }),
    [
      channels,
      collections,
      loading,
      presence,
      searchItems,
      typingByChannel,
      unreadByChannel,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}
