import { Navigate, useRoutes } from 'react-router-dom';
import { paths } from 'src/routes/paths';
import { mainRoutes } from './main';
import { authRoutes } from './auth';
import { dashboardRoutes } from './dashboard';

export default function Router() {
  return useRoutes([
    {
      path: '/',
      element: <Navigate to={paths.login} replace />,
    },
    ...authRoutes,
    ...dashboardRoutes,
    ...mainRoutes,
    { path: '*', element: <Navigate to="/404" replace /> },
  ]);
}
