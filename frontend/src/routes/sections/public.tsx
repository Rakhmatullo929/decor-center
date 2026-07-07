import { Suspense, lazy } from 'react';
import { LoadingScreen } from 'src/components/loading-screen';

const ScanPage = lazy(() => import('src/pages/public/scan'));
const ScanAnswerPage = lazy(() => import('src/pages/public/scan-answer'));

export const publicRoutes = [
  {
    path: 'scan',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ScanPage />
      </Suspense>
    ),
  },
  {
    path: 'scan/answer',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <ScanAnswerPage />
      </Suspense>
    ),
  },
];
