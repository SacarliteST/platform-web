import { Route, Routes } from 'react-router-dom';
import { LoginPage, RequireAuth, RequireRole } from '../../session';
import {
  AdminEventsPage,
  AdminHomePage,
  AdminProfilesPage,
  AdminSettingsPage,
  AdminUserDetailsPage,
  AdminUsersPage,
  HelpPage,
  HomePage,
  NotFoundPage,
  StudentHomePage,
  TeacherHomePage,
} from '../../pages';
import { AppLayout } from '../layout/AppLayout';

function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['Admin']}>{children}</RequireRole>
    </RequireAuth>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="help" element={<HelpPage />} />

        <Route path="admin" element={<AdminRoute><AdminHomePage /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route
          path="admin/users/:userId"
          element={<AdminRoute><AdminUserDetailsPage /></AdminRoute>}
        />
        <Route path="admin/events" element={<AdminRoute><AdminEventsPage /></AdminRoute>} />
        <Route path="admin/profiles" element={<AdminRoute><AdminProfilesPage /></AdminRoute>} />
        <Route path="admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />

        <Route
          path="teacher"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={['Teacher']}>
                <TeacherHomePage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="student"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={['Student']}>
                <StudentHomePage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
