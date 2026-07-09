import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutosaveAnswerPayload } from '../api/types';
import { useAutosaveAnswerMutation } from '../api/use-survey-kiosk-api';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 600;

/**
 * Debounces text-type answers (~600ms) and saves choice-type answers immediately, so
 * progress survives a closed tab without a request per keystroke. The final `submit`
 * still sends the full answer set as a safety net if an autosave call silently failed.
 */
export function useAnswerAutosave(sessionId: number | string) {
  const mutation = useAutosaveAnswerMutation();
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [statusByQuestion, setStatusByQuestion] = useState<Record<number, AutosaveStatus>>({});

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      Object.values(timersAtMount).forEach(clearTimeout);
    };
  }, []);

  const flush = useCallback(
    (questionId: number, item: AutosaveAnswerPayload) => {
      setStatusByQuestion((prev) => ({ ...prev, [questionId]: 'saving' }));
      mutation.mutate(
        { sessionId, item },
        {
          onSuccess: () => setStatusByQuestion((prev) => ({ ...prev, [questionId]: 'saved' })),
          onError: () => setStatusByQuestion((prev) => ({ ...prev, [questionId]: 'error' })),
        }
      );
    },
    [mutation, sessionId]
  );

  const saveAnswer = useCallback(
    (questionId: number, item: AutosaveAnswerPayload, opts?: { immediate?: boolean }) => {
      clearTimeout(timers.current[questionId]);
      if (opts?.immediate) {
        flush(questionId, item);
        return;
      }
      setStatusByQuestion((prev) => ({ ...prev, [questionId]: 'saving' }));
      timers.current[questionId] = setTimeout(() => flush(questionId, item), DEBOUNCE_MS);
    },
    [flush]
  );

  return { saveAnswer, statusByQuestion };
}
