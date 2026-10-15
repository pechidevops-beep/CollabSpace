import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingPage from './LandingPage';
import LoginPage from '../features/auth/pages/LoginPage';
import SignupPage from '../features/auth/pages/SignupPage';
import DashboardPage from '../features/workspace/pages/DashboardPage';
import WorkspacePage from '../features/workspace/pages/WorkspacePage';
import WorkspaceLayout from '../features/workspace/pages/WorkspaceLayout';
import RepositoryPage from '../features/repository/pages/RepositoryPage';
import AssignmentPage from '../features/classroom/pages/AssignmentPage';
import ClassroomPage from '../features/classroom/pages/ClassroomPage';
const EditorPage = React.lazy(() => import('../features/editor/pages/EditorPage'));
import WorkspacesPage from '../features/workspace/pages/WorkspacesPage';
import SettingsPage from '../features/workspace/pages/SettingsPage';
import NotFoundPage from './NotFoundPage';
import AppLayout from '../components/layout/AppLayout';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-text-sub">
        <span className="text-xs text-text-dim">Loading session...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Nested workspace routes */}
        <Route path="workspace/:workspaceId" element={<WorkspaceLayout />}>
          <Route index element={<WorkspacePage />} />
          <Route path="repo/:repoId" element={<RepositoryPage />} />
          <Route path="assessments" element={<ClassroomPage />} />
          <Route path="assessments/assignment/:assignmentId" element={<AssignmentPage />} />
          <Route
            path="editor/:repoId"
            element={
              <React.Suspense
                fallback={
                  <div className="flex h-screen items-center justify-center text-xs text-text-dim">
                    Loading editor session...
                  </div>
                }
              >
                <EditorPage />
              </React.Suspense>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
