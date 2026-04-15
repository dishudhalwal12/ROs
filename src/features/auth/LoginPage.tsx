import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, KeyRound, Rocket, UserPlus } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  bootstrapSchema,
  inviteAcceptSchema,
  signInSchema,
} from '@/lib/validation';
import { APP_NAME, DEFAULT_WORKSPACE_NAME } from '@/lib/constants';
import type { Invite } from '@/types/models';

type AuthMode = 'signin' | 'bootstrap' | 'invite';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? '';
  const inviteId = searchParams.get('inviteId') ?? '';
  const workspaceId = searchParams.get('workspace') ?? '';
  const {
    workspaceExists,
    signInWithPassword,
    bootstrapFounder,
    acceptInvite,
    lookupInvite,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>(workspaceExists ? 'signin' : 'bootstrap');
  const [pendingInvite, setPendingInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(inviteToken ? 'invite' : workspaceExists ? 'signin' : 'bootstrap');
  }, [inviteToken, workspaceExists]);

  useEffect(() => {
    if (!inviteToken) {
      setPendingInvite(null);
      return;
    }

    void lookupInvite({
      token: inviteToken,
      inviteId: inviteId || undefined,
      workspaceId: workspaceId || undefined,
    }).then(setPendingInvite);
  }, [inviteId, inviteToken, lookupInvite, workspaceId]);

  const signInForm = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const bootstrapForm = useForm({
    resolver: zodResolver(bootstrapSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      workspaceName: DEFAULT_WORKSPACE_NAME,
    },
  });
  const inviteForm = useForm({
    resolver: zodResolver(inviteAcceptSchema),
    defaultValues: {
      name: '',
      email: pendingInvite?.email ?? '',
      password: '',
      token: inviteToken,
    },
  });

  useEffect(() => {
    inviteForm.reset({
      name: '',
      email: pendingInvite?.email ?? '',
      password: '',
      token: inviteToken,
    });
  }, [inviteForm, inviteToken, pendingInvite]);

  const heading = useMemo(() => {
    if (mode === 'invite') return 'Join your team workspace';
    if (mode === 'bootstrap') return 'Launch the workspace';
    return 'Sign back into operations';
  }, [mode]);

  async function handleSignIn(values: { email: string; password: string }) {
    setError(null);
    setBusy(true);
    try {
      await signInWithPassword(values.email, values.password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBootstrap(values: {
    name: string;
    email: string;
    password: string;
    workspaceName: string;
  }) {
    setError(null);
    setBusy(true);
    try {
      await bootstrapFounder(values);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create workspace.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvite(values: {
    name: string;
    email: string;
    password: string;
    token: string;
  }) {
    setError(null);
    setBusy(true);
    try {
      await acceptInvite({
        ...values,
        inviteId: inviteId || undefined,
        workspaceId: workspaceId || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to accept invite.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <div className="auth-hero__badge">Reference-inspired ops OS</div>
        <h1>{APP_NAME}</h1>
        <p>
          CRM, projects, messaging, time, billing, and team visibility in one operating
          layer built for daily use.
        </p>
        <div className="auth-hero__panels">
          <div className="auth-preview auth-preview--violet">
            <span>Total tasks</span>
            <strong>137</strong>
            <small>Across live projects</small>
          </div>
          <div className="auth-preview auth-preview--gold">
            <span>Monthly revenue</span>
            <strong>₹6.8L</strong>
            <small>Billing + retainers</small>
          </div>
          <div className="auth-preview auth-preview--blue">
            <span>Active clients</span>
            <strong>18</strong>
            <small>Pipeline to delivery</small>
          </div>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card__header">
          <span className="auth-card__eyebrow">Workspace access</span>
          <h2>{heading}</h2>
          <p>
            {mode === 'invite'
              ? 'Create your account with the invited email and password.'
              : 'Use Firebase-backed auth with role-aware access and linked team data.'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'signin' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => setMode('signin')}
          >
            <KeyRound size={16} />
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'bootstrap' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => setMode('bootstrap')}
            disabled={workspaceExists}
          >
            <Rocket size={16} />
            Create workspace
          </button>
          <button
            type="button"
            className={mode === 'invite' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => setMode('invite')}
          >
            <UserPlus size={16} />
            Join invite
          </button>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        {mode === 'signin' ? (
          <form className="form-grid" onSubmit={signInForm.handleSubmit(handleSignIn)}>
            <label>
              <span>Email</span>
              <input type="email" {...signInForm.register('email')} />
            </label>
            <label>
              <span>Password</span>
              <input type="password" {...signInForm.register('password')} />
            </label>
            <button type="submit" className="primary-button" disabled={busy}>
              Continue to workspace
              <ArrowRight size={16} />
            </button>
          </form>
        ) : null}

        {mode === 'bootstrap' ? (
          <form className="form-grid" onSubmit={bootstrapForm.handleSubmit(handleBootstrap)}>
            <label>
              <span>Your name</span>
              <input type="text" {...bootstrapForm.register('name')} />
            </label>
            <label>
              <span>Workspace email</span>
              <input type="email" {...bootstrapForm.register('email')} />
            </label>
            <label>
              <span>Password</span>
              <input type="password" {...bootstrapForm.register('password')} />
            </label>
            <label>
              <span>Workspace name</span>
              <input type="text" {...bootstrapForm.register('workspaceName')} />
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={busy || workspaceExists}
            >
              Create founder workspace
              <ArrowRight size={16} />
            </button>
          </form>
        ) : null}

        {mode === 'invite' ? (
          <form className="form-grid" onSubmit={inviteForm.handleSubmit(handleAcceptInvite)}>
            <label>
              <span>Invite token</span>
              <input type="text" {...inviteForm.register('token')} />
            </label>
            <label>
              <span>Your name</span>
              <input type="text" {...inviteForm.register('name')} />
            </label>
            <label>
              <span>Invited email</span>
              <input type="email" {...inviteForm.register('email')} />
            </label>
            <label>
              <span>Password</span>
              <input type="password" {...inviteForm.register('password')} />
            </label>
            <button type="submit" className="primary-button" disabled={busy}>
              Join workspace
              <ArrowRight size={16} />
            </button>
            {inviteToken && !pendingInvite ? (
              <small className="form-hint">
                Invite lookup is still loading or the token is no longer active.
              </small>
            ) : null}
          </form>
        ) : null}
      </section>
    </div>
  );
}
