import { Loader } from '@mantine/core';
import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoginPage, RequireAuth, RequireRole } from '../../session';
import { HomePage, NotFoundPage, StudentHomePage, TeacherHomePage } from '../../pages';
import { HelpPage } from '../../pages/help';
import { AdminHomePage } from '../../pages/admin-home';
import { AppLayout } from '../layout/AppLayout';

const AdminUsersPage = lazy(() => import('../../pages/admin-users').then((m) => ({ default: m.AdminUsersPage })));
const AdminUserDetailsPage = lazy(() =>
  import('../../pages/admin-user-details').then((m) => ({ default: m.AdminUserDetailsPage })),
);
const AdminEventsPage = lazy(() => import('../../pages/admin-events').then((m) => ({ default: m.AdminEventsPage })));
const AdminProfilesPage = lazy(() =>
  import('../../pages/admin-profiles').then((m) => ({ default: m.AdminProfilesPage })),
);
const AdminSettingsPage = lazy(() =>
  import('../../pages/admin-settings').then((m) => ({ default: m.AdminSettingsPage })),
);

const TeacherCoursesPage = lazy(() =>
  import('../../pages/teacher-courses').then((m) => ({ default: m.TeacherCoursesPage })),
);
const TeacherCoursePage = lazy(() =>
  import('../../pages/teacher-course').then((m) => ({ default: m.TeacherCoursePage })),
);
const TeacherModulePage = lazy(() =>
  import('../../pages/teacher-module').then((m) => ({ default: m.TeacherModulePage })),
);
const TeacherTheoryPage = lazy(() =>
  import('../../pages/teacher-theory').then((m) => ({ default: m.TeacherTheoryPage })),
);
const TeacherPracticalPage = lazy(() =>
  import('../../pages/teacher-practical').then((m) => ({ default: m.TeacherPracticalPage })),
);

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'grid', minHeight: 240, placeItems: 'center' }}>
          <Loader aria-label="Загрузка раздела" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['Admin']}>
        <Lazy>{children}</Lazy>
      </RequireRole>
    </RequireAuth>
  );
}

function TeacherRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['Teacher']}>
        <Lazy>{children}</Lazy>
      </RequireRole>
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

        <Route
          path="admin"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={['Admin']}>
                <AdminHomePage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="admin/users/:userId" element={<AdminRoute><AdminUserDetailsPage /></AdminRoute>} />
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
        <Route path="teacher/courses" element={<TeacherRoute><TeacherCoursesPage /></TeacherRoute>} />
        <Route
          path="teacher/courses/:courseId"
          element={<TeacherRoute><TeacherCoursePage /></TeacherRoute>}
        />
        <Route
          path="teacher/courses/:courseId/modules/:moduleId"
          element={<TeacherRoute><TeacherModulePage /></TeacherRoute>}
        />
        <Route
          path="teacher/courses/:courseId/modules/:moduleId/theories/:theoryId"
          element={<TeacherRoute><TeacherTheoryPage /></TeacherRoute>}
        />
        <Route
          path="teacher/courses/:courseId/modules/:moduleId/practicals/:practicalId"
          element={<TeacherRoute><TeacherPracticalPage /></TeacherRoute>}
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
