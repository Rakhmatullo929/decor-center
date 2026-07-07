import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

import { useAuthContext, useCheckPermission } from 'src/auth/hooks';
import { LoadingScreen } from 'src/components/loading-screen';
import useLocales from 'src/locales/use-locales';
import { paths } from 'src/routes/paths';
import { useTestOptionsQuery } from 'src/sections/app/admin-surveys/api/use-surveys-api';

/** Role landing: every account is redirected to its primary screen. */
export default function HomePage() {
  const { logout } = useAuthContext();
  const { tx } = useLocales();
  const { canReadPage, canWritePage, checkPermission } = useCheckPermission();
  const canReadTests = canReadPage('tests');
  // There's no tests-list screen — an admin's primary screen is straight into
  // the first survey's block builder, so it has to be looked up first.
  const testOptionsQuery = useTestOptionsQuery({ enabled: canReadTests });

  // Kiosk accounts (employee role) land on the public Face-ID + SMS survey flow.
  if (checkPermission('survey', 'submit')) {
    return <Navigate to={paths.scan} replace />;
  }
  if (canReadTests) {
    if (testOptionsQuery.isLoading) {
      return <LoadingScreen />;
    }
    const firstTest = testOptionsQuery.data?.results[0];
    if (firstTest) {
      return <Navigate to={paths.app.surveys.blocks(firstTest.id)} replace />;
    }
    // No surveys exist yet (fresh install) — fall through to the next best screen.
  }
  if (canReadPage('results')) {
    return <Navigate to={paths.app.surveys.results} replace />;
  }
  if (canWritePage('employees')) {
    return <Navigate to={paths.app.employees} replace />;
  }
  if (canReadPage('specialties')) {
    return <Navigate to={paths.app.specialties} replace />;
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
