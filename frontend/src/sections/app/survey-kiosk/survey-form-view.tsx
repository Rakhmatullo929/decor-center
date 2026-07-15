import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import { useSnackbar } from 'src/components/snackbar';
import Iconify from 'src/components/iconify';
import { LoadingScreen } from 'src/components/loading-screen';
import useLocales from 'src/locales/use-locales';
import { paths } from 'src/routes/paths';
import { errorCode, errorReader } from 'src/utils/error-reader';
import type { KioskAnswer, SubmitAnswerItem, SurveyQuestion } from './api/types';
import { useSessionDetailQuery, useSubmitSurveyMutation } from './api/use-survey-kiosk-api';
import { SurveyForm, SurveyPanel, ThankYouStep } from './components';
import {
  clearAnswerDraft,
  loadAnswerDraft,
  pruneExpiredDrafts,
  saveAnswerDraft,
} from './session/answer-draft';
import { useAnswerAutosave } from './session/use-answer-autosave';
import { useEmployeeAuth } from './session/use-employee-auth';
import { useKioskSession } from './session/use-kiosk-session';

/** After finishing, the kiosk auto-returns to the camera for the next employee. */
const AUTO_RETURN_MS = 6000;

export default function SurveyFormView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { tx } = useLocales();
  const { loading, signedIn } = useEmployeeAuth();
  const { reset } = useKioskSession();

  const sessionQuery = useSessionDetailQuery(sessionId);
  const { saveAnswer, flushPending, statusByQuestion } = useAnswerAutosave(sessionId ?? '');
  const submitMutation = useSubmitSurveyMutation();

  const [answers, setAnswers] = useState<Record<number, KioskAnswer>>({});
  const answersRef = useRef<Record<number, KioskAnswer>>({});
  const [seeded, setSeeded] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Seed local form state from the backend once (not on every refetch). A short-lived local draft
  // (localStorage) is overlaid on top so a refresh restores the last keystrokes an autosave debounce
  // had not yet sent. The draft never overwrites an existing server answer and expired ones are
  // swept, so it can't revert data edited elsewhere or fill up a shared kiosk's storage.
  useEffect(() => {
    if (seeded || !sessionQuery.data) return;
    pruneExpiredDrafts();
    const serverAnswers: Record<number, KioskAnswer> = {};
    sessionQuery.data.answers.forEach((a) => {
      serverAnswers[a.question] = { selectedOptionIds: a.selectedOptionIds, textValue: a.textValue };
    });
    // A completed session is read-only history — drop any stale local draft, never resurrect it.
    const completed = sessionQuery.data.status === 'completed';
    if (sessionId && completed) clearAnswerDraft(sessionId);
    const draft = sessionId && !completed ? loadAnswerDraft(sessionId) : {};
    const merged = { ...serverAnswers, ...draft };
    answersRef.current = merged;
    setAnswers(merged);
    setSeeded(true);
    // Recover to the backend only answers the server is missing entirely (e.g. text typed right
    // before a refresh). Existing server answers are left untouched, so a stale draft can never
    // overwrite a value edited elsewhere; any remaining divergence reconciles on submit.
    if (sessionId && !completed) {
      Object.entries(draft).forEach(([id, ans]) => {
        const questionId = Number(id);
        if (serverAnswers[questionId] === undefined) {
          saveAnswer(
            questionId,
            {
              question: questionId,
              selectedOptionIds: ans.selectedOptionIds,
              textValue: ans.textValue,
            },
            { immediate: true }
          );
        }
      });
    }
  }, [seeded, sessionQuery.data, sessionId, saveAnswer]);

  // Mirror the latest answers into a ref so handleAnswer can compute + persist synchronously.
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const handleAnswer = useCallback(
    (item: SubmitAnswerItem, opts?: { immediate?: boolean }) => {
      const next = {
        ...answersRef.current,
        [item.question]: { selectedOptionIds: item.selectedOptionIds, textValue: item.textValue },
      };
      answersRef.current = next;
      setAnswers(next);
      if (sessionId) {
        // Synchronous local backup on every input — even a single character survives a refresh.
        saveAnswerDraft(sessionId, next);
        saveAnswer(item.question, item, opts);
      }
    },
    [sessionId, saveAnswer]
  );

  const handleSubmit = useCallback(() => {
    if (!sessionQuery.data || submitMutation.isPending) return;
    flushPending(); // push any pending debounced text before the final full-set submit
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
        onSuccess: () => {
          if (sessionId) clearAnswerDraft(sessionId);
          setJustSubmitted(true);
        },
        onError: (err) => {
          if (errorCode(err) === 'survey_expired') {
            enqueueSnackbar(tx('survey.kiosk.form.expired'), { variant: 'warning' });
            reset();
            navigate(paths.scan, { replace: true });
            return;
          }
          enqueueSnackbar(errorReader(err), { variant: 'error' });
        },
      }
    );
  }, [
    sessionQuery.data,
    answers,
    submitMutation,
    enqueueSnackbar,
    flushPending,
    sessionId,
    tx,
    reset,
    navigate,
  ]);

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

  // Answers autosave on every change, so leaving mid-survey never loses input — back to the
  // due-surveys list is always safe. Hidden on the thank-you screen, which auto-returns on its own.
  const backAction = !done ? (
    <Button
      variant="text"
      size="small"
      startIcon={<Iconify icon="eva:arrow-back-fill" />}
      onClick={() => navigate(paths.employee)}
    >
      {tx('common.actions.back')}
    </Button>
  ) : undefined;

  if (loading) return null;
  if (!signedIn) return <Navigate to={paths.scan} replace />;
  if (!sessionId) return <Navigate to={paths.employee} replace />;
  if (sessionQuery.isError) return <Navigate to={paths.employee} replace />;
  if (!sessionQuery.data || !seeded) {
    return (
      <SurveyPanel maxWidth={760} action={backAction}>
        <LoadingScreen />
      </SurveyPanel>
    );
  }

  return (
    <SurveyPanel maxWidth={940} action={backAction}>
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
