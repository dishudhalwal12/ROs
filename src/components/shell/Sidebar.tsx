import {
  BellDot,
  BriefcaseBusiness,
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
import { useWorkspace } from '@/hooks/use-workspace';

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
  const { members } = useWorkspace();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">rv</div>
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

      <div className="sidebar__team">
        <div className="sidebar__section-heading">
          <span>Members</span>
        </div>
        <div className="sidebar__teammates">
          {members.slice(0, 4).map((member) => (
            <div key={member.id} className="sidebar__teammate">
              <span style={{ background: member.avatarColor }} />
              <div>
                <strong>{member.name}</strong>
                <small>{member.title}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="sidebar__footer">
          <BriefcaseBusiness size={18} />
          <span>Every module connected.</span>
        </div>
      </div>
    </aside>
  );
}
