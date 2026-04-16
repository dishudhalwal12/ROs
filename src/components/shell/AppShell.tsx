import { useEffect, useEffectEvent, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { FloatingWorkRestWidget } from '@/components/shell/FloatingWorkRestWidget';
import { NotificationSound } from '@/components/shell/NotificationSound';
import { NotificationToasts } from '@/components/shell/NotificationToasts';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';

export function AppShell() {
  const location = useLocation();
  const { sidebarHidden, setSidebarHidden } = useUiStore();
  const previousSidebarHiddenRef = useRef(sidebarHidden);
  const immersiveRouteRef = useRef(false);
  const isImmersiveRoute = location.pathname.startsWith('/time/timepass');

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

  useEffect(() => {
    if (isImmersiveRoute) {
      if (!immersiveRouteRef.current) {
        previousSidebarHiddenRef.current = sidebarHidden;
      }
      immersiveRouteRef.current = true;
      if (!sidebarHidden) {
        setSidebarHidden(true);
      }
      return;
    }

    if (immersiveRouteRef.current && sidebarHidden !== previousSidebarHiddenRef.current) {
      setSidebarHidden(previousSidebarHiddenRef.current);
    }
    immersiveRouteRef.current = false;
  }, [isImmersiveRoute, setSidebarHidden, sidebarHidden]);

  return (
    <>
      <div className={cn('app-shell', sidebarHidden && 'app-shell--sidebar-hidden')}>
        <div className={cn('app-shell__sidebar', sidebarHidden && 'app-shell__sidebar--hidden')}>
          <Sidebar />
        </div>
        <div
          className={cn(
            'app-shell__workspace',
            isImmersiveRoute && 'app-shell__workspace--immersive',
          )}
        >
          {!isImmersiveRoute ? <Topbar /> : null}
          <NotificationSound />
          <NotificationToasts />
          <main
            className={cn(
              'app-shell__content',
              isImmersiveRoute && 'app-shell__content--immersive',
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>
      <FloatingWorkRestWidget />
      <CommandPalette />
    </>
  );
}
