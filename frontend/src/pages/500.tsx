import { Helmet } from 'react-helmet-async';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function Page500() {
  return (
    <>
      <Helmet>
        <title>500 Server Error</title>
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
        <Typography variant="h3">500</Typography>
        <Typography variant="body1" color="text.secondary">
          Internal server error
        </Typography>
      </Box>
    </>
  );
}
