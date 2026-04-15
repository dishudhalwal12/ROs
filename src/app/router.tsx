import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/shell/AppShell';
import { useAuth } from '@/hooks/use-auth';
import { ActivityPage } from '@/features/activity/ActivityPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { BillingPage } from '@/features/billing/BillingPage';
import { CrmPage } from '@/features/crm/CrmPage';
import { MessagesPage } from '@/features/messages/MessagesPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TeamPage } from '@/features/team/TeamPage';
import { TimePage } from '@/features/time/TimePage';
import { WorkspaceProvider } from '@/context/WorkspaceContext';

function ProtectedApp() {
  const { loading, user, workspaceId } = useAuth();

  if (loading) {
    return <div className="app-loading">Loading Rovexa Team OS...</div>;
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
    return <div className="app-loading">Loading Rovexa Team OS...</div>;
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
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route element={<ProtectedApp />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/crm" element={<CrmPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/time" element={<TimePage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
