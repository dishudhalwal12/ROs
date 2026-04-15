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
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo" aria-hidden="true">
          <img src="/rovexa-icon.svg" alt="" />
        </div>
        <div>
          <strong>rovexa</strong>
          <p>Team OS</p>
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
    </aside>
  );
}
