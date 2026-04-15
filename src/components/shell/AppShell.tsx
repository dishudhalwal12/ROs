import { Outlet } from 'react-router-dom';

import { NotificationSound } from '@/components/shell/NotificationSound';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';

export function AppShell() {
  const { sidebarHidden } = useUiStore();

  return (
    <>
      <div className={cn('app-shell', sidebarHidden && 'app-shell--sidebar-hidden')}>
        <div className={cn('app-shell__sidebar', sidebarHidden && 'app-shell__sidebar--hidden')}>
          <Sidebar />
        </div>
        <div className="app-shell__workspace">
          <Topbar />
          <NotificationSound />
          <main className="app-shell__content">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette />
    </>
  );
}
