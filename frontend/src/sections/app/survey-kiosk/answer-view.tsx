import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { SubmitAnswerItem, SurveyQuestion } from './api/types';
import { useSubmitSurveyMutation } from './api/use-survey-kiosk-api';
import { QuestionStep, SurveyPanel, ThankYouStep, type KioskAnswer } from './components';
import { useKioskSession } from './session/use-kiosk-session';

/** After finishing, the kiosk auto-returns to the camera for the next employee. */
const AUTO_RETURN_MS = 6000;

export default function KioskAnswerView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { session, reset } = useKioskSession();

  const { start, verified } = session;
  const employeeName = start?.session.employeeName ?? '';

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
    if (!start || !verified || submitMutation.isPending) return;
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
  }, [start, verified, questions, answers, submitMutation, enqueueSnackbar]);

  const finish = useCallback(() => {
    reset();
    navigate(paths.scan, { replace: true });
  }, [reset, navigate]);

  // Kiosk loop: once the thank-you screen shows, return to the scanner automatically.
  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(finish, AUTO_RETURN_MS);
    return () => clearTimeout(timer);
  }, [done, finish]);

  if (!start || !verified) {
    return <Navigate to={paths.scan} replace />;
  }

  return (
    <SurveyPanel maxWidth={640}>
      {done ? (
        <ThankYouStep employeeName={employeeName} onFinish={finish} />
      ) : (
        <QuestionStep
          questions={questions}
          answers={answers}
          onAnswer={handleAnswer}
          onSubmit={handleSubmit}
          isSubmitting={submitMutation.isPending}
        />
      )}
    </SurveyPanel>
  );
}
