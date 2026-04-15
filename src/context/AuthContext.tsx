import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ref, set } from 'firebase/database';

import { getAuthErrorCode, toFriendlyAuthError } from '@/lib/auth-errors';
import { auth, db, isRealtimeConfigured, realtimeDb } from '@/lib/firebase';
import {
  APP_NAME,
  DEFAULT_TIMEZONE,
  DEFAULT_VERTICALS,
  DEFAULT_WORKSPACE_NAME,
} from '@/lib/constants';
import { nowIso } from '@/lib/utils';
import type { Invite, Member, Workspace } from '@/types/models';

function isPermissionDenied(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'permission-denied'
  );
}

interface BootstrapPayload {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
}

interface AcceptInvitePayload {
  name: string;
  email: string;
  password: string;
  token: string;
  inviteId?: string;
  workspaceId?: string;
}

interface InviteLookupPayload {
  token: string;
  inviteId?: string;
  workspaceId?: string;
}

interface AuthContextValue {
  user: User | null;
  member: Member | null;
  workspaceId: string | null;
  workspaceExists: boolean;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  bootstrapFounder: (payload: BootstrapPayload) => Promise<void>;
  acceptInvite: (payload: AcceptInvitePayload) => Promise<void>;
  lookupInvite: (payload: InviteLookupPayload) => Promise<Invite | null>;
  refreshWorkspaceAvailability: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const palette = ['#4F46E5', '#0F766E', '#B45309', '#BE123C', '#4338CA', '#0F766E'];
const LAST_BOOTSTRAP_EMAIL_KEY = 'rovexa-last-bootstrap-email';

interface ResolvedInviteRecord {
  docId: string;
  workspaceId: string;
  invite: Omit<Invite, 'id'>;
  ref: ReturnType<typeof doc>;
}

function pickAvatarColor(seed: string) {
  const code = seed
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[code % palette.length];
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceExists, setWorkspaceExists] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshWorkspaceAvailability = useCallback(async () => {
    try {
      const bootstrapSnapshot = await getDoc(doc(db, 'public', 'bootstrap'));
      if (bootstrapSnapshot.exists()) {
        setWorkspaceExists(true);
        return true;
      }
    } catch (error) {
      if (!isPermissionDenied(error)) {
        throw error;
      }
    }

    try {
      const snapshot = await getDocs(query(collection(db, 'workspaces'), limit(1)));
      const exists = !snapshot.empty;
      setWorkspaceExists(exists);
      return exists;
    } catch (error) {
      if (isPermissionDenied(error)) {
        setWorkspaceExists(false);
        return false;
      }

      throw error;
    }
  }, []);

  const resolveMembership = useCallback(async (uid: string) => {
    let targetWorkspaceId: string | null = null;

    try {
      const bootstrapSnapshot = await getDoc(doc(db, 'public', 'bootstrap'));
      targetWorkspaceId = bootstrapSnapshot.exists()
        ? ((bootstrapSnapshot.data() as { workspaceId?: string }).workspaceId ?? null)
        : null;
    } catch (error) {
      if (isPermissionDenied(error)) {
        targetWorkspaceId = null;
      } else {
        throw error;
      }
    }

    if (!targetWorkspaceId) {
      try {
        const workspaceSnapshot = await getDocs(query(collection(db, 'workspaces'), limit(1)));
        targetWorkspaceId = workspaceSnapshot.docs[0]?.id ?? null;
      } catch (error) {
        if (isPermissionDenied(error)) {
          setMember(null);
          setWorkspaceId(null);
          return;
        }

        throw error;
      }
    }

    if (!targetWorkspaceId) {
      setMember(null);
      setWorkspaceId(null);
      return;
    }

    let membershipSnapshot;
    try {
      membershipSnapshot = await getDoc(doc(db, 'workspaces', targetWorkspaceId, 'members', uid));
    } catch (error) {
      if (isPermissionDenied(error)) {
        setMember(null);
        setWorkspaceId(null);
        return;
      }

      throw error;
    }

    if (!membershipSnapshot.exists()) {
      setMember(null);
      setWorkspaceId(null);
      return;
    }

    setMember({ id: membershipSnapshot.id, ...(membershipSnapshot.data() as Omit<Member, 'id'>) });
    setWorkspaceId(targetWorkspaceId);
    setWorkspaceExists(true);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);
      setUser(nextUser);

      try {
        if (nextUser) {
          await resolveMembership(nextUser.uid);
        } else {
          setMember(null);
          setWorkspaceId(null);
        }

        await refreshWorkspaceAvailability();
      } catch {
        setMember(null);
        setWorkspaceId(null);
        setWorkspaceExists(false);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [refreshWorkspaceAvailability, resolveMembership]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      try {
        const credentials = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        await resolveMembership(credentials.user.uid);
        await refreshWorkspaceAvailability();
      } catch (error) {
        throw toFriendlyAuthError(error, 'Unable to sign in.');
      }
    },
    [refreshWorkspaceAvailability, resolveMembership],
  );

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const bootstrapFounder = useCallback(
    async ({ name, email, password, workspaceName }: BootstrapPayload) => {
      const normalizedEmail = email.trim().toLowerCase();
      const exists = await refreshWorkspaceAvailability();
      if (exists) {
        throw new Error('Workspace already exists. Use an invite to join the team.');
      }

      const previousBootstrapEmail = getLastBootstrapEmail();
      setLastBootstrapEmail(normalizedEmail);

      let founder = auth.currentUser?.email?.toLowerCase() === normalizedEmail ? auth.currentUser : null;

      if (!founder && previousBootstrapEmail === normalizedEmail) {
        try {
          const credentials = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          founder = credentials.user;
        } catch (error) {
          const code = getAuthErrorCode(error);
          if (code !== 'auth/invalid-credential') {
            throw toFriendlyAuthError(error, 'Unable to continue workspace setup.');
          }
        }
      }

      if (!founder) {
        try {
          const credentials = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          founder = credentials.user;
        } catch (error) {
          if (getAuthErrorCode(error) === 'auth/email-already-in-use') {
            try {
              const credentials = await signInWithEmailAndPassword(auth, normalizedEmail, password);
              founder = credentials.user;
            } catch (signInError) {
              throw new Error(
                'This email already has a Firebase account. Sign in with that password, then create the workspace again.',
              );
            }
          } else {
            throw toFriendlyAuthError(error, 'Unable to create workspace.');
          }
        }
      }

      if (!founder) {
        throw new Error('Unable to continue workspace setup. Try signing in and retrying.');
      }

      const createdAt = nowIso();
      const workspaceRef = doc(collection(db, 'workspaces'));
      const founderMemberRef = doc(db, 'workspaces', workspaceRef.id, 'members', founder.uid);
      const bootstrapRef = doc(db, 'public', 'bootstrap');
      const notificationRef = doc(collection(db, 'workspaces', workspaceRef.id, 'notifications'));
      const activityRef = doc(collection(db, 'workspaces', workspaceRef.id, 'activity'));

      const workspace: Workspace = {
        id: workspaceRef.id,
        name: workspaceName || DEFAULT_WORKSPACE_NAME,
        brandName: APP_NAME,
        timezone: DEFAULT_TIMEZONE,
        founderId: founder.uid,
        createdAt,
        updatedAt: createdAt,
        defaultTheme: 'light',
        verticals: DEFAULT_VERTICALS,
        notificationDefaults: {
          emailDigests: true,
          mentionAlerts: true,
          dueDateAlerts: true,
        },
      };

      const memberRecord: Member = {
        id: founder.uid,
        uid: founder.uid,
        email: normalizedEmail,
        name,
        title: 'Founder',
        role: 'founder',
        joinedAt: createdAt,
        avatarColor: pickAvatarColor(name),
        focusArea: 'Leadership',
        weeklyCapacity: 40,
        status: 'active',
        notificationPreferences: {
          mentions: true,
          billing: true,
          deadlines: true,
        },
      };

      const bootstrapBatch = writeBatch(db);
      bootstrapBatch.set(workspaceRef, workspace);
      bootstrapBatch.set(founderMemberRef, memberRecord);
      bootstrapBatch.set(bootstrapRef, {
        workspaceId: workspaceRef.id,
        workspaceName: workspace.name,
        brandName: APP_NAME,
        initializedAt: createdAt,
      });
      await bootstrapBatch.commit();

      const followupBatch = writeBatch(db);
      followupBatch.set(notificationRef, {
        id: notificationRef.id,
        userId: founder.uid,
        title: 'Workspace ready',
        body: 'Rovexa Team OS is live. Start by inviting your team and creating your first client.',
        kind: 'system',
        readBy: [],
        actionRoute: '/settings',
        createdAt,
      });
      followupBatch.set(activityRef, {
        id: activityRef.id,
        actorId: founder.uid,
        actorName: name,
        type: 'workspace_bootstrap',
        title: 'Workspace created',
        body: `${name} created ${workspace.name}.`,
        priority: 'high',
        createdAt,
      });
      await followupBatch.commit();

      if (isRealtimeConfigured && realtimeDb) {
        await set(ref(realtimeDb, `workspaces/${workspaceRef.id}/members/${founder.uid}`), {
          uid: founder.uid,
          name,
          email: normalizedEmail,
          role: 'founder',
        });
        await set(ref(realtimeDb, `workspaces/${workspaceRef.id}/channels/general`), {
          id: 'general',
          name: 'General',
          type: 'team',
          workspaceId: workspaceRef.id,
          participantIds: [founder.uid],
          createdBy: founder.uid,
          createdAt,
          lastMessage: {
            body: 'Workspace channel is ready.',
            createdAt,
            senderId: founder.uid,
          },
        });
        await set(ref(realtimeDb, `workspaces/${workspaceRef.id}/messages/general/welcome`), {
          id: 'welcome',
          channelId: 'general',
          senderId: founder.uid,
          body: 'Welcome to Rovexa Team OS.',
          createdAt,
        });
      }

      await resolveMembership(founder.uid);
    },
    [refreshWorkspaceAvailability, resolveMembership],
  );

  const resolveInviteRecord = useCallback(
    async ({
      token,
      inviteId,
      workspaceId: targetWorkspaceId,
    }: {
      token: string;
      inviteId?: string;
      workspaceId?: string;
    }) => {
      const normalizedToken = token.trim();
      if (!normalizedToken) return null;

      if (inviteId && targetWorkspaceId) {
        try {
          const directRef = doc(db, 'workspaces', targetWorkspaceId, 'invites', inviteId);
          const directSnapshot = await getDoc(directRef);

          if (directSnapshot.exists()) {
            const directInvite = directSnapshot.data() as Omit<Invite, 'id'>;
            if (directInvite.token === normalizedToken && directInvite.status === 'pending') {
              return {
                docId: directSnapshot.id,
                workspaceId: targetWorkspaceId,
                invite: directInvite,
                ref: directRef,
              } satisfies ResolvedInviteRecord;
            }
          }
        } catch (error) {
          if (!isPermissionDenied(error)) {
            throw error;
          }
        }
      }

      let inviteSnapshot;
      try {
        inviteSnapshot = await getDocs(
          query(
            collectionGroup(db, 'invites'),
            where('token', '==', normalizedToken),
            where('status', '==', 'pending'),
            limit(1),
          ),
        );
      } catch (error) {
        if (isPermissionDenied(error)) {
          return null;
        }

        throw error;
      }

      if (inviteSnapshot.empty) return null;

      const inviteDoc = inviteSnapshot.docs[0];
      const workspaceRef = inviteDoc.ref.parent.parent;
      if (!workspaceRef?.id) {
        return null;
      }

      return {
        docId: inviteDoc.id,
        workspaceId: workspaceRef.id,
        invite: inviteDoc.data() as Omit<Invite, 'id'>,
        ref: inviteDoc.ref,
      } satisfies ResolvedInviteRecord;
    },
    [],
  );

  const lookupInvite = useCallback(async ({ token, inviteId, workspaceId }: InviteLookupPayload) => {
    const resolvedInvite = await resolveInviteRecord({ token, inviteId, workspaceId });
    if (!resolvedInvite) return null;

    return { id: resolvedInvite.docId, ...resolvedInvite.invite };
  }, [resolveInviteRecord]);

  const acceptInvite = useCallback(
    async ({ name, email, password, token, inviteId, workspaceId: targetWorkspaceId }: AcceptInvitePayload) => {
      const normalizedEmail = email.trim().toLowerCase();
      let resolvedInvite: ResolvedInviteRecord | null;
      try {
        resolvedInvite = await resolveInviteRecord({
          token,
          inviteId,
          workspaceId: targetWorkspaceId,
        });
      } catch (error) {
        throw toFriendlyAuthError(error, 'Unable to validate the invite.');
      }

      if (!resolvedInvite) {
        throw new Error('Invite link is invalid or expired.');
      }

      const { invite } = resolvedInvite;
      if (invite.email.toLowerCase() !== normalizedEmail) {
        throw new Error('Use the invited email address to join this workspace.');
      }

      let nextUser =
        auth.currentUser?.email?.toLowerCase() === normalizedEmail ? auth.currentUser : null;

      if (!nextUser) {
        try {
          const credentials = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          nextUser = credentials.user;
        } catch (error) {
          if (getAuthErrorCode(error) === 'auth/email-already-in-use') {
            try {
              const credentials = await signInWithEmailAndPassword(auth, normalizedEmail, password);
              nextUser = credentials.user;
            } catch {
              throw new Error(
                'This email already has an account. Sign in with the invited email and password to finish joining.',
              );
            }
          } else {
            throw toFriendlyAuthError(error, 'Unable to accept invite.');
          }
        }
      }

      if (!nextUser) {
        throw new Error('Unable to finish joining the workspace. Try signing in and retrying.');
      }

      // Force-refresh token so security rules relying on auth token claims are available.
      await nextUser.getIdToken(true);

      const joinedAt = nowIso();
      const memberRef = doc(db, 'workspaces', resolvedInvite.workspaceId, 'members', nextUser.uid);
      const activityRef = doc(collection(db, 'workspaces', resolvedInvite.workspaceId, 'activity'));

      const memberRecord: Member = {
        id: nextUser.uid,
        uid: nextUser.uid,
        email: normalizedEmail,
        name,
        title: invite.role === 'manager' ? 'Operations Manager' : 'Team Member',
        role: invite.role,
        joinedAt,
        avatarColor: pickAvatarColor(name),
        focusArea: invite.role === 'manager' ? 'Delivery Ops' : 'Execution',
        weeklyCapacity: 40,
        status: 'active',
        notificationPreferences: {
          mentions: true,
          billing: invite.role !== 'member',
          deadlines: true,
        },
      };

      const joinBatch = writeBatch(db);
      joinBatch.set(memberRef, memberRecord);
      joinBatch.update(resolvedInvite.ref, {
        status: 'accepted',
        acceptedAt: joinedAt,
      });
      await joinBatch.commit();

      const activityBatch = writeBatch(db);
      activityBatch.set(activityRef, {
        id: activityRef.id,
        actorId: nextUser.uid,
        actorName: name,
        type: 'invite_created',
        title: 'Team member joined',
        body: `${name} joined as ${invite.role}.`,
        priority: 'normal',
        entityType: 'member',
        entityId: nextUser.uid,
        createdAt: joinedAt,
      });
      try {
        await activityBatch.commit();
      } catch (error) {
        console.error('Unable to record invite acceptance activity.', error);
      }

      if (isRealtimeConfigured && realtimeDb) {
        try {
          await set(ref(realtimeDb, `workspaces/${resolvedInvite.workspaceId}/members/${nextUser.uid}`), {
            uid: nextUser.uid,
            name,
            email: normalizedEmail,
            role: invite.role,
          });
        } catch (error) {
          console.error('Unable to sync the invited member to realtime state.', error);
        }
      }

      await resolveMembership(nextUser.uid);
    },
    [resolveInviteRecord, resolveMembership],
  );

  const value = useMemo(
    () => ({
      user,
      member,
      workspaceId,
      workspaceExists,
      loading,
      signInWithPassword,
      signOutUser,
      bootstrapFounder,
      acceptInvite,
      lookupInvite,
      refreshWorkspaceAvailability,
    }),
    [
      acceptInvite,
      bootstrapFounder,
      loading,
      lookupInvite,
      member,
      refreshWorkspaceAvailability,
      signInWithPassword,
      signOutUser,
      user,
      workspaceExists,
      workspaceId,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
  function getLastBootstrapEmail() {
    return typeof window === 'undefined'
      ? null
      : window.localStorage.getItem(LAST_BOOTSTRAP_EMAIL_KEY);
  }

function setLastBootstrapEmail(email: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_BOOTSTRAP_EMAIL_KEY, email);
}
