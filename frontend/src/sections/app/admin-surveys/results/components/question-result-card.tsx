import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import type { QuestionResult } from '../../api/types';

type Props = { result: QuestionResult };

export default function QuestionResultCard({ result }: Props) {
  const { tx } = useLocales();
  const totalCount = (result.options ?? []).reduce((sum, o) => sum + o.count, 0);

  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {result.text}
      </Typography>

      {result.type !== 'textarea' && (
        <Stack spacing={1.5}>
          {(result.options ?? []).map((option) => {
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
      )}

      {result.type === 'textarea' && (
        <Stack spacing={1}>
          {(result.textValues ?? []).length === 0 && (
            <Typography variant="body2" color="text.disabled">
              {tx('surveys.results.noAnswers')}
            </Typography>
          )}
          {(result.textValues ?? []).map((answer, i) => (
            <Box
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral', fontSize: 14 }}
            >
              {answer}
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  );
}
