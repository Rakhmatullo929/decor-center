import { Navigate, useRoutes } from 'react-router-dom';
import { paths } from 'src/routes/paths';
import { mainRoutes } from './main';
import { authRoutes } from './auth';
import { publicRoutes } from './public';
import { employeeRoutes } from './employee';
import { dashboardRoutes } from './dashboard';

export default function Router() {
  return useRoutes([
    {
      path: '/',
      element: <Navigate to={paths.login} replace />,
    },
    ...publicRoutes,
    ...employeeRoutes,
    ...authRoutes,
    ...dashboardRoutes,
    ...mainRoutes,
    // The kiosk is public now — redirect the old authenticated routes to /scan.
    { path: '/kiosk', element: <Navigate to={paths.scan} replace /> },
    { path: '/kiosk/*', element: <Navigate to={paths.scan} replace /> },
    { path: '*', element: <Navigate to="/404" replace /> },
  ]);
}
