import { Helmet } from 'react-helmet-async';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { paths } from 'src/routes/paths';

export default function Page404() {
  return (
    <>
      <Helmet>
        <title>404 Not Found</title>
      </Helmet>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <Typography variant="h3">404</Typography>
        <Typography variant="body1" color="text.secondary">
          Page not found
        </Typography>
        <Button href={paths.login} variant="outlined" color="inherit">
          Go to Login
        </Button>
      </Box>
    </>
  );
}
