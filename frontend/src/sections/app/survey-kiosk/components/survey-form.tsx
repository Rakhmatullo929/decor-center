import { useCallback, useMemo, useRef, useState } from 'react';
import LoadingButton from '@mui/lab/LoadingButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import type { AutosaveAnswerPayload, KioskAnswer, SurveyBlock, SurveyQuestion } from '../api/types';
import type { AutosaveStatus } from '../session/use-answer-autosave';
import QuestionCard from './question-card';

type Props = {
  testTitle: string;
  blocks: SurveyBlock[];
  answers: Record<number, KioskAnswer>;
  autosaveStatusByQuestion: Record<number, AutosaveStatus>;
  onAnswer: (item: AutosaveAnswerPayload, opts?: { immediate?: boolean }) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
};

function isAnswered(question: SurveyQuestion, answer: KioskAnswer | undefined): boolean {
  switch (question.type) {
    case 'section_header':
      return true;
    case 'single':
      return (answer?.selectedOptionIds?.length ?? 0) === 1;
    case 'multiple':
      return (answer?.selectedOptionIds?.length ?? 0) >= 1;
    case 'signature_date':
      try {
        const parsed = JSON.parse(answer?.textValue ?? '');
        return Boolean(parsed.name) && Boolean(parsed.date);
      } catch {
        return false;
      }
    default:
      return Boolean(answer?.textValue?.trim());
  }
}

export default function SurveyForm({
  testTitle,
  blocks,
  answers,
  autosaveStatusByQuestion,
  onAnswer,
  onSubmit,
  isSubmitting,
}: Props) {
  const { tx } = useLocales();
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [invalidIds, setInvalidIds] = useState<Set<number>>(new Set());

  const questions = useMemo<SurveyQuestion[]>(
    () => blocks.flatMap((block) => block.questions),
    [blocks]
  );
  const requiredQuestions = useMemo(
    () => questions.filter((q) => q.isRequired && q.type !== 'section_header'),
    [questions]
  );
  const trackedQuestions = requiredQuestions.length > 0
    ? requiredQuestions
    : questions.filter((q) => q.type !== 'section_header');
  const answeredCount = trackedQuestions.filter((q) => isAnswered(q, answers[q.id])).length;
  const progress = trackedQuestions.length > 0
    ? Math.round((answeredCount / trackedQuestions.length) * 100)
    : 100;

  const handleSubmit = useCallback(() => {
    const firstInvalid = requiredQuestions.find((q) => !isAnswered(q, answers[q.id]));
    if (firstInvalid) {
      setInvalidIds(new Set(requiredQuestions.filter((q) => !isAnswered(q, answers[q.id])).map((q) => q.id)));
      cardRefs.current[firstInvalid.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setInvalidIds(new Set());
    onSubmit();
  }, [requiredQuestions, answers, onSubmit]);

  return (
    <Stack spacing={4}>
      <Stack spacing={2}>
        <Typography variant="h4">{testTitle}</Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
      </Stack>

      {blocks.map((block) => (
        <Stack key={block.id} spacing={2.5}>
          {block.title && (
            <Typography variant="h6" sx={{ color: 'text.secondary' }}>
              {block.title}
            </Typography>
          )}
          {block.questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              answer={answers[question.id]}
              invalid={invalidIds.has(question.id)}
              autosaveStatus={autosaveStatusByQuestion[question.id] ?? 'idle'}
              onAnswer={onAnswer}
              cardRef={(el) => {
                cardRefs.current[question.id] = el;
              }}
            />
          ))}
        </Stack>
      ))}

      <Stack direction="row" justifyContent="flex-end">
        <LoadingButton
          variant="contained"
          size="large"
          loading={isSubmitting}
          endIcon={<Iconify icon="eva:paper-plane-fill" />}
          onClick={handleSubmit}
        >
          {tx('common.actions.submit')}
        </LoadingButton>
      </Stack>
    </Stack>
  );
}
