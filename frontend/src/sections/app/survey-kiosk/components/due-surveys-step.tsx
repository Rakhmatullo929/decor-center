import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import type { Test } from '../../admin-surveys/api/types';

type Props = {
  tests: Test[];
  isLoading: boolean;
  employeeName: string;
  onPick: (test: Test) => void;
  onBack: () => void;
};

export default function DueSurveysStep({ tests, isLoading, employeeName, onPick, onBack }: Props) {
  const { tx } = useLocales();

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
          {tx('survey.kiosk.due.subtitle', { name: employeeName })}
        </Typography>
        <Typography variant="h4">{tx('survey.kiosk.due.title')}</Typography>
      </Stack>

      {isLoading && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      )}

      {!isLoading && tests.length === 0 && (
        <EmptyContent filled title={tx('survey.kiosk.due.empty')} sx={{ py: 8 }} />
      )}

      {!isLoading &&
        tests.map((test) => (
          <Card key={test.id} variant="outlined">
            <CardActionArea onClick={() => onPick(test)} sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'primary.lighter',
                    color: 'primary.main',
                  }}
                >
                  <Iconify icon="solar:clipboard-list-bold-duotone" width={24} />
                </Box>
                <Typography variant="subtitle1" sx={{ flex: 1 }}>
                  {test.title}
                </Typography>
                <Iconify icon="eva:arrow-ios-forward-fill" />
              </Stack>
            </CardActionArea>
          </Card>
        ))}

      <Button color="inherit" onClick={onBack} startIcon={<Iconify icon="eva:arrow-ios-back-fill" />} sx={{ alignSelf: 'flex-start' }}>
        {tx('common.actions.back')}
      </Button>
    </Stack>
  );
}
