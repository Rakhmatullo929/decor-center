import { lazy } from 'react';

import KioskLayout from 'src/sections/app/survey-kiosk/kiosk-layout';

const ScanPage = lazy(() => import('src/pages/public/scan'));
const ScanManualPage = lazy(() => import('src/pages/public/scan-manual'));
const ScanConfirmPage = lazy(() => import('src/pages/public/scan-confirm'));
const ScanOtpPage = lazy(() => import('src/pages/public/scan-otp'));
const ScanDuePage = lazy(() => import('src/pages/public/scan-due'));
const ScanAnswerPage = lazy(() => import('src/pages/public/scan-answer'));

export const publicRoutes = [
  {
    path: 'scan',
    element: <KioskLayout />,
    children: [
      { index: true, element: <ScanPage /> },
      { path: 'manual', element: <ScanManualPage /> },
      { path: 'confirm/:employeeId', element: <ScanConfirmPage /> },
      { path: 'otp/:employeeId', element: <ScanOtpPage /> },
      { path: 'due/:employeeId', element: <ScanDuePage /> },
      { path: 'answer', element: <ScanAnswerPage /> },
    ],
  },
];
