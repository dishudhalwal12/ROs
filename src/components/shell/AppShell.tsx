import { Outlet } from 'react-router-dom';

import { NotificationSound } from '@/components/shell/NotificationSound';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';

export function AppShell() {
  return (
    <>
      <div className="app-shell">
        <Sidebar />
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
