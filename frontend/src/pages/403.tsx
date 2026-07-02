import { Helmet } from 'react-helmet-async';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function Page403() {
  return (
    <>
      <Helmet>
        <title>403 Forbidden</title>
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
        <Typography variant="h3">403</Typography>
        <Typography variant="body1" color="text.secondary">
          Access forbidden
        </Typography>
      </Box>
    </>
  );
}
