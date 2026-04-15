import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BellRing, Copy, MailPlus, ShieldCheck, SlidersHorizontal, UserCog2 } from 'lucide-react';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { buildInviteLink } from '@/lib/invite-links';
import { inviteSchema, workspaceSchema } from '@/lib/validation';
import { ROLE_LABELS } from '@/lib/constants';
import { formatLongDateTime } from '@/lib/format';

export function SettingsPage() {
  type WorkspaceFormInput = z.input<typeof workspaceSchema>;
  type WorkspaceFormValues = z.output<typeof workspaceSchema>;
  type InviteFormInput = z.input<typeof inviteSchema>;
  type InviteFormValues = z.output<typeof inviteSchema>;
  const { member } = useAuth();
  const {
    workspace,
    invites,
    members,
    createInvite,
    revokeInvite,
    updateWorkspaceProfile,
    updateWorkspaceNotifications,
    updateMemberRole,
    updateMyNotificationPreferences,
  } = useWorkspace();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const workspaceForm = useForm<WorkspaceFormInput, undefined, WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    values: {
      name: workspace?.name ?? '',
      verticals: workspace?.verticals.join(', ') ?? '',
    },
  });
  const inviteForm = useForm<InviteFormInput, undefined, InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  });

  const canManageWorkspace = member?.role === 'founder';
  const canManageRoles = member?.role === 'founder';
  const notificationPreferences = member?.notificationPreferences ?? {
    mentions: true,
    billing: false,
    deadlines: true,
  };

  const inviteLinks = useMemo(
    () =>
      invites.map((invite) => ({
        ...invite,
        link: workspace
          ? buildInviteLink(window.location.origin, {
              inviteId: invite.id,
              token: invite.token,
              workspaceId: workspace.id,
            })
          : `${window.location.origin}/login?invite=${invite.token}`,
      })),
    [invites, workspace],
  );

  async function submitWorkspace(values: WorkspaceFormValues) {
    await updateWorkspaceProfile({
      name: values.name,
      verticals: values.verticals.split(',').map((value) => value.trim()).filter(Boolean),
      defaultTheme: 'light',
    });
  }

  async function submitInvite(values: InviteFormValues) {
    await createInvite(values.email, values.role);
    inviteForm.reset({ email: '', role: 'member' });
    setInviteModalOpen(false);
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Workspace control, team access, and preferences</h1>
          <p>Configure the operating system once, then let the team run from it every day.</p>
        </div>
      </section>

      <div className="two-column-layout">
        <SectionCard title="Workspace profile" subtitle="Brand and vertical setup">
          {canManageWorkspace ? (
            <form className="form-grid" onSubmit={workspaceForm.handleSubmit((values) => void submitWorkspace(values))}>
              <label>
                <span>Workspace name</span>
                <input type="text" {...workspaceForm.register('name')} />
              </label>
              <label className="form-grid__wide">
                <span>Verticals</span>
                <input type="text" {...workspaceForm.register('verticals')} />
              </label>
              <div className="settings-note form-grid__wide">
                The interface now stays in a single curated light theme inspired by the reference layouts.
              </div>
              <div className="modal-actions form-grid__wide">
                <button type="submit" className="primary-button">
                  <SlidersHorizontal size={16} />
                  Save workspace
                </button>
              </div>
            </form>
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="Admin-managed"
              description="Workspace-wide configuration is limited to founders and managers."
            />
          )}
        </SectionCard>

        <SectionCard title="Notification preferences" subtitle="Your personal alert defaults">
          <div className="toggle-list">
            {(['mentions', 'billing', 'deadlines'] as const).map((key) => (
              <label key={key} className="toggle-list__item">
                <div>
                  <strong>{key}</strong>
                  <p>
                    {key === 'mentions'
                      ? 'Direct mentions and quick pings'
                      : key === 'billing'
                        ? 'Revenue and invoice alerts'
                        : 'Due dates and overdue work'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationPreferences[key]}
                  onChange={(event) =>
                    void updateMyNotificationPreferences({
                      ...notificationPreferences,
                      [key]: event.target.checked,
                    })
                  }
                />
              </label>
            ))}
          </div>
          {canManageWorkspace && workspace ? (
            <div className="toggle-list">
              <h3 className="settings-subheading">Workspace alert defaults</h3>
              {(['emailDigests', 'mentionAlerts', 'dueDateAlerts'] as const).map((key) => (
                <label key={key} className="toggle-list__item">
                  <div>
                    <strong>{key}</strong>
                    <p>Default alert behavior for new members.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={workspace.notificationDefaults[key]}
                    onChange={(event) =>
                      void updateWorkspaceNotifications({
                        ...workspace.notificationDefaults,
                        [key]: event.target.checked,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          ) : null}
        </SectionCard>
      </div>

      <div className="two-column-layout">
        <SectionCard
          title="Invites"
          subtitle="Share controlled access with the team"
          action={
            canManageWorkspace ? (
              <button type="button" className="pill-button" onClick={() => setInviteModalOpen(true)}>
                <MailPlus size={16} />
                New invite
              </button>
            ) : null
          }
        >
          {inviteLinks.length === 0 ? (
            <EmptyState
              icon={MailPlus}
              title="No invites yet"
              description="Create invite links for managers and members from this panel."
            />
          ) : (
            <div className="list-stack">
              {inviteLinks.map((invite) => (
                <article key={invite.id} className="list-row">
                  <div>
                    <strong>{invite.email}</strong>
                    <p>{invite.link}</p>
                  </div>
                  <div className="list-row__meta">
                    <Badge tone={invite.status === 'accepted' ? 'success' : 'warning'}>
                      {invite.status}
                    </Badge>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void navigator.clipboard.writeText(invite.link)}
                    >
                      <Copy size={16} />
                    </button>
                    {invite.status === 'pending' ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void revokeInvite(invite.id)}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Roles and access" subtitle="Who can see and manage which surfaces">
          {members.length === 0 ? (
            <EmptyState
              icon={UserCog2}
              title="No team members"
              description="Invite your team before assigning or changing roles."
            />
          ) : (
            <div className="list-stack">
              {members.map((teamMember) => (
                <article key={teamMember.id} className="list-row">
                  <div>
                    <strong>{teamMember.name}</strong>
                    <p>{teamMember.email}</p>
                    <small>{formatLongDateTime(teamMember.joinedAt)}</small>
                  </div>
                  <div className="list-row__meta">
                    {canManageRoles ? (
                      <select
                        value={teamMember.role}
                        onChange={(event) =>
                          void updateMemberRole(
                            teamMember.id,
                            event.target.value as typeof teamMember.role,
                          )
                        }
                      >
                        <option value="founder">Founder</option>
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <Badge tone="info">{ROLE_LABELS[teamMember.role]}</Badge>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Access model" subtitle="How permissions are split across the app">
        <div className="empty-state empty-state--inline">
          <div className="empty-state__icon">
            <BellRing size={22} />
          </div>
          <div>
            <h3>Role-aware views are already enforced in the product</h3>
            <p>
              Members stay away from workspace-wide billing and critical settings, managers
              can run operations, and founders keep full control.
            </p>
          </div>
        </div>
      </SectionCard>

      <Modal title="Create invite" open={inviteModalOpen} onClose={() => setInviteModalOpen(false)}>
        <form className="form-grid" onSubmit={inviteForm.handleSubmit((values) => void submitInvite(values))}>
          <label>
            <span>Email</span>
            <input type="email" {...inviteForm.register('email')} />
          </label>
          <label>
            <span>Role</span>
            <select {...inviteForm.register('role')}>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
            </select>
          </label>
          <div className="modal-actions form-grid__wide">
            <button type="button" className="secondary-button" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <MailPlus size={16} />
              Create invite
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
