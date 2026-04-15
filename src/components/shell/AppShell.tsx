import { useEffect, useEffectEvent } from 'react';
import { Outlet } from 'react-router-dom';

import { FloatingWorkRestWidget } from '@/components/shell/FloatingWorkRestWidget';
import { NotificationSound } from '@/components/shell/NotificationSound';
import { NotificationToasts } from '@/components/shell/NotificationToasts';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';

export function AppShell() {
  const { sidebarHidden, setSidebarHidden } = useUiStore();

  const handleSidebarShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable)
    ) {
      return;
    }

    if (event.key.toLowerCase() !== 'b') {
      return;
    }

    event.preventDefault();
    setSidebarHidden(!sidebarHidden);
  });

  useEffect(() => {
    window.addEventListener('keydown', handleSidebarShortcut);
    return () => window.removeEventListener('keydown', handleSidebarShortcut);
  }, []);

  return (
    <>
      <div className={cn('app-shell', sidebarHidden && 'app-shell--sidebar-hidden')}>
        <div className={cn('app-shell__sidebar', sidebarHidden && 'app-shell__sidebar--hidden')}>
          <Sidebar />
        </div>
        <div className="app-shell__workspace">
          <Topbar />
          <NotificationSound />
          <NotificationToasts />
          <main className="app-shell__content">
            <Outlet />
          </main>
        </div>
      </div>
      <FloatingWorkRestWidget />
      <CommandPalette />
    </>
  );
}
