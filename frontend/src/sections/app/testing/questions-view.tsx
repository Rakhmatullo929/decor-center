import { useCallback, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
// @mui
import Box from '@mui/material/Box';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import { useSnackbar } from 'src/components/snackbar';
// routes
import { paths } from 'src/routes/paths';
// utils
import { errorReader } from 'src/utils/error-reader';
//
import type { SubmitAnswerItem, TestQuestion, TestSession } from './api/types';
import { useSubmitTestSessionMutation } from './api/use-testing-api';
import { QuestionStep, ResultStep, SubmitFaceStep } from './components';
import TestingPanel from './components/testing-panel';

// ----------------------------------------------------------------------

type Phase = 'answering' | 'capturing';

export default function QuestionsView() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const { tx } = useLocales();

  const session = state?.session as TestSession | undefined;
  const questions = state?.questions as TestQuestion[] | undefined;

  const [answers, setAnswers] = useState<Partial<Record<number, number>>>({});
  const [result, setResult] = useState<TestSession | null>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [reverifyError, setReverifyError] = useState<string | null>(null);

  const submitMutation = useSubmitTestSessionMutation();

  const handleAnswer = useCallback((questionId: number, option: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const doSubmit = useCallback(
    (faceImage?: string) => {
      if (!session || !questions || submitMutation.isPending) return;

      const items: SubmitAnswerItem[] = [];
      questions.forEach((q) => {
        const selected = answers[q.id];
        if (selected !== undefined) items.push({ question: q.id, selectedOption: selected });
      });
      if (items.length !== questions.length) return;

      submitMutation.mutate(
        { sessionId: session.id, payload: { answers: items, ...(faceImage ? { faceImage } : {}) } },
        {
          onSuccess: (finished) => {
            setResult(finished);
            enqueueSnackbar(tx('testing.toasts.submitted'));
          },
          onError: (err) => {
            const httpStatus = (err as any).response?.status;
            const code = (err as any).response?.data?.code;
            if (httpStatus === 403 && code === 'face_reverify_failed') {
              setReverifyError('testing.submitFace.failed'); // stay on the capture step
            } else {
              setReverifyError(null);
              setPhase('answering');
              enqueueSnackbar(errorReader(err), { variant: 'error' });
            }
          },
        }
      );
    },
    [answers, enqueueSnackbar, questions, session, submitMutation, tx]
  );

  const handleSubmit = useCallback(() => {
    if (submitMutation.isPending) return;
    if (session?.requiresSubmitReverify) {
      setReverifyError(null);
      setPhase('capturing');
      return;
    }
    doSubmit();
  }, [doSubmit, session, submitMutation.isPending]);

  const handleFinish = useCallback(() => {
    navigate(paths.app.testing.root);
  }, [navigate]);

  if (!session || !questions) {
    return <Navigate to={paths.app.testing.root} replace />;
  }

  let content: JSX.Element;
  if (result) {
    content = (
      <Box sx={{ px: { xs: 3, md: 6 }, py: { xs: 5, md: 8 } }}>
        <ResultStep result={result} onFinish={handleFinish} />
      </Box>
    );
  } else if (phase === 'capturing') {
    content = (
      <Box sx={{ px: { xs: 3, md: 6 }, py: { xs: 5, md: 8 } }}>
        <SubmitFaceStep
          onCapture={(faceImage) => doSubmit(faceImage)}
          onCancel={() => {
            setReverifyError(null);
            setPhase('answering');
          }}
          isSubmitting={submitMutation.isPending}
          errorMessage={reverifyError}
        />
      </Box>
    );
  } else {
    content = (
      <Box sx={{ px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 } }}>
        <QuestionStep
          questions={questions}
          module={session.module}
          answers={answers}
          onAnswer={handleAnswer}
          onSubmit={handleSubmit}
          isSubmitting={submitMutation.isPending}
        />
      </Box>
    );
  }

  return <TestingPanel>{content}</TestingPanel>;
}
