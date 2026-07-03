import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { m } from 'framer-motion';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';

type Props = { employeeName: string; onFinish: () => void };

export default function ThankYouStep({ employeeName, onFinish }: Props) {
  const { tx } = useLocales();

  return (
    <Stack spacing={4} alignItems="center" textAlign="center" sx={{ py: { xs: 6, md: 10 } }}>
      <m.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <Box
          sx={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'success.lighter',
            color: 'success.main',
          }}
        >
          <Iconify icon="solar:check-circle-bold-duotone" width={64} />
        </Box>
      </m.div>

      <Stack spacing={1}>
        <Typography variant="h3">{tx('survey.kiosk.thankYou.title')}</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          {tx('survey.kiosk.thankYou.subtitle', { name: employeeName })}
        </Typography>
      </Stack>

      <Button
        variant="contained"
        size="large"
        startIcon={<Iconify icon="solar:home-2-bold" />}
        onClick={onFinish}
        sx={{ px: 5 }}
      >
        {tx('survey.kiosk.thankYou.finish')}
      </Button>
    </Stack>
  );
}
