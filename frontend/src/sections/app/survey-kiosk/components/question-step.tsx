import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LoadingButton from '@mui/lab/LoadingButton';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { AnimatePresence, m } from 'framer-motion';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import type { SurveyQuestion } from '../api/types';

export type KioskAnswer = { selectedOptionIds?: string[]; textValue?: string };

type Props = {
  questions: SurveyQuestion[];
  answers: Record<number, KioskAnswer>;
  onAnswer: (questionId: number, answer: KioskAnswer) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -32, transition: { duration: 0.2 } }),
};

function isAnswered(q: SurveyQuestion, a: KioskAnswer | undefined): boolean {
  if (q.type === 'textarea') return true; // optional
  if (q.type === 'single') return (a?.selectedOptionIds?.length ?? 0) === 1;
  return (a?.selectedOptionIds?.length ?? 0) >= 1; // multiple
}

export default function QuestionStep({ questions, answers, onAnswer, onSubmit, isSubmitting }: Props) {
  const { tx } = useLocales();
  const theme = useTheme();
  const p = theme.palette.primary.main;
  const isDark = theme.palette.mode === 'dark';

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const question = questions[index];
  const total = questions.length;
  const isLast = index === total - 1;
  const answer = question ? answers[question.id] : undefined;
  const canProceed = question ? isAnswered(question, answer) : false;

  if (!question) return null;

  const handleSingle = (optionId: string) => onAnswer(question.id, { selectedOptionIds: [optionId] });
  const handleMultiple = (optionId: string) => {
    const current = new Set(answer?.selectedOptionIds ?? []);
    if (current.has(optionId)) current.delete(optionId);
    else current.add(optionId);
    onAnswer(question.id, { selectedOptionIds: Array.from(current) });
  };
  const handleText = (value: string) => onAnswer(question.id, { textValue: value });

  const handleNext = () => {
    if (!canProceed) return;
    if (isLast) {
      onSubmit();
      return;
    }
    setDirection(1);
    setIndex((prev) => prev + 1);
  };
  const handleBack = () => {
    setDirection(-1);
    setIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <Stack spacing={4} sx={{ maxWidth: 740, mx: 'auto', width: 1 }}>
      {/* Progress */}
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {tx('survey.kiosk.questions.progress', { current: index + 1, total })}
          </Typography>
        </Stack>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {Array.from({ length: total }, (_, i) => (
            <Box
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              sx={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                transition: 'background-color 0.35s ease',
                bgcolor: (() => {
                  if (i < index) return alpha(p, 0.5);
                  if (i === index) return p;
                  return alpha(p, isDark ? 0.1 : 0.08);
                })(),
              }}
            />
          ))}
        </Box>
      </Stack>

      {/* Question + answer controls */}
      <AnimatePresence mode="wait" custom={direction}>
        <m.div key={question.id} custom={direction} variants={variants} initial="enter" animate="center" exit="exit">
          <Stack spacing={3}>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.45 }}>
              {question.text}
            </Typography>

            {question.type === 'single' && (
              <RadioGroup
                value={answer?.selectedOptionIds?.[0] ?? ''}
                onChange={(e) => handleSingle(e.target.value)}
              >
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
                        checked={(answer?.selectedOptionIds ?? []).includes(option.id)}
                        onChange={() => handleMultiple(option.id)}
                      />
                    }
                    label={option.text}
                  />
                ))}
              </Stack>
            )}

            {question.type === 'textarea' && (
              <TextField
                multiline
                minRows={4}
                fullWidth
                placeholder={tx('survey.kiosk.questions.textPlaceholder')}
                value={answer?.textValue ?? ''}
                onChange={(e) => handleText(e.target.value)}
              />
            )}
          </Stack>
        </m.div>
      </AnimatePresence>

      {/* Navigation */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button
          variant="text"
          color="inherit"
          disabled={index === 0}
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
          onClick={handleBack}
          sx={{ color: 'text.secondary' }}
        >
          {tx('common.actions.back')}
        </Button>

        <LoadingButton
          variant="contained"
          size="large"
          loading={isSubmitting}
          disabled={!canProceed}
          endIcon={!isLast ? <Iconify icon="eva:arrow-ios-forward-fill" /> : undefined}
          onClick={handleNext}
        >
          {tx(isLast ? 'common.actions.submit' : 'common.actions.next')}
        </LoadingButton>
      </Stack>
    </Stack>
  );
}
