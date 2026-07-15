import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Iconify from 'src/components/iconify';
import useLocales from 'src/locales/use-locales';
import type { SessionAnswer, SessionQuestion } from '../../api/types';

type Props = { question: SessionQuestion; answer: SessionAnswer | undefined };

const SCALE_TYPES = new Set(['nps', 'scale5']);
const TEXT_TYPES = new Set(['short_text', 'textarea', 'form_field']);

/** Renders a signature_date answer's `{"name","date"}` JSON payload as one line. */
function formatSignature(textValue: string): string {
  try {
    const payload = JSON.parse(textValue) as { name?: string; date?: string };
    const parts = [payload.name?.trim(), payload.date?.trim()].filter(Boolean);
    return parts.length ? parts.join(' — ') : textValue;
  } catch {
    return textValue;
  }
}

function NoAnswer() {
  const { tx } = useLocales();
  return (
    <Typography variant="body2" color="text.disabled">
      {tx('surveys.sessions.detail.noAnswer')}
    </Typography>
  );
}

function ScaleAnswer({ question, textValue }: { question: SessionQuestion; textValue: string }) {
  const { tx } = useLocales();
  const defaultMin = question.type === 'nps' ? 0 : 1;
  const defaultMax = question.type === 'nps' ? 10 : 5;
  const min = Number(question.settings.min ?? defaultMin);
  const max = Number(question.settings.max ?? defaultMax);
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const selected = textValue === '' ? null : Number(textValue);

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {values.map((value) => (
        <Chip
          key={value}
          label={value}
          size="small"
          color={selected === value ? 'primary' : 'default'}
          variant={selected === value ? 'filled' : 'outlined'}
        />
      ))}
      {selected === null && (
        <Typography variant="body2" color="text.disabled" sx={{ alignSelf: 'center' }}>
          {tx('surveys.sessions.detail.noAnswer')}
        </Typography>
      )}
    </Stack>
  );
}

function OptionsAnswer({
  question,
  selectedOptionIds,
}: {
  question: SessionQuestion;
  selectedOptionIds: string[];
}) {
  if (selectedOptionIds.length === 0) return <NoAnswer />;
  const selectedSet = new Set(selectedOptionIds);
  return (
    <Stack spacing={0.75}>
      {question.options.map((option) => {
        const isSelected = selectedSet.has(option.id);
        return (
          <Stack key={option.id} direction="row" spacing={1} alignItems="center">
            <Iconify
              icon={isSelected ? 'eva:checkmark-circle-2-fill' : 'eva:radio-button-off-outline'}
              width={18}
              sx={{ color: isSelected ? 'primary.main' : 'text.disabled', flexShrink: 0 }}
            />
            <Typography
              variant="body2"
              sx={{ color: isSelected ? 'text.primary' : 'text.disabled', fontWeight: isSelected ? 600 : 400 }}
            >
              {option.text}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

export default function SessionAnswerCard({ question, answer }: Props) {
  if (question.type === 'section_header') {
    return (
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', pt: 1 }}>
        {question.text}
      </Typography>
    );
  }

  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {question.text}
      </Typography>

      {SCALE_TYPES.has(question.type) && (
        <ScaleAnswer question={question} textValue={answer?.textValue ?? ''} />
      )}

      {(TEXT_TYPES.has(question.type) || question.type === 'signature_date') && (
        <Box>
          {answer?.textValue ? (
            <Typography variant="body2" sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}>
              {question.type === 'signature_date' ? formatSignature(answer.textValue) : answer.textValue}
            </Typography>
          ) : (
            <NoAnswer />
          )}
        </Box>
      )}

      {(question.type === 'single' || question.type === 'multiple') && (
        <OptionsAnswer question={question} selectedOptionIds={answer?.selectedOptionIds ?? []} />
      )}
    </Card>
  );
}
