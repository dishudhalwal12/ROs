import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/shell/AppShell';
import { useAuth } from '@/hooks/use-auth';
import { WorkspaceProvider } from '@/context/WorkspaceContext';

const ActivityPage = lazy(() =>
  import('@/features/activity/ActivityPage').then((module) => ({ default: module.ActivityPage })),
);
const BillingPage = lazy(() =>
  import('@/features/billing/BillingPage').then((module) => ({ default: module.BillingPage })),
);
const CrmPage = lazy(() =>
  import('@/features/crm/CrmPage').then((module) => ({ default: module.CrmPage })),
);
const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const MessagesPage = lazy(() =>
  import('@/features/messages/MessagesPage').then((module) => ({
    default: module.MessagesPage,
  })),
);
const OverviewPage = lazy(() =>
  import('@/features/overview/OverviewPage').then((module) => ({
    default: module.OverviewPage,
  })),
);
const ProjectsPage = lazy(() =>
  import('@/features/projects/ProjectsPage').then((module) => ({
    default: module.ProjectsPage,
  })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);
const TasksPage = lazy(() =>
  import('@/features/tasks/TasksPage').then((module) => ({ default: module.TasksPage })),
);
const TeamPage = lazy(() =>
  import('@/features/team/TeamPage').then((module) => ({ default: module.TeamPage })),
);
const TimePage = lazy(() =>
  import('@/features/time/TimePage').then((module) => ({ default: module.TimePage })),
);
const TimepassPage = lazy(() =>
  import('@/features/timepass/TimepassPage').then((module) => ({
    default: module.TimepassPage,
  })),
);
const TimepassProvider = lazy(() =>
  import('@/features/timepass/TimepassProvider').then((module) => ({
    default: module.TimepassProvider,
  })),
);

function AppLoading() {
  return <div className="app-loading">Loading Rovexa OS...</div>;
}

function renderLazyRoute(element: ReactNode) {
  return <Suspense fallback={<AppLoading />}>{element}</Suspense>;
}

function ProtectedApp() {
  const { loading, user, workspaceId } = useAuth();

  if (loading) {
    return <AppLoading />;
  }

  if (!user || !workspaceId) {
    return <Navigate to="/login" replace />;
  }

  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}

function GuestOnly() {
  const { loading, user, workspaceId } = useAuth();

  if (loading) {
    return <AppLoading />;
  }

  if (user && workspaceId) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={renderLazyRoute(<LoginPage />)} />
        </Route>
        <Route element={<ProtectedApp />}>
          <Route path="/" element={renderLazyRoute(<OverviewPage />)} />
          <Route path="/activity" element={renderLazyRoute(<ActivityPage />)} />
          <Route path="/tasks" element={renderLazyRoute(<TasksPage />)} />
          <Route path="/crm" element={renderLazyRoute(<CrmPage />)} />
          <Route path="/projects" element={renderLazyRoute(<ProjectsPage />)} />
          <Route path="/messages" element={renderLazyRoute(<MessagesPage />)} />
          <Route path="/time" element={renderLazyRoute(<TimePage />)} />
          <Route
            path="/time/timepass"
            element={renderLazyRoute(
              <TimepassProvider>
                <TimepassPage />
              </TimepassProvider>
            )}
          />
          <Route path="/billing" element={renderLazyRoute(<BillingPage />)} />
          <Route path="/team" element={renderLazyRoute(<TeamPage />)} />
          <Route path="/settings" element={renderLazyRoute(<SettingsPage />)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
