import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

import { useAuthContext, useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
import { paths } from 'src/routes/paths';

/** Role landing: every account is redirected to its primary screen. */
export default function HomePage() {
  const { logout } = useAuthContext();
  const { tx } = useLocales();
  const { canReadPage, canWritePage } = useCheckPermission();

  // Admin lands on the dashboard; medic enters examinations; specialist takes tests.
  if (canReadPage('dashboard')) {
    return <Navigate to={paths.app.dashboard} replace />;
  }
  if (canWritePage('employees')) {
    return <Navigate to={paths.app.employees} replace />;
  }
  if (canWritePage('medical')) {
    return <Navigate to={paths.app.medical.root} replace />;
  }
  if (canWritePage('testing')) {
    return <Navigate to={paths.app.testing.root} replace />;
  }
  if (canReadPage('medical')) {
    return <Navigate to={paths.app.medical.root} replace />;
  }

  return (
    <>
      <Helmet>
        <title>{tx('common.appName')}</title>
      </Helmet>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 2,
        }}
      >
        <Typography variant="h4">{tx('common.appName')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {tx('errors.forbidden.noAccess')}
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          onClick={() => {
            logout();
            window.location.href = paths.login;
          }}
        >
          {tx('common.actions.logout')}
        </Button>
      </Box>
    </>
  );
}
