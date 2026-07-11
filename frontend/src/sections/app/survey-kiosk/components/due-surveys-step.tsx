import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
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
  status,
  progress,
  onClick,
}: {
  title: string;
  icon: string;
  color: 'primary' | 'info';
  status: 'not_started' | 'in_progress';
  progress?: { answered: number; total: number };
  onClick: () => void;
}) {
  const { tx } = useLocales();
  const showProgress = !!progress && progress.total > 0;
  const pct = showProgress ? Math.round((progress!.answered / progress!.total) * 100) : 0;

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
              flexShrink: 0,
            }}
          >
            <Iconify icon={icon} width={24} />
          </Box>

          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {title}
            </Typography>
            {showProgress && (
              <Stack spacing={0.5}>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ height: 6, borderRadius: 1 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {tx('survey.kiosk.due.progress', {
                    answered: progress!.answered,
                    total: progress!.total,
                  })}
                </Typography>
              </Stack>
            )}
          </Stack>

          <Label variant="soft" color={status === 'in_progress' ? 'warning' : 'default'}>
            {tx(
              status === 'in_progress'
                ? 'survey.kiosk.due.status.inProgress'
                : 'survey.kiosk.due.status.notStarted'
            )}
          </Label>
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

  // A survey that is in progress belongs only in the "continue" section — never
  // also in "available". The backend already de-dupes; this guards render races.
  const inProgressTestIds = new Set(inProgressSessions.map((s) => s.test));
  const availableTests = tests.filter((t) => !inProgressTestIds.has(t.id));

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
              status="in_progress"
              progress={{ answered: session.answeredCount, total: session.totalCount }}
              onClick={() => onContinue?.(session)}
            />
          ))}
        </Stack>
      )}

      {!isLoading && availableTests.length === 0 && inProgressSessions.length === 0 && (
        <EmptyContent filled title={tx('survey.kiosk.due.empty')} sx={{ py: 8 }} />
      )}

      {!isLoading && availableTests.length > 0 && (
        <Stack spacing={1.5}>
          {inProgressSessions.length > 0 && (
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              {tx('survey.kiosk.due.title')}
            </Typography>
          )}
          {availableTests.map((test) => (
            <SurveyRow
              key={test.id}
              title={test.title}
              icon="solar:clipboard-list-bold-duotone"
              color="primary"
              status="not_started"
              onClick={() => onPick(test)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
