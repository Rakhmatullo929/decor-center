// @mui
import { alpha } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import { useSettingsContext } from 'src/components/settings';
import { useParams, useRouter } from 'src/routes/hook';
import { paths } from 'src/routes/paths';
// utils
import { fDateTime } from 'src/utils/format-time';
//
import { useResultDetailQuery } from '../api/use-results-api';
import type { TestAnswer } from '../api/types';
import { MODULE_LABEL_KEYS } from '../components/utils/module-label';
import { getSessionStatus } from '../components/utils/session-status';
import { ResultDetailSkeleton } from '../skeleton';

// ----------------------------------------------------------------------

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <Stack direction="row" spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type SubmitReverifyRowProps = {
  /** null = not checked, true = matched, false = mismatch (SRS submit-time re-verification). */
  value: boolean | null;
};

/** Submit-time face re-verification status; shown only when the feature flag is enabled. */
function SubmitReverifyRow({ value }: SubmitReverifyRowProps) {
  const { tx } = useLocales();

  const view = (() => {
    if (value === null) {
      return {
        icon: 'eva:minus-circle-outline',
        color: 'text.disabled',
        key: 'results.detail.submitFaceUnchecked',
      };
    }
    if (value) {
      return {
        icon: 'eva:checkmark-circle-2-fill',
        color: 'success.main',
        key: 'results.detail.submitFaceVerified',
      };
    }
    return {
      icon: 'eva:close-circle-fill',
      color: 'error.main',
      key: 'results.detail.submitFaceNotVerified',
    };
  })();

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Iconify icon={view.icon} sx={{ color: view.color }} />
      <Typography variant="body2">{tx(view.key)}</Typography>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type AnswerItemProps = {
  answer: TestAnswer;
  index: number;
};

function AnswerItem({ answer, index }: AnswerItemProps) {
  const { tx } = useLocales();

  const resultIcon = (() => {
    if (answer.isCorrect === null) {
      return { icon: 'eva:minus-circle-outline', color: 'text.disabled' };
    }
    if (answer.isCorrect) {
      return { icon: 'eva:checkmark-circle-2-fill', color: 'success.main' };
    }
    return { icon: 'eva:close-circle-fill', color: 'error.main' };
  })();

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Iconify icon={resultIcon.icon} sx={{ color: resultIcon.color, mt: 0.25, flexShrink: 0 }} />

        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {index + 1}. {answer.questionText}
        </Typography>

        {answer.selectedOption === null && (
          <Label variant="soft" color="warning" sx={{ flexShrink: 0 }}>
            {tx('results.detail.noAnswer')}
          </Label>
        )}
      </Stack>

      <Stack spacing={0.5}>
        {answer.questionOptions.map((option, optionIndex) => {
          const isCorrectOption = optionIndex === answer.correctOption;
          const isSelected = optionIndex === answer.selectedOption;
          const isWrongSelection = isSelected && !isCorrectOption;

          const optionIcon = (() => {
            if (isCorrectOption) {
              return { icon: 'eva:checkmark-circle-2-fill', color: 'success.main' };
            }
            if (isWrongSelection) {
              return { icon: 'eva:close-circle-fill', color: 'error.main' };
            }
            return { icon: 'eva:radio-button-off-outline', color: 'text.disabled' };
          })();

          return (
            <Stack
              key={optionIndex}
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 1,
                ...(isCorrectOption && {
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
                }),
                ...(isWrongSelection && {
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                }),
              }}
            >
              <Iconify
                icon={optionIcon.icon}
                width={20}
                sx={{ color: optionIcon.color, flexShrink: 0 }}
              />

              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {option}
              </Typography>

              {isSelected && (
                <Label variant="soft" color={isCorrectOption ? 'success' : 'error'}>
                  {tx('results.detail.selectedAnswer')}
                </Label>
              )}

              {isCorrectOption && !isSelected && (
                <Label variant="soft" color="success">
                  {tx('results.detail.correctAnswer')}
                </Label>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}

// ----------------------------------------------------------------------

export default function ResultDetailView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const router = useRouter();
  const params = useParams();

  const detailQuery = useResultDetailQuery(params.id);
  const session = detailQuery.data;

  const status = session ? getSessionStatus(session.passed) : null;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('results.detailTitle')}
        links={[
          { name: tx('common.appName'), href: paths.home },
          { name: tx('results.title'), href: paths.app.results.root },
          { name: session?.employeeName ?? tx('results.detailTitle') },
        ]}
        action={
          <Button
            startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
            onClick={() => router.push(paths.app.results.root)}
          >
            {tx('common.actions.back')}
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {detailQuery.isPending && <ResultDetailSkeleton />}

      {detailQuery.isError && (
        <EmptyContent filled title={tx('results.detail.notFound')} sx={{ py: 10 }} />
      )}

      {session && status && (
        <>
          <Card sx={{ p: 3, mb: 3 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
            >
              <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                <Typography variant="h6">{session.employeeName}</Typography>

                <InfoRow
                  label={tx('results.detail.module')}
                  value={tx(MODULE_LABEL_KEYS[session.module])}
                />
                <InfoRow
                  label={tx('results.detail.specialty')}
                  value={session.specialtyName ?? '—'}
                />
                <InfoRow label={tx('results.detail.startedAt')} value={fDateTime(session.startedAt)} />
                <InfoRow
                  label={tx('results.detail.finishedAt')}
                  value={session.finishedAt ? fDateTime(session.finishedAt) : '—'}
                />

                <Stack direction="row" spacing={1} alignItems="center">
                  <Iconify
                    icon={
                      session.faceVerified ? 'eva:checkmark-circle-2-fill' : 'eva:close-circle-fill'
                    }
                    sx={{ color: session.faceVerified ? 'success.main' : 'error.main' }}
                  />
                  <Typography variant="body2">
                    {tx(
                      session.faceVerified
                        ? 'results.detail.faceVerified'
                        : 'results.detail.faceNotVerified'
                    )}
                  </Typography>
                </Stack>

                {session.requiresSubmitReverify && (
                  <SubmitReverifyRow value={session.submitFaceVerified} />
                )}
              </Stack>

              <Stack spacing={1.5} alignItems="center" sx={{ px: { md: 5 }, flexShrink: 0 }}>
                <Typography variant="h2">
                  {session.score === null ? '—' : `${session.score} / ${session.total}`}
                </Typography>
                <Label variant="soft" color={status.color} sx={{ px: 2 }}>
                  {tx(status.labelKey)}
                </Label>
              </Stack>
            </Stack>
          </Card>

          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              {tx('results.detail.answers')}
            </Typography>

            {session.answers.length === 0 ? (
              <EmptyContent filled title={tx('results.detail.noAnswers')} sx={{ py: 8 }} />
            ) : (
              <Stack spacing={3} divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
                {session.answers.map((answer, index) => (
                  <AnswerItem key={answer.question} answer={answer} index={index} />
                ))}
              </Stack>
            )}
          </Card>
        </>
      )}
    </Container>
  );
}
