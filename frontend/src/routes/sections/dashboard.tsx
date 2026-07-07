import { Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthGuard, PermissionGuard } from 'src/auth/guard';
import DashboardLayout from 'src/layouts/dashboard';
import { LoadingScreen } from 'src/components/loading-screen';

const HomePage = lazy(() => import('src/pages/home'));
const EmployeesPage = lazy(() => import('src/pages/app/employees'));
const SpecialtiesPage = lazy(() => import('src/pages/app/specialties'));
const SurveyBlocksPage = lazy(() => import('src/pages/app/survey-blocks'));
const SurveyBlockQuestionsPage = lazy(() => import('src/pages/app/survey-block-questions'));
const SurveyResultsPage = lazy(() => import('src/pages/app/survey-results'));
const KioskEntryPage = lazy(() => import('src/pages/app/survey-kiosk-entry'));
const KioskAnswerPage = lazy(() => import('src/pages/app/survey-kiosk-answer'));

export const dashboardRoutes = [
  {
    element: (
      <AuthGuard>
        <DashboardLayout>
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </DashboardLayout>
      </AuthGuard>
    ),
    children: [
      { path: 'home', element: <HomePage /> },
      {
        path: 'employees',
        element: (
          <PermissionGuard page="employees" action="read">
            <EmployeesPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'specialties',
        element: (
          <PermissionGuard page="specialties" action="read">
            <SpecialtiesPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'surveys/tests/:testId/blocks',
        element: (
          <PermissionGuard page="tests" action="read">
            <SurveyBlocksPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'surveys/tests/:testId/blocks/:blockId',
        element: (
          <PermissionGuard page="tests" action="read">
            <SurveyBlockQuestionsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'surveys/results',
        element: (
          <PermissionGuard page="results" action="read">
            <SurveyResultsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'kiosk',
        element: (
          <PermissionGuard page="survey" action="submit">
            <KioskEntryPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'kiosk/answer',
        element: (
          <PermissionGuard page="survey" action="submit">
            <KioskAnswerPage />
          </PermissionGuard>
        ),
      },
    ],
  },
];
