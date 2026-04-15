import { Bell, PanelLeftClose, PanelLeftOpen, Plus, Search, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { useUiStore } from '@/store/ui-store';

export function Topbar() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const { notifications } = useWorkspace();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    sidebarHidden,
    setSidebarHidden,
  } = useUiStore();

  const unreadNotifications = notifications.filter(
    (notification) => !notification.readBy.includes(member?.uid ?? ''),
  ).length;

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="icon-button"
          onClick={() => setSidebarHidden(!sidebarHidden)}
          aria-label={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
          title={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarHidden ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <button
          type="button"
          className="topbar__search"
          onClick={() => setCommandPaletteOpen(!commandPaletteOpen)}
        >
          <Search size={16} />
          <span>Search everything</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div className="topbar__actions">
        <button
          type="button"
          className="pill-button"
          onClick={() => navigate('/tasks?compose=task')}
        >
          <Plus size={16} />
          New task
        </button>
        <button
          type="button"
          className="pill-button pill-button--ghost"
          onClick={() => navigate('/crm?compose=client')}
        >
          <Sparkles size={16} />
          New client
        </button>
        <button
          type="button"
          className="icon-button icon-button--with-dot"
          onClick={() => navigate('/activity')}
          aria-label="Open activity"
        >
          <Bell size={18} />
          {unreadNotifications > 0 ? (
            <span className="notification-dot">{unreadNotifications}</span>
          ) : null}
        </button>
        <div className="topbar__profile">
          <Avatar member={member} />
          <div>
            <strong>{member?.name ?? 'Workspace'}</strong>
            <small>{member?.role ?? 'Signing in...'}</small>
          </div>
        </div>
      </div>
    </header>
  );
}
