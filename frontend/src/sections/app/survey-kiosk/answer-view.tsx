import { useCallback, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { StartSurveyResponse, SubmitAnswerItem, SurveyQuestion } from './api/types';
import { useSubmitSurveyMutation } from './api/use-survey-kiosk-api';
import { QuestionStep, SurveyPanel, ThankYouStep, type KioskAnswer } from './components';

export default function KioskAnswerView() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { enqueueSnackbar } = useSnackbar();

  const start = state?.start as StartSurveyResponse | undefined;
  const employeeName = (state?.employeeName as string | undefined) ?? '';

  const [answers, setAnswers] = useState<Record<number, KioskAnswer>>({});
  const [done, setDone] = useState(false);

  const submitMutation = useSubmitSurveyMutation();

  const questions = useMemo<SurveyQuestion[]>(
    () => (start ? start.blocks.flatMap((block) => block.questions) : []),
    [start]
  );

  const handleAnswer = useCallback((questionId: number, answer: KioskAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!start || submitMutation.isPending) return;
    const items: SubmitAnswerItem[] = questions.map((q) => {
      const a = answers[q.id];
      if (q.type === 'textarea') return { question: q.id, textValue: a?.textValue ?? '' };
      return { question: q.id, selectedOptionIds: a?.selectedOptionIds ?? [] };
    });
    submitMutation.mutate(
      { sessionId: start.session.id, payload: { answers: items } },
      {
        onSuccess: () => setDone(true),
        onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
      }
    );
  }, [start, questions, answers, submitMutation, enqueueSnackbar]);

  if (!start) {
    return <Navigate to={paths.app.kiosk.root} replace />;
  }

  return (
    <SurveyPanel>
      <Box sx={{ px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 } }}>
        {done ? (
          <ThankYouStep employeeName={employeeName} onFinish={() => navigate(paths.app.kiosk.root)} />
        ) : (
          <QuestionStep
            questions={questions}
            answers={answers}
            onAnswer={handleAnswer}
            onSubmit={handleSubmit}
            isSubmitting={submitMutation.isPending}
          />
        )}
      </Box>
    </SurveyPanel>
  );
}
