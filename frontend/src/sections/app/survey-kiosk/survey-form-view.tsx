import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'src/components/snackbar';
import { LoadingScreen } from 'src/components/loading-screen';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { KioskAnswer, SubmitAnswerItem, SurveyQuestion } from './api/types';
import { useSessionDetailQuery, useSubmitSurveyMutation } from './api/use-survey-kiosk-api';
import { SurveyForm, SurveyPanel, ThankYouStep } from './components';
import { useAnswerAutosave } from './session/use-answer-autosave';
import { useEmployeeAuth } from './session/use-employee-auth';
import { useKioskSession } from './session/use-kiosk-session';

/** After finishing, the kiosk auto-returns to the camera for the next employee. */
const AUTO_RETURN_MS = 6000;

export default function SurveyFormView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { loading, signedIn } = useEmployeeAuth();
  const { reset } = useKioskSession();

  const sessionQuery = useSessionDetailQuery(sessionId);
  const { saveAnswer, statusByQuestion } = useAnswerAutosave(sessionId ?? '');
  const submitMutation = useSubmitSurveyMutation();

  const [answers, setAnswers] = useState<Record<number, KioskAnswer>>({});
  const [seeded, setSeeded] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Seed local form state from the backend once (not on every refetch), so autosaves
  // that land while the user keeps typing don't clobber their in-flight edits.
  useEffect(() => {
    if (seeded || !sessionQuery.data) return;
    const seededAnswers: Record<number, KioskAnswer> = {};
    sessionQuery.data.answers.forEach((a) => {
      seededAnswers[a.question] = { selectedOptionIds: a.selectedOptionIds, textValue: a.textValue };
    });
    setAnswers(seededAnswers);
    setSeeded(true);
  }, [seeded, sessionQuery.data]);

  const handleAnswer = useCallback(
    (item: SubmitAnswerItem, opts?: { immediate?: boolean }) => {
      setAnswers((prev) => ({
        ...prev,
        [item.question]: { selectedOptionIds: item.selectedOptionIds, textValue: item.textValue },
      }));
      if (sessionId) saveAnswer(item.question, item, opts);
    },
    [sessionId, saveAnswer]
  );

  const handleSubmit = useCallback(() => {
    if (!sessionQuery.data || submitMutation.isPending) return;
    const questions: SurveyQuestion[] = sessionQuery.data.blocks.flatMap((b) => b.questions);
    const items: SubmitAnswerItem[] = questions
      .filter((q) => q.type !== 'section_header')
      .map((q) => {
        const a = answers[q.id];
        return {
          question: q.id,
          selectedOptionIds: a?.selectedOptionIds ?? [],
          textValue: a?.textValue ?? '',
        };
      });
    submitMutation.mutate(
      { sessionId: sessionQuery.data.id, payload: { answers: items } },
      {
        onSuccess: () => setJustSubmitted(true),
        onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
      }
    );
  }, [sessionQuery.data, answers, submitMutation, enqueueSnackbar]);

  const finish = useCallback(() => {
    reset();
    navigate(paths.scan, { replace: true });
  }, [reset, navigate]);

  const done = justSubmitted || sessionQuery.data?.status === 'completed';

  // Kiosk loop: once the thank-you screen shows, return to the scanner automatically.
  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(finish, AUTO_RETURN_MS);
    return () => clearTimeout(timer);
  }, [done, finish]);

  if (loading) return null;
  if (!signedIn) return <Navigate to={paths.scan} replace />;
  if (!sessionId) return <Navigate to={paths.employee} replace />;
  if (sessionQuery.isError) return <Navigate to={paths.employee} replace />;
  if (!sessionQuery.data || !seeded) {
    return (
      <SurveyPanel maxWidth={760}>
        <LoadingScreen />
      </SurveyPanel>
    );
  }

  return (
    <SurveyPanel maxWidth={760}>
      {done ? (
        <ThankYouStep employeeName={sessionQuery.data.employeeName} onFinish={finish} />
      ) : (
        <SurveyForm
          testTitle={sessionQuery.data.testTitle}
          blocks={sessionQuery.data.blocks}
          answers={answers}
          autosaveStatusByQuestion={statusByQuestion}
          onAnswer={handleAnswer}
          onSubmit={handleSubmit}
          isSubmitting={submitMutation.isPending}
        />
      )}
    </SurveyPanel>
  );
}
