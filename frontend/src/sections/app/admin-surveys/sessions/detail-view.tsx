import { useParams } from 'react-router-dom';
import Container from '@mui/material/Container';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import EmptyContent from 'src/components/empty-content';
import Label from 'src/components/label';
import { useSettingsContext } from 'src/components/settings';
import { paths } from 'src/routes/paths';
import { fDateTime } from 'src/utils/format-time';
import { useSurveySessionQuery } from '../api/use-surveys-api';
import type { SurveySessionStatus } from '../api/types';
import SessionAnswerCard from './components/session-answer-card';

const STATUS_COLOR: Record<SurveySessionStatus, 'info' | 'success' | 'warning'> = {
  in_progress: 'info',
  completed: 'success',
  abandoned: 'warning',
};

export default function SurveySessionDetailView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const { sessionId: sessionIdParam } = useParams();
  const sessionId = Number(sessionIdParam);

  const sessionQuery = useSurveySessionQuery(sessionId);
  const session = sessionQuery.data;

  const statusLabel = (status: SurveySessionStatus) => tx(`surveys.sessions.status.${status}`);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.sessions.detail.title')}
        links={[
          { name: tx('common.appName'), href: paths.home },
          { name: tx('surveys.sessions.title'), href: paths.app.surveys.sessions },
          { name: session?.employeeName ?? '' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {sessionQuery.isPending && <LinearProgress />}

      {sessionQuery.isError && (
        <EmptyContent filled title={tx('surveys.sessions.detail.loadError')} sx={{ py: 10 }} />
      )}

      {session && (
        <Stack spacing={4}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1, sm: 3 }}
            alignItems={{ sm: 'center' }}
          >
            <Typography variant="h6">{session.testTitle}</Typography>
            <Label color={STATUS_COLOR[session.status]}>{statusLabel(session.status)}</Label>
            <Typography variant="body2" color="text.secondary">
              {tx('surveys.sessions.table.startedAt')}: {fDateTime(session.startedAt)}
            </Typography>
            {session.completedAt && (
              <Typography variant="body2" color="text.secondary">
                {tx('surveys.sessions.table.completedAt')}: {fDateTime(session.completedAt)}
              </Typography>
            )}
          </Stack>

          {session.blocks.map((block) => (
            <Stack key={block.id} spacing={3}>
              {block.title && <Typography variant="h6">{block.title}</Typography>}
              {block.questions.map((question) => (
                <SessionAnswerCard
                  key={question.id}
                  question={question}
                  answer={session.answers.find((a) => a.question === question.id)}
                />
              ))}
            </Stack>
          ))}
        </Stack>
      )}
    </Container>
  );
}
