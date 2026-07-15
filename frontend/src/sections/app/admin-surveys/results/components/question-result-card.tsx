import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import type { QuestionResult } from '../../api/types';

type Props = { result: QuestionResult };

/** Rating distribution bars (one row per value in [min, max]) + average, for nps/scale5. */
function ScaleResultView({ result }: { result: Required<Pick<QuestionResult, 'scale'>>['scale'] }) {
  const { tx } = useLocales();
  const values = Array.from(
    { length: result.max - result.min + 1 },
    (_, i) => result.min + i
  );

  return (
    <Stack spacing={1.5}>
      {result.average !== null && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {tx('surveys.results.scaleAverage', { average: result.average })}
        </Typography>
      )}
      {values.map((value) => {
        const count = result.counts[String(value)] ?? 0;
        const pct = result.responseCount ? Math.round((count / result.responseCount) * 100) : 0;
        return (
          <Box key={value}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="body2">{value}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {count} ({pct}%)
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={pct} />
          </Box>
        );
      })}
    </Stack>
  );
}

function TextAnswersView({ textValues }: { textValues: string[] }) {
  const { tx } = useLocales();
  if (textValues.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        {tx('surveys.results.noAnswers')}
      </Typography>
    );
  }
  return (
    <Stack spacing={1}>
      {textValues.map((answer, i) => (
        <Box
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral', fontSize: 14 }}
        >
          {answer}
        </Box>
      ))}
    </Stack>
  );
}

function OptionsResultView({ options }: { options: NonNullable<QuestionResult['options']> }) {
  const totalCount = options.reduce((sum, o) => sum + o.count, 0);
  return (
    <Stack spacing={1.5}>
      {options.map((option) => {
        const pct = totalCount ? Math.round((option.count / totalCount) * 100) : 0;
        return (
          <Box key={option.id}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="body2">{option.text}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {option.count} ({pct}%)
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={pct} />
          </Box>
        );
      })}
    </Stack>
  );
}

export default function QuestionResultCard({ result }: Props) {
  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {result.text}
      </Typography>

      {result.scale && <ScaleResultView result={result.scale} />}
      {!result.scale && result.textValues && <TextAnswersView textValues={result.textValues} />}
      {!result.scale && !result.textValues && (
        <OptionsResultView options={result.options ?? []} />
      )}
    </Card>
  );
}
