import { Helmet } from 'react-helmet-async';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function MaintenancePage() {
  return (
    <>
      <Helmet>
        <title>Maintenance</title>
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
        <Typography variant="h3">Under Maintenance</Typography>
        <Typography variant="body1" color="text.secondary">
          We will be back soon.
        </Typography>
      </Box>
    </>
  );
}
