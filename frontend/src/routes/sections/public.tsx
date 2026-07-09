import { lazy } from 'react';

import KioskLayout from 'src/sections/app/survey-kiosk/kiosk-layout';

const ScanPage = lazy(() => import('src/pages/public/scan'));
const ScanManualPage = lazy(() => import('src/pages/public/scan-manual'));
const ScanConfirmPage = lazy(() => import('src/pages/public/scan-confirm'));
const ScanOtpPage = lazy(() => import('src/pages/public/scan-otp'));
const SurveyPage = lazy(() => import('src/pages/public/survey'));

export const publicRoutes = [
  {
    path: 'scan',
    element: <KioskLayout />,
    children: [
      { index: true, element: <ScanPage /> },
      { path: 'manual', element: <ScanManualPage /> },
      { path: 'confirm/:employeeId', element: <ScanConfirmPage /> },
      { path: 'otp/:employeeId', element: <ScanOtpPage /> },
    ],
  },
  {
    path: 'survey/:sessionId',
    element: <KioskLayout />,
    children: [{ index: true, element: <SurveyPage /> }],
  },
];
