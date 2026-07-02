import { Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthGuard, PermissionGuard } from 'src/auth/guard';
import DashboardLayout from 'src/layouts/dashboard';
import { LoadingScreen } from 'src/components/loading-screen';

const HomePage = lazy(() => import('src/pages/home'));
const DashboardPage = lazy(() => import('src/pages/app/dashboard'));
const EmployeesPage = lazy(() => import('src/pages/app/employees'));
const SpecialtiesPage = lazy(() => import('src/pages/app/specialties'));
const QuestionsPage = lazy(() => import('src/pages/app/questions'));
const InstructionsPage = lazy(() => import('src/pages/app/instructions'));
const ResultsPage = lazy(() => import('src/pages/app/results'));
const ResultDetailPage = lazy(() => import('src/pages/app/result-detail'));
const MedicalPage = lazy(() => import('src/pages/app/medical'));
const MedicalCreatePage = lazy(() => import('src/pages/app/medical-create'));
const MedicalDetailPage = lazy(() => import('src/pages/app/medical-detail'));
const MedicalEditPage = lazy(() => import('src/pages/app/medical-edit'));
const TestingPage = lazy(() => import('src/pages/app/testing'));
const TestingQuestionsPage = lazy(() => import('src/pages/app/testing-questions'));

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
        path: 'dashboard',
        element: (
          <PermissionGuard page="dashboard" action="read">
            <DashboardPage />
          </PermissionGuard>
        ),
      },
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
        path: 'questions',
        element: (
          <PermissionGuard page="questions" action="read">
            <QuestionsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'instructions',
        element: (
          <PermissionGuard page="instructions" action="read">
            <InstructionsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'results',
        element: (
          <PermissionGuard page="results" action="read">
            <ResultsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'results/:id',
        element: (
          <PermissionGuard page="results" action="detail">
            <ResultDetailPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'medical',
        element: (
          <PermissionGuard page="medical" action="read">
            <MedicalPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'medical/new/:employeeId',
        element: (
          <PermissionGuard page="medical" action="write">
            <MedicalCreatePage />
          </PermissionGuard>
        ),
      },
      {
        path: 'medical/:id',
        element: (
          <PermissionGuard page="medical" action="detail">
            <MedicalDetailPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'medical/:id/edit',
        element: (
          <PermissionGuard page="medical" action="write">
            <MedicalEditPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'testing',
        element: (
          <PermissionGuard page="testing" action="write">
            <TestingPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'testing/tests/:specialistId/:module',
        element: (
          <PermissionGuard page="testing" action="write">
            <TestingQuestionsPage />
          </PermissionGuard>
        ),
      },
    ],
  },
];
