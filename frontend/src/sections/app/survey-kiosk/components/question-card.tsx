import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import type { AutosaveAnswerPayload, KioskAnswer, SurveyQuestion } from '../api/types';
import type { AutosaveStatus } from '../session/use-answer-autosave';

type Props = {
  question: SurveyQuestion;
  answer: KioskAnswer | undefined;
  invalid: boolean;
  autosaveStatus: AutosaveStatus;
  onAnswer: (item: AutosaveAnswerPayload, opts?: { immediate?: boolean }) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
};

const AUTOSAVE_LABEL_KEYS: Record<Exclude<AutosaveStatus, 'idle'>, string> = {
  saving: 'survey.kiosk.form.saving',
  error: 'survey.kiosk.form.saveFailed',
  saved: 'survey.kiosk.form.saved',
};

function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  const { tx } = useLocales();
  if (status === 'idle') return null;
  const label = tx(AUTOSAVE_LABEL_KEYS[status]);
  const color = status === 'error' ? 'error.main' : 'text.disabled';
  return (
    <Typography variant="caption" sx={{ color, display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {status === 'saved' && <Iconify icon="eva:checkmark-fill" width={14} />}
      {label}
    </Typography>
  );
}

function parseSignatureDate(raw: string | undefined): { name: string; date: string } {
  if (!raw) return { name: '', date: '' };
  try {
    const parsed = JSON.parse(raw);
    return { name: String(parsed.name ?? ''), date: String(parsed.date ?? '') };
  } catch {
    return { name: '', date: '' };
  }
}

export default function QuestionCard({
  question,
  answer,
  invalid,
  autosaveStatus,
  onAnswer,
  cardRef,
}: Props) {
  const { tx } = useLocales();

  if (question.type === 'section_header') {
    return (
      <Box sx={{ pt: 2 }}>
        <Typography variant="h6">{question.text}</Typography>
        <Divider sx={{ mt: 1.5 }} />
      </Box>
    );
  }

  const selectedOptionIds = answer?.selectedOptionIds ?? [];
  const textValue = answer?.textValue ?? '';

  const handleSingle = (optionId: string) =>
    onAnswer({ question: question.id, selectedOptionIds: [optionId] }, { immediate: true });

  const handleMultiple = (optionId: string) => {
    const current = new Set(selectedOptionIds);
    if (current.has(optionId)) current.delete(optionId);
    else current.add(optionId);
    onAnswer({ question: question.id, selectedOptionIds: Array.from(current) }, { immediate: true });
  };

  const handleText = (value: string) => onAnswer({ question: question.id, textValue: value });

  const handleScale = (value: number) =>
    onAnswer({ question: question.id, textValue: String(value) }, { immediate: true });

  const handleFormFieldText = (value: string) => onAnswer({ question: question.id, textValue: value });
  const handleFormFieldDate = (value: string) =>
    onAnswer({ question: question.id, textValue: value }, { immediate: true });

  const { name: signatureName, date: signatureDate } = parseSignatureDate(textValue);
  const handleSignatureName = (name: string) =>
    onAnswer({
      question: question.id,
      textValue: JSON.stringify({ name, date: signatureDate }),
    });
  const handleSignatureDate = (date: string) =>
    onAnswer(
      { question: question.id, textValue: JSON.stringify({ name: signatureName, date }) },
      { immediate: true }
    );

  return (
    <Card
      ref={cardRef}
      variant="outlined"
      sx={{
        p: { xs: 2.5, sm: 3 },
        borderColor: invalid ? 'error.main' : 'divider',
        ...(invalid && { bgcolor: (theme) => alpha(theme.palette.error.main, 0.04) }),
      }}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {question.text}
          {question.isRequired && (
            <Box component="span" sx={{ color: 'error.main' }}>
              {' '}
              *
            </Box>
          )}
        </Typography>

        {question.type === 'single' && (
          <RadioGroup value={selectedOptionIds[0] ?? ''} onChange={(e) => handleSingle(e.target.value)}>
            {question.options.map((option) => (
              <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.text} />
            ))}
          </RadioGroup>
        )}

        {question.type === 'multiple' && (
          <Stack>
            {question.options.map((option) => (
              <FormControlLabel
                key={option.id}
                control={
                  <Checkbox
                    checked={selectedOptionIds.includes(option.id)}
                    onChange={() => handleMultiple(option.id)}
                  />
                }
                label={option.text}
              />
            ))}
          </Stack>
        )}

        {question.type === 'short_text' && (
          <TextField
            fullWidth
            placeholder={tx('survey.kiosk.form.textPlaceholder')}
            value={textValue}
            onChange={(e) => handleText(e.target.value)}
          />
        )}

        {question.type === 'textarea' && (
          <TextField
            multiline
            minRows={4}
            fullWidth
            placeholder={tx('survey.kiosk.form.textPlaceholder')}
            value={textValue}
            onChange={(e) => handleText(e.target.value)}
          />
        )}

        {(question.type === 'nps' || question.type === 'scale5') && (
          <ScaleControl
            min={question.settings.min ?? (question.type === 'nps' ? 0 : 1)}
            max={question.settings.max ?? (question.type === 'nps' ? 10 : 5)}
            leftLabel={question.settings.leftLabel}
            rightLabel={question.settings.rightLabel}
            value={textValue ? Number(textValue) : null}
            onChange={handleScale}
          />
        )}

        {question.type === 'form_field' && question.settings.fieldType === 'date' && (
          <TextField
            type="date"
            value={textValue}
            onChange={(e) => handleFormFieldDate(e.target.value)}
            sx={{ maxWidth: 220 }}
            InputLabelProps={{ shrink: true }}
          />
        )}
        {question.type === 'form_field' && question.settings.fieldType !== 'date' && (
          <TextField
            fullWidth
            placeholder={question.settings.placeholder ?? ''}
            value={textValue}
            onChange={(e) => handleFormFieldText(e.target.value)}
          />
        )}

        {question.type === 'signature_date' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label={tx('survey.kiosk.form.signatureLabel')}
              value={signatureName}
              onChange={(e) => handleSignatureName(e.target.value)}
            />
            <TextField
              type="date"
              label={tx('survey.kiosk.form.dateLabel')}
              value={signatureDate}
              onChange={(e) => handleSignatureDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />
          </Stack>
        )}

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {invalid ? (
            <FormHelperText error>{tx('survey.kiosk.form.required')}</FormHelperText>
          ) : (
            <span />
          )}
          <AutosaveIndicator status={autosaveStatus} />
        </Stack>
      </Stack>
    </Card>
  );
}

type ScaleControlProps = {
  min: number;
  max: number;
  leftLabel?: string;
  rightLabel?: string;
  value: number | null;
  onChange: (value: number) => void;
};

function ScaleControl({ min, max, leftLabel, rightLabel, value, onChange }: ScaleControlProps) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
        {values.map((n) => (
          <Box
            key={n}
            role="button"
            tabIndex={0}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onChange(n);
            }}
            sx={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: (theme) => `1px solid ${theme.palette.divider}`,
              typography: 'subtitle2',
              transition: 'all 0.15s ease',
              ...(value === n && {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                borderColor: 'primary.main',
              }),
            }}
          >
            {n}
          </Box>
        ))}
      </Stack>
      {(leftLabel || rightLabel) && (
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {leftLabel}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {rightLabel}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
