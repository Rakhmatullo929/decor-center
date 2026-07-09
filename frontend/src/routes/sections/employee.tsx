import { lazy } from 'react';

import KioskLayout from 'src/sections/app/survey-kiosk/kiosk-layout';

const EmployeeCabinetPage = lazy(() => import('src/pages/app/employee'));

/**
 * The employee's personal cabinet, reached only via the /scan face+OTP login.
 * No :employeeId in the URL — identity comes solely from the JWT minted by
 * verify-otp (read via /me inside DueSurveysView), so a bookmarked/shared link
 * can never show or submit surveys for the wrong employee.
 */
export const employeeRoutes = [
  {
    path: 'employee',
    element: <KioskLayout />,
    children: [{ index: true, element: <EmployeeCabinetPage /> }],
  },
];
