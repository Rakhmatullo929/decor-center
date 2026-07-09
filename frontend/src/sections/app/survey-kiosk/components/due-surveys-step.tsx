import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import type { Test } from '../../admin-surveys/api/types';
import type { SurveySession } from '../api/types';

type Props = {
  tests: Test[];
  inProgressSessions?: SurveySession[];
  isLoading: boolean;
  employeeName: string;
  onPick: (test: Test) => void;
  onContinue?: (session: SurveySession) => void;
};

function SurveyRow({
  title,
  icon,
  color,
  onClick,
}: {
  title: string;
  icon: string;
  color: 'primary' | 'info';
  onClick: () => void;
}) {
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onClick} sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${color}.lighter`,
              color: `${color}.main`,
            }}
          >
            <Iconify icon={icon} width={24} />
          </Box>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            {title}
          </Typography>
          <Iconify icon="eva:arrow-ios-forward-fill" />
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export default function DueSurveysStep({
  tests,
  inProgressSessions = [],
  isLoading,
  employeeName,
  onPick,
  onContinue,
}: Props) {
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

      {!isLoading && inProgressSessions.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            {tx('survey.kiosk.due.continueTitle')}
          </Typography>
          {inProgressSessions.map((session) => (
            <SurveyRow
              key={session.id}
              title={session.testTitle}
              icon="solar:restart-bold-duotone"
              color="info"
              onClick={() => onContinue?.(session)}
            />
          ))}
        </Stack>
      )}

      {!isLoading && tests.length === 0 && inProgressSessions.length === 0 && (
        <EmptyContent filled title={tx('survey.kiosk.due.empty')} sx={{ py: 8 }} />
      )}

      {!isLoading && tests.length > 0 && (
        <Stack spacing={1.5}>
          {inProgressSessions.length > 0 && (
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              {tx('survey.kiosk.due.title')}
            </Typography>
          )}
          {tests.map((test) => (
            <SurveyRow
              key={test.id}
              title={test.title}
              icon="solar:clipboard-list-bold-duotone"
              color="primary"
              onClick={() => onPick(test)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
