import {
  BellDot,
  Building2,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  MessageCircleMore,
  Radar,
  ReceiptText,
  Settings,
  SquareCheckBig,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { SIDEBAR_NAV } from '@/lib/constants';
import { cn } from '@/lib/utils';

const iconMap = [
  LayoutDashboard,
  BellDot,
  SquareCheckBig,
  Building2,
  FolderKanban,
  MessageCircleMore,
  Clock3,
  ReceiptText,
  Users,
  Settings,
];

export function Sidebar() {
  const { member } = useAuth();
  const { members, presence } = useWorkspace();

  const teammatePresence = members
    .slice()
    .sort((left, right) => {
      if (left.uid === member?.uid) return -1;
      if (right.uid === member?.uid) return 1;

      const leftOnline = presence[left.uid]?.state === 'online' ? 1 : 0;
      const rightOnline = presence[right.uid]?.state === 'online' ? 1 : 0;
      if (leftOnline !== rightOnline) return rightOnline - leftOnline;

      return left.name.localeCompare(right.name);
    });

  const visibleTeammates = teammatePresence.slice(0, 2);
  const overflowCount = Math.max(0, teammatePresence.length - visibleTeammates.length);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo" aria-hidden="true">
          <img src="/logo.gif" alt="" />
        </div>
        <div>
          <strong>Rovexa OS</strong>
        </div>
      </div>

      <nav className="sidebar__nav">
        {SIDEBAR_NAV.map((item, index) => {
          const Icon = iconMap[index] ?? Radar;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn('sidebar__link', isActive && 'sidebar__link--active')
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar__presence">
        <div className="sidebar__presence-list">
          {visibleTeammates.map((teammate) => {
            const isOnline = presence[teammate.uid]?.state === 'online';
            return (
              <span
                key={teammate.uid}
                className="sidebar__presence-item"
                title={`${teammate.name} is ${isOnline ? 'online' : 'offline'}`}
                aria-label={`${teammate.name} ${isOnline ? 'online' : 'offline'}`}
              >
                <span className={cn('presence-ring', isOnline ? 'presence-ring--online' : 'presence-ring--offline')}>
                  <Avatar member={teammate} size="sm" shape="circle" />
                </span>
                <span className="sr-only">
                  {teammate.uid === member?.uid ? 'You' : teammate.name}{' '}
                  {isOnline ? 'online' : 'offline'}
                </span>
              </span>
            );
          })}
          {overflowCount > 0 ? <div className="sidebar__presence-overflow">+{overflowCount}</div> : null}
        </div>
      </div>
    </aside>
  );
}
